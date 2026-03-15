import { expect } from 'chai';
import request from 'supertest';
import { app } from '../../src/app.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.test' });

describe('Swagger Documentation Tests', () => {
  it('should serve the swagger json', async () => {
    const res = await request(app).get('/api-docs.json');
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('openapi');
    expect(res.body.info.title).to.equal('Opportunity Circle API');
  });

  it('should serve the swagger UI', async () => {
    const res = await request(app).get('/api-docs');
    expect(res.status).to.equal(301); // Redirects to /api-docs/
  });

  it('should serve the swagger UI with trailing slash', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).to.equal(200);
    expect(res.text).to.include('swagger-ui');
  });
});
