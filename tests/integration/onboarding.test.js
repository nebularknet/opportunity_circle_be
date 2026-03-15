import { expect } from 'chai';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

describe('Seeker Onboarding Integration Tests', () => {
  let token;
  let userId;

  before(async function() {
    this.timeout(10000);
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opportunity-circle-test');
    }
    await User.deleteMany({});
    const user = await User.create({
      fullName: 'Test Seeker',
      email: 'seeker@example.com',
      password: 'password123',
      role: 'SEEKER',
      isEmailVerified: true
    });
    userId = user._id;
    token = jwt.sign({ _id: userId, role: 'SEEKER' }, process.env.JWT_ACCESS_SECRET || 'your_super_secret_access_key_min_32_chars_long', { expiresIn: '1h' });
  });

  after(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/v1/seekers/onboarding', () => {
    it('should mark onboarding as completed', async () => {
      const res = await request(app)
        .post('/api/v1/seekers/onboarding')
        .set('Authorization', `Bearer ${token}`)
        .send({ onboardingCompleted: true });

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.user.onboardingCompleted).to.be.true;

      const updatedUser = await User.findById(userId);
      expect(updatedUser.onboardingCompleted).to.be.true;
    });
  });

  describe('PATCH /api/v1/seekers/preferences', () => {
    it('should update seeker preferences', async () => {
      const preferences = {
        interestedTypes: ['INTERNSHIP', 'EVENT'],
        targetLocations: ['Remote', 'New York'],
        fieldOfStudy: 'Computer Science',
        emailNotifications: true
      };

      const res = await request(app)
        .patch('/api/v1/seekers/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send(preferences);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.interestedTypes).to.include('INTERNSHIP');
      expect(res.body.data.fieldOfStudy).to.equal('Computer Science');
    });
  });
});
