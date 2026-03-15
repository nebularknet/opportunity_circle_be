import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import { app } from './app.js';
import logger from './utils/logger.js';
import initCronJobs from './utils/cron.js';

dotenv.config({
  path: './.env',
});

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

initCronJobs();

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Store io in app for access in controllers/services
app.set('io', io);

io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);

  socket.on('join', (userId) => {
    socket.join(userId);
    logger.info(`User ${userId} joined their private room`);
  });

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      logger.info(`Server is running at port http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('MONGO db connection failed !!! ', err);
  });

export { io };
