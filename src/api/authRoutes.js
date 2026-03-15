import { Router } from 'express';
import passport from 'passport';
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  oauthSuccess,
} from '../controllers/auth.controller.js';
import { verifyJWT } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['SEEKER', 'PUBLISHER', 'ADMIN']),
    fullName: z.string(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string(),
    password: z.string().min(6),
  }),
});

const verifyEmailSchema = z.object({
  query: z.object({
    token: z.string(),
  }),
});

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication management
 */

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [SEEKER, PUBLISHER, ADMIN]
 *             example:
 *               email: john@example.com
 *               password: password123
 *               fullName: John Doe
 *               role: SEEKER
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       409:
 *         description: User already exists
 */
router.route('/register').post(validate(registerSchema), registerUser);
router.route('/login').post(validate(loginSchema), loginUser);
router.route('/forgot-password').post(validate(forgotPasswordSchema), forgotPassword);
router.route('/reset-password').post(validate(resetPasswordSchema), resetPassword);

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   get:
 *     summary: Verify user email
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The verification token sent via email
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.route('/verify-email').get(validate(verifyEmailSchema), verifyEmail);

// OAuth Routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false }), oauthSuccess);

router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback', passport.authenticate('github', { session: false }), oauthSuccess);

// secured routes
router.route('/logout').post(verifyJWT, logoutUser);
router.route('/refresh-token').post(refreshAccessToken);

export default router;
