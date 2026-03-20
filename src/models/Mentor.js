import mongoose, { Schema } from 'mongoose';

const mentorSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    photoUrl: {
      type: String, // Cloudinary URL
    },
    designation: {
      type: String,
      trim: true,
    },
    organization: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Mentor = mongoose.model('Mentor', mentorSchema);
