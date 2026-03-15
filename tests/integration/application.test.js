import { expect } from 'chai';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { Application } from '../../src/models/Application.js';
import { PublisherProfile } from '../../src/models/PublisherProfile.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.test' });

describe('Application Integration Tests', function () {
  this.timeout(10000);
  let seekerToken;
  let publisherToken;
  let opportunityId;
  let applicationId;
  let publisherId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opportunity-circle-test');
    }
    
    await User.deleteMany({});
    await Opportunity.deleteMany({});
    await Application.deleteMany({});

    // Register & Login Publisher
    await request(app).post('/api/v1/auth/register').send({
      email: 'pub@app.com',
      password: 'password123',
      role: 'PUBLISHER',
      fullName: 'Publisher App',
    });
    const pubLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'pub@app.com',
      password: 'password123',
    });
    publisherToken = pubLogin.body.data.accessToken;
    publisherId = pubLogin.body.data.user._id;

    // Create Publisher Profile (required for some routes)
    await PublisherProfile.create({
      userId: publisherId,
      organizationName: 'Test Org',
      websiteUrl: 'https://test.org'
    });

    // Create Opportunity
    const oppRes = await request(app)
      .post('/api/v1/opportunities')
      .set('Authorization', `Bearer ${publisherToken}`)
      .send({
        title: { en: 'Test Opportunity' },
        description: { en: 'Test Description' },
        type: 'INTERNSHIP',
        organizationName: 'Test Org',
        location: 'Remote',
        deadline: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      });
    opportunityId = oppRes.body.data._id;

    // Manually set to ACTIVE to bypass admin moderation in tests
    await Opportunity.findByIdAndUpdate(opportunityId, { status: 'ACTIVE' });

    // Register & Login Seeker
    const seekReg = await request(app).post('/api/v1/auth/register').send({
      email: 'seek@app.com',
      password: 'password123',
      role: 'SEEKER',
      fullName: 'Seeker App',
    });
    const seekLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'seek@app.com',
      password: 'password123',
    });
    seekerToken = seekLogin.body.data.accessToken;
  });

  after(async () => {
    await mongoose.connection.close();
  });

  describe('Seeker Application Actions', () => {
    it('should submit an application successfully', async () => {
      const res = await request(app)
        .post(`/api/v1/seekers/opportunities/${opportunityId}/apply`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          resumeUrl: 'https://example.com/resume.pdf',
          notes: 'I am a great candidate',
        });

      expect(res.status).to.equal(201);
      expect(res.body.data.opportunityId.toString()).to.equal(opportunityId.toString());
      expect(res.body.data.status).to.equal('SUBMITTED');
      applicationId = res.body.data._id;
    });

    it('should fail to apply for non-existent opportunity', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/v1/seekers/opportunities/${fakeId}/apply`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          resumeUrl: 'https://example.com/resume.pdf',
        });

      expect(res.status).to.equal(404);
    });

    it('should fetch own applications', async () => {
      const res = await request(app)
        .get('/api/v1/seekers/applications')
        .set('Authorization', `Bearer ${seekerToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.at.least(1);
    });

    it('should withdraw an application', async () => {
      const res = await request(app)
        .post(`/api/v1/seekers/applications/${applicationId}/withdraw`)
        .set('Authorization', `Bearer ${seekerToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.status).to.equal('WITHDRAWN');
    });
  });

  describe('Publisher Application Management', () => {
    it('should fetch applications for an opportunity', async () => {
      const res = await request(app)
        .get(`/api/v1/publishers/opportunities/${opportunityId}/applications`)
        .set('Authorization', `Bearer ${publisherToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
    });

    it('should update application status', async () => {
      // Create a fresh application to update (previous one was withdrawn)
      const submitRes = await request(app)
        .post(`/api/v1/seekers/opportunities/${opportunityId}/apply`)
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          resumeUrl: 'https://example.com/resume2.pdf',
        });
      const newAppId = submitRes.body.data._id;

      const res = await request(app)
        .patch(`/api/v1/publishers/applications/${newAppId}/status`)
        .set('Authorization', `Bearer ${publisherToken}`)
        .send({
          status: 'UNDER_REVIEW',
          notes: 'Moving to next round',
        });

      expect(res.status).to.equal(200);
      expect(res.body.data.status).to.equal('UNDER_REVIEW');
    });
  });
});
