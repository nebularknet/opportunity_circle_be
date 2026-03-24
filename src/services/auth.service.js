import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { OAuthAccount } from '../models/OAuthAccount.js';
import { UserPreference } from '../models/UserPreference.js';
import { PublisherProfile } from '../models/PublisherProfile.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { EmailVerificationToken } from '../models/EmailVerificationToken.js';
import { ApiError } from '../utils/apiError.js';
import { generateAccessToken, generateRefreshToken } from '../utils/token.js';
import { sendEmail } from '../config/email.js';
import { withTransaction } from '../utils/dbUtils.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

const registerUser = async ({ email, password, role, fullName }) => {
  const existedUser = await User.findOne({ email });

  if (existedUser) {
    throw new ApiError(409, 'User with email already exists');
  }

  const user = await User.create({
    email,
    password,
    role,
    fullName,
  });

  // Initialize preferences for seekers
  if (role === 'SEEKER') {
    await UserPreference.create({ userId: user._id });
  }

  // Initialize publisher profile for publishers
  if (role === 'PUBLISHER') {
    await PublisherProfile.create({
      userId: user._id,
      organizationName: fullName || 'My Organization',
    });
  }

  // Generate Email Verification Token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

  await EmailVerificationToken.create({
    userId: user._id,
    token: hashedToken,
    expiresAt: new Date(Date.now() + 24 * 3600000), // 24 hours
  });

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  // Send verification email
  try {
    await sendEmail({
      to: user.email,
      subject: 'Verify your Opportunity Circle account',
      template: 'email-verification',
      context: {
        fullName: user.fullName,
        verificationUrl,
      },
    });
  } catch (error) {
    // We don't want to fail registration if email fails, but we should log it
    // In a real app, you might want to provide a "resend" option
    console.error('Failed to send verification email during registration:', error);
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const createdUser = await User.findById(user._id).select('-password -refreshToken');

  if (!createdUser) {
    throw new ApiError(500, 'Something went wrong while registering the user');
  }

  return { user: createdUser, accessToken, refreshToken };
};

const loginUser = async (email, password) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, 'User does not exist');
  }

  if (user.isOAuthUser && !user.password) {
    throw new ApiError(400, 'This account is linked with OAuth. Please login using your social account.');
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid user credentials');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const loggedInUser = await User.findById(user._id).select('-password -refreshToken');

  return { user: loggedInUser, accessToken, refreshToken };
};

const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(
    userId,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );
};

const refreshAccessToken = async (incomingRefreshToken) => {
  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, 'Refresh token is expired or used');
    }

    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken: newRefreshToken };
  } catch (error) {
    throw new ApiError(401, error?.message || 'Invalid refresh token');
  }
};

const processOAuthLogin = async ({ provider, providerUserId, email, fullName, profilePhotoUrl, role }) => {
  const normalizedProvider = provider.toUpperCase();

  // Retry logic for concurrent race conditions
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await withTransaction(async (session) => {
        const queryOptions = session ? { session } : {};
        
        let oauthAccount = await OAuthAccount.findOne({ provider: normalizedProvider, providerUserId }).setOptions(queryOptions);
        let user;
        let pendingRole = false;

        if (oauthAccount) {
          user = await User.findById(oauthAccount.userId).setOptions(queryOptions);
          
          // Update profile if changed
          if (user && (user.fullName !== fullName || user.profilePhotoUrl !== profilePhotoUrl)) {
            user.fullName = fullName || user.fullName;
            user.profilePhotoUrl = profilePhotoUrl || user.profilePhotoUrl;
            await user.save(queryOptions);
            logger.info(`Updated profile for user: ${email}`);
          }
        }

        if (!user) {
          // Check if user with this email already exists
          user = await User.findOne({ email }).setOptions(queryOptions);

          if (!user) {
            // Create new user
            const userRole = role || 'SEEKER';
            if (!role) {
              pendingRole = true;
            }

            const newUserArray = await User.create([{
              email,
              fullName,
              role: userRole,
              profilePhotoUrl,
              isOAuthUser: true,
              isEmailVerified: true,
            }], queryOptions);
            user = newUserArray[0];

            // Initialize preferences for seekers
            if (user.role === 'SEEKER') {
              await UserPreference.create([{ userId: user._id }], queryOptions);
            }
            // Initialize publisher profile for publishers
            if (user.role === 'PUBLISHER') {
              await PublisherProfile.create([{
                userId: user._id,
                organizationName: fullName || 'My Organization',
              }], queryOptions);
            }
            logger.info(`Created new user via OAuth (${normalizedProvider}): ${email}`);
          }

          // Link OAuth account if not already linked
          if (!oauthAccount) {
            await OAuthAccount.create([{
              userId: user._id,
              provider: normalizedProvider,
              providerUserId,
            }], queryOptions);
            logger.info(`Linked OAuth account (${normalizedProvider}) to user: ${email}`);
          } else if (!oauthAccount.userId.equals(user._id)) {
            // Update link if it exists but points to null user (shouldn't happen with transactions but for safety)
            oauthAccount.userId = user._id;
            await oauthAccount.save(queryOptions);
          }
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false, ...queryOptions });

        const loggedInUser = await User.findById(user._id).select('-password -refreshToken').setOptions(queryOptions);

        return { user: loggedInUser, accessToken, refreshToken, pendingRole };
      });
    } catch (error) {
      attempt++;
      // Check if it's a duplicate key error (code 11000)
      if (error.code === 11000 && attempt < maxRetries) {
        logger.warn(`Concurrency race condition detected for ${email} on attempt ${attempt}. Retrying...`);
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        continue;
      }
      logger.error(`OAuth login failed for ${email} after ${attempt} attempts:`, error);
      throw error;
    }
  }
};

const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, 'User not found');

  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  await PasswordResetToken.create({
    userId: user._id,
    token: hashedToken,
    expiresAt: new Date(Date.now() + 3600000), // 1 hour
  });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request',
    template: 'password-reset',
    context: {
      fullName: user.fullName,
      resetUrl,
    },
  });

  return true;
};

const resetPassword = async (token, newPassword) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const resetToken = await PasswordResetToken.findOne({
    token: hashedToken,
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!resetToken) throw new ApiError(400, 'Invalid or expired token');

  const user = await User.findById(resetToken.userId);
  if (!user) throw new ApiError(404, 'User not found');

  user.password = newPassword;
  await user.save();

  resetToken.used = true;
  await resetToken.save();

  return true;
};

const verifyEmail = async (token) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const verificationToken = await EmailVerificationToken.findOne({
    token: hashedToken,
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!verificationToken) throw new ApiError(400, 'Invalid or expired verification token');

  const user = await User.findById(verificationToken.userId);
  if (!user) throw new ApiError(404, 'User not found');

  user.isEmailVerified = true;
  await user.save({ validateBeforeSave: false });

  verificationToken.used = true;
  await verificationToken.save();

  return true;
};

const updateUserRole = async (userId, role) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Optional: Add validation to ensure only OAuth users without a finalized role can change it
  // For now, we'll allow it as long as they are authenticated.

  const allowedRoles = ['SEEKER', 'PUBLISHER'];
  if (!allowedRoles.includes(role)) {
    throw new ApiError(400, 'Invalid role specified');
  }

  user.role = role;
  await user.save({ validateBeforeSave: false });

  // Initialize profiles based on role
  if (role === 'SEEKER') {
    const preferences = await UserPreference.findOne({ userId });
    if (!preferences) {
      await UserPreference.create({ userId });
    }
  } else if (role === 'PUBLISHER') {
    const profile = await PublisherProfile.findOne({ userId });
    if (!profile) {
      // Use full name as organization name placeholder for initial setup
      await PublisherProfile.create({ 
        userId, 
        organizationName: user.fullName || 'My Organization' 
      });
    }
  }

  return user;
};

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  processOAuthLogin,
  forgotPassword,
  resetPassword,
  verifyEmail,
  updateUserRole,
};
