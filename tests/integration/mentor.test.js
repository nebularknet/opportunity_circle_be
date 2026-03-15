import { expect } from 'chai';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Mentor } from '../../src/models/Mentor.js';
import { Opportunity } from '../../src/models/Opportunity.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

describe('Mentor Integration Tests', function () {
  this.timeout(10000);
  let accessToken;
  let adminId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Mentor.deleteMany({});
    await Opportunity.deleteMany({});

    // Register admin
    await request(app).post('/api/v1/auth/register').send({
      email: 'admin@test.com',
      password: 'password123',
      role: 'ADMIN',
      fullName: 'Admin Test',
    });
    
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'password123',
    });

    accessToken = loginRes.body.data.accessToken;
    adminId = loginRes.body.data.user._id;
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('should create a new mentor', async () => {
    const res = await request(app)
      .post('/api/v1/mentors')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'John Doe',
        designation: 'Senior Engineer',
        organization: 'Tech Corp',
      });

    expect(res.status).to.equal(201);
    expect(res.body.data.name).to.equal('John Doe');
  });

  it('should get all mentors', async () => {
    await Mentor.create({ name: 'Jane Doe' });

    const res = await request(app).get('/api/v1/mentors');

    expect(res.status).to.equal(200);
    expect(res.body.data).to.be.an('array');
    expect(res.body.data[0].name).to.equal('Jane Doe');
  });

  it('should link a mentor to a workshop (opportunity)', async () => {
    const mentor = await Mentor.create({ name: 'Mentor X' });
    const workshop = await Opportunity.create({
      publisherId: adminId,
      type: 'WORKSHOP',
      title: { en: 'Workshop Y' },
      organizationName: 'Org Z',
      description: { en: 'Desc' },
      location: 'Online',
      deadline: new Date(Date.now() + 86400000).toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/mentors/link')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        mentorId: mentor._id.toString(),
        opportunityId: workshop._id.toString(),
      });

    expect(res.status).to.equal(200);
    expect(res.body.message).to.contain('linked');
  });
});
