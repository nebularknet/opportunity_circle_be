import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - fullName
 *         - email
 *         - role
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the user
 *         fullName:
 *           type: string
 *           description: Full name of the user
 *         email:
 *           type: string
 *           format: email
 *           description: Email address of the user (must be unique)
 *         username:
 *           type: string
 *           description: Unique username (optional)
 *         role:
 *           type: string
 *           enum: [SEEKER, PUBLISHER, ADMIN]
 *           default: SEEKER
 *         profilePhotoUrl:
 *           type: string
 *         bgCoverPhotoUrl:
 *           type: string
 *         phoneNumber:
 *           type: string
 *         bio:
 *           type: string
 *         country:
 *           type: string
 *         location:
 *           type: string
 *         education:
 *           type: string
 *         fieldOfStudy:
 *           type: string
 *         degreeLevel:
 *           type: string
 *           enum: [UNDERGRADUATE, GRADUATE, PHD, OTHER, null]
 *         isProfileVisible:
 *           type: boolean
 *         isEmailVerified:
 *           type: boolean
 *         onboardingCompleted:
 *           type: boolean
 *         isOAuthUser:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         fullName: John Doe
 *         email: john@example.com
 *         role: SEEKER
 *         isEmailVerified: false
 */
const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: function() {
        // Only required if no OAuth provider is linked
        return !this.isOAuthUser;
      }
    },
    role: {
      type: String,
      enum: ['SEEKER', 'PUBLISHER', 'ADMIN'],
      default: 'SEEKER',
      required: true,
    },
    profileTag: {
      type: String,
      trim: true,
    },
    profilePhotoUrl: {
      type: String,
    },
    bgCoverPhotoUrl: {
      type: String,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    education: {
      type: String,
      trim: true,
    },
    fieldOfStudy: {
      type: String,
      trim: true,
    },
    degreeLevel: {
      type: String,
      enum: ['UNDERGRADUATE', 'GRADUATE', 'PHD', 'OTHER', null],
      default: null,
    },
    isProfileVisible: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    isOAuthUser: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

export const User = mongoose.model('User', userSchema);
