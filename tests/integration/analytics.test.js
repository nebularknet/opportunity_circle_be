import { expect } from 'chai';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { PublisherProfile } from '../../src/models/PublisherProfile.js';
import { OpportunityView } from '../../src/models/OpportunityView.js';
import { Application } from '../../src/models/Application.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.test' });

describe('Analytics Integration Tests', function () {
  this.timeout(10000);
  let accessToken;
  let publisherId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opportunity-circle-test');
    }
    
    await User.deleteMany({});
    await Opportunity.deleteMany({});
    await OpportunityView.deleteMany({});
    await Application.deleteMany({});

    // Register & Login Publisher
    await request(app).post('/api/v1/auth/register').send({
      email: 'analytics@test.com', 
      password: 'password123', 
      role: 'PUBLISHER', 
      fullName: 'Analytics Test'
    });
    
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'analytics@test.com', 
      password: 'password123'
    });

    accessToken = loginRes.body.data.accessToken;
    publisherId = loginRes.body.data.user._id;

    await PublisherProfile.create({
      userId: publisherId,
      organizationName: 'Analytics Org',
      verified: true
    });
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('should calculate correct engagement rate and verified programs', async () => {
    // Create 2 active opportunities
    const opp1 = await Opportunity.create({
      publisherId, 
      type: 'INTERNSHIP', 
      title: { en: 'Opp 1' }, 
      organizationName: 'Org 1',
      description: { en: 'Desc' }, 
      location: 'Remote', 
      status: 'ACTIVE',
      deadline: new Date(Date.now() + 86400000)
    });
    const opp2 = await Opportunity.create({
      publisherId, 
      type: 'SCHOLARSHIP', 
      title: { en: 'Opp 2' }, 
      organizationName: 'Org 2',
      description: { en: 'Desc' }, 
      location: 'Remote', 
      status: 'ACTIVE',
      deadline: new Date(Date.now() + 86400000)
    });

    // Add 2 views to opp1, 1 view to opp2
    await OpportunityView.create({ opportunityId: opp1._id });
    await OpportunityView.create({ opportunityId: opp1._id });
    await OpportunityView.create({ opportunityId: opp2._id });

    // Add 1 applicant to opp1
    await Application.create({
      opportunityId: opp1._id,
      userId: new mongoose.Types.ObjectId(),
      status: 'SUBMITTED'
    });

    // Total Views = 3, Total Applicants = 1, Total Active = 2
    // Engagement Rate = (3 + 1) / 2 = 2.0

    const res = await request(app)
      .get('/api/v1/publishers/dashboard/stats')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).to.equal(200);
    expect(res.body.data.engagementRate).to.equal(2.0);
    expect(res.body.data.verifiedProgramsCount).to.equal(2);
    expect(res.body.data.activeListingsCount).to.equal(2);
  });
});
