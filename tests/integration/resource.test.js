import { expect } from 'chai';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Resource } from '../../src/models/Resource.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

describe('Resource Integration Tests', function () {
  this.timeout(10000);
  let accessToken;
  let publisherId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Resource.deleteMany({});

    // Register publisher
    await request(app).post('/api/v1/auth/register').send({
      email: 'publisher@resource.com',
      password: 'password123',
      role: 'PUBLISHER',
      fullName: 'Publisher Resource',
    });
    
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'publisher@resource.com',
      password: 'password123',
    });

    accessToken = loginRes.body.data.accessToken;
    publisherId = loginRes.body.data.user._id;
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('should create a new resource', async () => {
    const res = await request(app)
      .post('/api/v1/resources')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: { en: 'New Resource' },
        type: 'ARTICLE',
        description: { en: 'A great article' },
      });

    expect(res.status).to.equal(201);
    expect(res.body.data.title.en).to.equal('New Resource');
  });

  it('should fetch all resources', async () => {
    await Resource.create({
      publisherId,
      title: { en: 'Res 1' },
      type: 'VIDEO',
    });

    const res = await request(app).get('/api/v1/resources');
    expect(res.status).to.equal(200);
    expect(res.body.data.resources).to.be.an('array');
    expect(res.body.data.resources.length).to.equal(1);
  });

  it('should fetch a specific resource by ID', async () => {
    const resource = await Resource.create({
      publisherId,
      title: { en: 'Res 2' },
      type: 'VIDEO',
    });

    const res = await request(app).get(`/api/v1/resources/${resource._id}`);
    expect(res.status).to.equal(200);
    expect(res.body.data.title.en).to.equal('Res 2');
  });

  it('should update a resource', async () => {
    const resource = await Resource.create({
      publisherId,
      title: { en: 'Old Title' },
      type: 'ARTICLE',
    });

    const res = await request(app)
      .patch(`/api/v1/resources/${resource._id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: { en: 'New Title' },
      });

    expect(res.status).to.equal(200);
    expect(res.body.data.title.en).to.equal('New Title');
  });

  it('should delete a resource', async () => {
    const resource = await Resource.create({
      publisherId,
      title: { en: 'To be deleted' },
      type: 'ARTICLE',
    });

    const res = await request(app)
      .delete(`/api/v1/resources/${resource._id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).to.equal(200);
    
    const deletedResource = await Resource.findById(resource._id);
    expect(deletedResource.isDeleted).to.be.true;
  });
});
