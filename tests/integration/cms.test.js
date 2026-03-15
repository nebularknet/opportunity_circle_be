import { expect } from 'chai';
import request from 'supertest';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { CmsPage } from '../../src/models/CmsPage.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

describe('CMS Integration Tests', function () {
  this.timeout(10000);
  let accessToken;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await CmsPage.deleteMany({});

    // Register admin
    await request(app).post('/api/v1/auth/register').send({
      email: 'admin@cms.com',
      password: 'password123',
      role: 'ADMIN',
      fullName: 'Admin CMS',
    });
    
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@cms.com',
      password: 'password123',
    });

    accessToken = loginRes.body.data.accessToken;

    // Create a sample page
    await CmsPage.create({
      pageKey: 'home',
      title: { en: 'Home Page' },
      mainHeading: { en: 'Welcome' },
    });
  });

  after(async () => {
    await mongoose.connection.close();
  });

  it('should fetch all CMS pages', async () => {
    const res = await request(app).get('/api/v1/cms');
    expect(res.status).to.equal(200);
    expect(res.body.data).to.be.an('array');
    expect(res.body.data[0].pageKey).to.equal('home');
  });

  it('should fetch a specific CMS page by key', async () => {
    const res = await request(app).get('/api/v1/cms/home');
    expect(res.status).to.equal(200);
    expect(res.body.data.pageKey).to.equal('home');
  });

  it('should update a CMS page as admin', async () => {
    const res = await request(app)
      .patch('/api/v1/cms/home')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        mainHeading: { en: 'New Heading' },
      });

    expect(res.status).to.equal(200);
    expect(res.body.data.mainHeading.en).to.equal('New Heading');
  });
});
