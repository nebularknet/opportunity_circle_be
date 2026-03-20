import { Router } from 'express';
import {
  getModerationQueue,
  updateOpportunityStatus,
  getDashboardStats,
  getAllUsers,
  toggleUserStatus,
  verifyPublisher,
  updateAdminProfile,
  getAdminProfile,
  getUserDetails,
} from '../controllers/admin.controller.js';
import { verifyJWT, authorizeRoles } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();

const statusUpdateSchema = z.object({
  body: z.object({
    status: z.enum(['ACTIVE', 'REJECTED']),
    reason: z.string().optional(),
  }),
});

router.use(verifyJWT);
router.use(authorizeRoles('ADMIN'));

router.route('/stats').get(getDashboardStats);
router.route('/profile').get(getAdminProfile).patch(updateAdminProfile);
router.route('/users').get(getAllUsers);
router.route('/users/:id').get(getUserDetails);
router.route('/users/:id/status').patch(toggleUserStatus);
router.route('/publishers/:userId/verify').patch(verifyPublisher);
router.route('/moderation-queue').get(getModerationQueue);
router.route('/opportunities/:id/status').patch(validate(statusUpdateSchema), updateOpportunityStatus);

export default router;
