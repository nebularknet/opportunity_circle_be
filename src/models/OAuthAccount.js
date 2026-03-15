import mongoose, { Schema } from 'mongoose';

const oauthAccountSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['GOOGLE', 'GITHUB'],
      required: true,
    },
    providerUserId: {
      type: String,
      required: true,
      index: true,
    },
    accessToken: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient lookup
oauthAccountSchema.index({ provider: 1, providerUserId: 1 }, { unique: true });

export const OAuthAccount = mongoose.model('OAuthAccount', oauthAccountSchema);
