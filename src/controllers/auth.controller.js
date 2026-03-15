import { ApiResponse } from '../utils/apiResponse.js';
import * as authService from '../services/auth.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
};

const registerUser = asyncHandler(async (req, res) => {
  const user = await authService.registerUser(req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, user, 'User registered successfully'));
});

const loginUser = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.loginUser(
    req.body.email,
    req.body.password
  );

  return res
    .status(200)
    .cookie('accessToken', accessToken, cookieOptions)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user, accessToken, refreshToken },
        'User logged in successfully'
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await authService.logoutUser(req.user._id);

  return res
    .status(200)
    .clearCookie('accessToken', cookieOptions)
    .clearCookie('refreshToken', cookieOptions)
    .json(new ApiResponse(200, {}, 'User logged out successfully'));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Unauthorized request');
  }

  const { accessToken, refreshToken } = await authService.refreshAccessToken(incomingRefreshToken);

  return res
    .status(200)
    .cookie('accessToken', accessToken, cookieOptions)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken },
        'Access token refreshed'
      )
    );
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, 'Email is required');

  await authService.forgotPassword(email);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password reset link sent to your email'));
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new ApiError(400, 'Token and password are required');

  await authService.resetPassword(token, password);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password reset successfully'));
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    throw new ApiError(400, 'Verification token is required');
  }

  await authService.verifyEmail(token);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Email verified successfully'));
});

const oauthSuccess = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = req.user;

  return res
    .status(200)
    .cookie('accessToken', accessToken, cookieOptions)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .redirect(`${process.env.FRONTEND_URL}/oauth-callback?token=${accessToken}&refreshToken=${refreshToken}`);
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  oauthSuccess,
};
