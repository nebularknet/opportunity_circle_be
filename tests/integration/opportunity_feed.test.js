import { expect } from 'chai';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { SavedItem } from '../../src/models/SavedItem.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

describe('Opportunity Feed & Saved Items Integration Tests', () => {
  let token;
  let userId;
  let opportunityId;

  before(async function() {
    this.timeout(10000);
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opportunity-circle-test');
    }
    
    await User.deleteMany({});
    await Opportunity.deleteMany({});
    await SavedItem.deleteMany({});

    const user = await User.create({
      fullName: 'Test Seeker',
      email: 'seeker@example.com',
      password: 'password123',
      role: 'SEEKER',
      isEmailVerified: true
    });
    userId = user._id;
    token = jwt.sign({ _id: userId, role: 'SEEKER' }, process.env.JWT_ACCESS_SECRET || 'your_super_secret_access_key_min_32_chars_long', { expiresIn: '1h' });

    const opp = await Opportunity.create({
      title: { en: 'Test Internship' },
      organizationName: 'Test Org',
      type: 'INTERNSHIP',
      location: 'Remote',
      description: { en: 'A test internship' },
      deadline: new Date(),
      publisherId: new mongoose.Types.ObjectId(),
      status: 'ACTIVE'
    });
    opportunityId = opp._id;
  });

  after(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/v1/opportunities', () => {
    it('should fetch all opportunities', async () => {
      const res = await request(app)
        .get('/api/v1/opportunities')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.opportunities).to.be.an('array');
      expect(res.body.data.opportunities.length).to.be.at.least(1);
    });

    it('should filter by type', async () => {
      const res = await request(app)
        .get('/api/v1/opportunities?type=INTERNSHIP')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.opportunities[0].type).to.equal('INTERNSHIP');
    });
  });

  describe('POST /api/v1/seekers/toggle-save', () => {
    it('should save an opportunity', async () => {
      const res = await request(app)
        .post('/api/v1/seekers/toggle-save')
        .set('Authorization', `Bearer ${token}`)
        .send({ itemId: opportunityId, itemType: 'OPPORTUNITY' });

      expect(res.status).to.equal(200);
      expect(res.body.data.saved).to.be.true;

      const saved = await SavedItem.findOne({ userId, opportunityId });
      expect(saved).to.not.be.null;
    });

    it('should unsave an opportunity', async () => {
      const res = await request(app)
        .post('/api/v1/seekers/toggle-save')
        .set('Authorization', `Bearer ${token}`)
        .send({ itemId: opportunityId, itemType: 'OPPORTUNITY' });

      expect(res.status).to.equal(200);
      expect(res.body.data.saved).to.be.false;

      const saved = await SavedItem.findOne({ userId, opportunityId });
      expect(saved).to.be.null;
    });
  });
});
