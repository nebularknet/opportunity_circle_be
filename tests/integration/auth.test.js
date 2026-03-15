import { expect } from 'chai';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { UserPreference } from '../../src/models/UserPreference.js';
import { PasswordResetToken } from '../../src/models/PasswordResetToken.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: './.env.test' });

describe('Authentication Integration Tests', function () {
  this.timeout(10000);

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opportunity-circle-test');
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await UserPreference.deleteMany({});
    await PasswordResetToken.deleteMany({});
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('should register a new seeker successfully', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'seeker@test.com',
        password: 'password123',
        role: 'SEEKER',
        fullName: 'Seeker Test',
      });

    expect(res.status).to.equal(201);
    expect(res.body.data.email).to.equal('seeker@test.com');
    expect(res.body.data.role).to.equal('SEEKER');
    expect(res.body.data).to.not.have.property('password');

    // Verify preferences were created
    const preferences = await UserPreference.findOne({ userId: res.body.data._id });
    expect(preferences).to.not.be.null;
  });

  it('should login a registered user', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@test.com',
        password: 'password123',
        role: 'SEEKER',
        fullName: 'Test User',
      });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@test.com',
        password: 'password123',
      });

    expect(res.status).to.equal(200);
    expect(res.body.data).to.have.property('accessToken');
    expect(res.body.data).to.have.property('refreshToken');
    expect(res.body.data.user.email).to.equal('test@test.com');
  });

  it('should fail login with incorrect password', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@test.com',
        password: 'password123',
        role: 'SEEKER',
        fullName: 'Test User',
      });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@test.com',
        password: 'wrongpassword',
      });

    expect(res.status).to.equal(401);
  });

  it('should logout a user', async () => {
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'logout@test.com',
        password: 'password123',
        role: 'SEEKER',
        fullName: 'Logout User',
      });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'logout@test.com',
        password: 'password123',
      });

    const accessToken = loginRes.body.data.accessToken;

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send();

    expect(res.status).to.equal(200);
    
    // Verify refresh token is cleared in DB
    const user = await User.findOne({ email: 'logout@test.com' });
    expect(user.refreshToken).to.be.undefined;
  });

  it('should refresh access token', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'refresh@test.com',
        password: 'password123',
        role: 'SEEKER',
        fullName: 'Refresh User',
      });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'refresh@test.com',
        password: 'password123',
      });

    const refreshToken = loginRes.body.data.refreshToken;

    const res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken });

    expect(res.status).to.equal(200);
    expect(res.body.data).to.have.property('accessToken');
    expect(res.body.data).to.have.property('refreshToken');
  });

  it('should fail login for non-existent user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@test.com',
        password: 'password123',
      });

    expect(res.status).to.equal(404);
  });

  it('should fail refresh token if token is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: 'invalidtoken' });

    expect(res.status).to.equal(401);
  });

  it('should fail refresh token if token is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({});

    expect(res.status).to.equal(401);
  });

  it('should handle OAuth login via service (internal)', async () => {
    const { processOAuthLogin } = await import('../../src/services/auth.service.js');
    
    const email = 'oauth@test.com';
    // Create user first
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'password123',
        role: 'SEEKER',
        fullName: 'OAuth User',
      });

    // Existing user OAuth (login/link)
    const loginResult = await processOAuthLogin({
      provider: 'google',
      providerUserId: 'google123',
      email,
    });
    expect(loginResult.user.email).to.equal(email);
    expect(loginResult).to.have.property('accessToken');
  });

  it('should handle forgot and reset password flow', async () => {
    const email = 'reset@test.com';
    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'password123',
        role: 'SEEKER',
        fullName: 'Reset User',
      });
    const userId = registerRes.body.data._id;

    // Manually create a reset token in DB for testing
    const token = 'mytesecrettoken123';
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    await PasswordResetToken.create({
      userId,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
    });

    // Reset password using the plain token
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token,
        password: 'newpassword123',
      });

    expect(resetRes.status).to.equal(200);

    // Verify login with new password
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email,
        password: 'newpassword123',
      });
    
    expect(loginRes.status).to.equal(200);
  });
});
