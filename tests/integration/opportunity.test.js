import { expect } from 'chai';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import { PublisherProfile } from '../../src/models/PublisherProfile.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.test' });

describe('Opportunity Integration Tests', function () {
  this.timeout(10000);
  let accessToken;
  let publisherId;

  before(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/opportunity-circle-test');
    }
    
    // Cleanup
    await User.deleteMany({});
    await Opportunity.deleteMany({});

    // Create a publisher
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'publisher@test.com',
        password: 'password123',
        role: 'PUBLISHER',
        fullName: 'Pub Test',
      });
    
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'publisher@test.com',
        password: 'password123',
      });

    accessToken = loginRes.body.data.accessToken;
    publisherId = loginRes.body.data.user._id;

    await PublisherProfile.create({
      userId: publisherId,
      organizationName: 'Test Publisher',
    });
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('should create a new opportunity', async () => {
    const res = await request(app)
      .post('/api/v1/opportunities')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'INTERNSHIP',
        title: { en: 'Test Internship' },
        organizationName: 'Test Organization',
        description: { en: 'This is a test' },
        location: 'Remote',
        deadline: new Date(Date.now() + 86400000).toISOString(),
      });

    expect(res.status).to.equal(201);
    expect(res.body.data.title.en).to.equal('Test Internship');
  });

  it('should fetch all active opportunities with filters', async () => {
    // Create an active opportunity directly in DB
    await Opportunity.create({
      publisherId,
      type: 'SCHOLARSHIP',
      title: { en: 'Scholarship Alpha' },
      organizationName: 'Alpha Academy',
      description: { en: 'Scholarship description' },
      location: 'Berlin',
      status: 'ACTIVE',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      searchTokens: ['scholarship', 'alpha', 'academy']
    });

    const res = await request(app)
      .get('/api/v1/opportunities')
      .query({ type: 'SCHOLARSHIP', location: 'Berlin' });

    expect(res.status).to.equal(200);
    expect(res.body.data.opportunities).to.be.an('array');
    expect(res.body.data.opportunities.length).to.be.at.least(1);
    expect(res.body.data.opportunities[0].type).to.equal('SCHOLARSHIP');
  });

  it('should include isVerified status from publisher profile', async () => {
    // Update publisher to be verified
    await PublisherProfile.findOneAndUpdate({ userId: publisherId }, { verified: true });

    // Create an opportunity
    await Opportunity.create({
      publisherId,
      type: 'FELLOWSHIP',
      title: { en: 'Verified Fellowship' },
      organizationName: 'Verified Org',
      description: { en: 'Desc' },
      location: 'Remote',
      status: 'ACTIVE',
      deadline: new Date(Date.now() + 86400000).toISOString(),
    });

    const res = await request(app).get('/api/v1/opportunities').query({ search: 'Verified' });

    expect(res.status).to.equal(200);
    const verifiedOpp = res.body.data.opportunities.find(o => o.title.en === 'Verified Fellowship');
    expect(verifiedOpp.isVerified).to.be.true;
  });

  it('should fail to update opportunity if not the owner', async () => {
    const otherOpp = await Opportunity.create({
      publisherId: new mongoose.Types.ObjectId(),
      type: 'FELLOWSHIP',
      title: { en: 'Other Fellowship' },
      organizationName: 'Other Org',
      description: { en: 'Other desc' },
      location: 'London',
      status: 'ACTIVE',
      deadline: new Date(Date.now() + 86400000).toISOString(),
    });

    const res = await request(app)
      .patch(`/api/v1/opportunities/${otherOpp._id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ location: 'Paris' });

    expect(res.status).to.equal(404); // or 403 depending on implementation
  });

  it('should get opportunity by ID', async () => {
    const opp = await Opportunity.create({
      publisherId,
      type: 'EVENT',
      title: { en: 'Tech Event' },
      organizationName: 'Tech Org',
      description: { en: 'Event desc' },
      location: 'San Francisco',
      status: 'ACTIVE',
      deadline: new Date(Date.now() + 86400000).toISOString(),
    });

    const res = await request(app).get(`/api/v1/opportunities/${opp._id}`);
    expect(res.status).to.equal(200);
    expect(res.body.data.title.en).to.equal('Tech Event');
  });
});
