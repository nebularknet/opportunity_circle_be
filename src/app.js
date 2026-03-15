import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import passport from 'passport';
import './config/passport.js';
import correlationMiddleware from './middleware/correlation.js';
import errorHandler from './middleware/error.js';
import rateLimit from 'express-rate-limit';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
}));

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

app.use(correlationMiddleware);

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later.',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per 15 minutes
  message: 'Too many login attempts from this IP, please try again later.',
});

// Apply limiters
app.use('/api', generalLimiter);
app.use('/api/v1/auth', authLimiter);

app.use(passport.initialize());

// routes import
import authRouter from './api/authRoutes.js';
import opportunityRouter from './api/opportunityRoutes.js';
import seekerRouter from './api/seekerRoutes.js';
import publisherRouter from './api/publisherRoutes.js';
import mentorRouter from './api/mentorRoutes.js';
import cmsRouter from './api/cmsRoutes.js';
import resourceRouter from './api/resourceRoutes.js';
import { specs, swaggerUi } from './config/swagger.js';

// routes declaration
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/opportunities', opportunityRouter);
app.use('/api/v1/seekers', seekerRouter);
app.use('/api/v1/publishers', publisherRouter);
app.use('/api/v1/mentors', mentorRouter);
app.use('/api/v1/cms', cmsRouter);
app.use('/api/v1/resources', resourceRouter);

// http://localhost:5000/api/v1/auth/register

app.use(errorHandler);

export { app };
