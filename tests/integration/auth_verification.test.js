import { expect } from 'chai';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { EmailVerificationToken } from '../../src/models/EmailVerificationToken.js';
import crypto from 'crypto';
import mongoose from 'mongoose';

describe('Auth Email Verification Integration Tests', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    fullName: 'Test User',
    role: 'SEEKER',
  };

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and create a verification token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(res.status).to.equal(201);
      expect(res.body.data.email).to.equal(testUser.email);
      expect(res.body.data.isEmailVerified).to.be.false;

      const user = await User.findOne({ email: testUser.email });
      expect(user).to.exist;

      const tokenDoc = await EmailVerificationToken.findOne({ userId: user._id });
      expect(tokenDoc).to.exist;
      expect(tokenDoc.used).to.be.false;
    });
  });

  describe('GET /api/v1/auth/verify-email', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const user = await User.create(testUser);
      userId = user._id;
      const rawToken = crypto.randomBytes(32).toString('hex');
      token = rawToken;
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      await EmailVerificationToken.create({
        userId: user._id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 3600000),
      });
    });

    it('should verify email with valid token', async () => {
      const res = await request(app)
        .get(`/api/v1/auth/verify-email?token=${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.message).to.equal('Email verified successfully');

      const user = await User.findById(userId);
      expect(user.isEmailVerified).to.be.true;

      const tokenDoc = await EmailVerificationToken.findOne({ userId });
      expect(tokenDoc.used).to.be.true;
    });

    it('should return 400 for invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/verify-email?token=invalidtoken');

      expect(res.status).to.equal(400);
    });

    it('should return 400 for expired token', async () => {
      await EmailVerificationToken.findOneAndUpdate(
        { userId },
        { expiresAt: new Date(Date.now() - 3600000) }
      );

      const res = await request(app)
        .get(`/api/v1/auth/verify-email?token=${token}`);

      expect(res.status).to.equal(400);
    });
  });
});
