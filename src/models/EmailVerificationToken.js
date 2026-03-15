import mongoose, { Schema } from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     EmailVerificationToken:
 *       type: object
 *       required:
 *         - userId
 *         - token
 *         - expiresAt
 *       properties:
 *         userId:
 *           type: string
 *           description: ID of the user the token belongs to
 *         token:
 *           type: string
 *           description: Hashed verification token
 *         used:
 *           type: boolean
 *           default: false
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Token expiration time
 */
const emailVerificationTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '0s' }, // Auto-delete on expiry
    },
  },
  {
    timestamps: true,
  }
);

export const EmailVerificationToken = mongoose.model('EmailVerificationToken', emailVerificationTokenSchema);
