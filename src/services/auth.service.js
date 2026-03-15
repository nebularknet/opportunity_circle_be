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

  const createdUser = await User.findById(user._id).select('-password -refreshToken');

  if (!createdUser) {
    throw new ApiError(500, 'Something went wrong while registering the user');
  }

  return createdUser;
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

const processOAuthLogin = async ({ provider, providerUserId, email, fullName, profilePhotoUrl }) => {
  const normalizedProvider = provider.toUpperCase();
  let oauthAccount = await OAuthAccount.findOne({ provider: normalizedProvider, providerUserId });
  let user;

  if (oauthAccount) {
    user = await User.findById(oauthAccount.userId);
  } else {
    // Check if user with this email already exists
    user = await User.findOne({ email });

    if (!user) {
      // Create new user
      user = await User.create({
        email,
        fullName,
        profilePhotoUrl,
        isOAuthUser: true,
        isEmailVerified: true,
      });

      // Initialize preferences
      await UserPreference.create({ userId: user._id });
    }

    // Link OAuth account
    await OAuthAccount.create({
      userId: user._id,
      provider: normalizedProvider,
      providerUserId,
    });
  }

  if (!user) {
    throw new ApiError(500, 'User creation or retrieval failed during OAuth');
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  const loggedInUser = await User.findById(user._id).select('-password -refreshToken');

  return { user: loggedInUser, accessToken, refreshToken };
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

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  processOAuthLogin,
  forgotPassword,
  resetPassword,
  verifyEmail,
};
