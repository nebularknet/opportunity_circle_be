import { expect } from 'chai';
import { verifyJWT, optionalJWT, authorizeRoles } from '../../src/middleware/auth.js';
import validate from '../../src/middleware/validate.js';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { User } from '../../src/models/User.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './.env.test' });

describe('Middleware Unit Tests', () => {
  describe('authorizeRoles', () => {
    it('should allow access if role matches', () => {
      const req = { user: { role: 'ADMIN' } };
      const next = () => {};
      const middleware = authorizeRoles('ADMIN');
      expect(() => middleware(req, {}, next)).to.not.throw();
    });

    it('should throw 401 if user is missing', () => {
      const req = {};
      const next = () => {};
      const middleware = authorizeRoles('ADMIN');
      expect(() => middleware(req, {}, next)).to.throw(/Authentication required/);
    });

    it('should throw 403 if role does not match', () => {
      const req = { user: { role: 'SEEKER' } };
      const next = () => {};
      const middleware = authorizeRoles('ADMIN');
      expect(() => middleware(req, {}, next)).to.throw(/not allowed/);
    });
  });

  describe('validate middleware', () => {
    const schema = z.object({
      body: z.object({
        name: z.string().min(3),
      }),
    });

    it('should pass if data is valid', () => {
      const req = { body: { name: 'John' }, query: {}, params: {} };
      const next = () => {};
      const middleware = validate(schema);
      expect(() => middleware(req, {}, next)).to.not.throw();
    });

    it('should throw 400 if data is invalid', () => {
      const req = { body: { name: 'Jo' }, query: {}, params: {} };
      const next = () => {};
      const middleware = validate(schema);
      expect(() => middleware(req, {}, next)).to.throw();
    });
  });

  describe('optionalJWT', () => {
    it('should proceed if no token is provided', (done) => {
      const req = { header: () => null };
      const next = () => {
        expect(req.user).to.be.undefined;
        done();
      };
      optionalJWT(req, {}, next);
    });
  });
});
