import { Router } from 'express';
import {
  submitApplication,
  getMyApplications,
  toggleSaveItem,
  getMySavedItems,
  updateProfile,
  getMyProfile,
  updatePreferences,
  completeOnboarding,
  withdrawApplication,
} from '../controllers/seeker.controller.js';
import { verifyJWT, authorizeRoles } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();

const applicationSchema = z.object({
  body: z.object({
    resumeUrl: z.string().url().optional(),
    notes: z.string().optional(),
  }),
});

const saveItemSchema = z.object({
  body: z.object({
    itemId: z.string(),
    itemType: z.enum(['RESOURCE', 'OPPORTUNITY']),
  }),
});

const profileUpdateSchema = z.object({
  body: z.object({
    fullName: z.string().optional(),
    username: z.string().optional(),
    profileTag: z.string().optional(),
    phoneNumber: z.string().optional(),
    bio: z.string().optional(),
    country: z.string().optional(),
    location: z.string().optional(),
    education: z.string().optional(),
    fieldOfStudy: z.string().optional(),
    degreeLevel: z.enum(['UNDERGRADUATE', 'GRADUATE', 'PHD', 'OTHER']).nullable().optional(),
    isProfileVisible: z.boolean().optional(),
  }),
});

const preferencesUpdateSchema = z.object({
  body: z.object({
    interestedTypes: z.array(z.enum(['INTERNSHIP', 'SCHOLARSHIP', 'FELLOWSHIP', 'EVENT', 'WORKSHOP'])).optional(),
    targetLocations: z.array(z.string()).optional(),
    fieldOfStudy: z.string().optional(),
    pushNotifications: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    weeklyDigest: z.boolean().optional(),
    employeeType: z.string().optional(),
  }),
});

import { upload } from '../middleware/multer.js';

router.use(verifyJWT);
router.use(authorizeRoles('SEEKER'));

router.route('/profile').get(getMyProfile).patch(upload.single('profilePhoto'), validate(profileUpdateSchema), updateProfile);
router.route('/preferences').patch(validate(preferencesUpdateSchema), updatePreferences);
router.route('/onboarding').post(completeOnboarding);

router.route('/applications').get(getMyApplications);
router.route('/applications/:applicationId/withdraw').post(withdrawApplication);
router.route('/opportunities/:opportunityId/apply').post(validate(applicationSchema), submitApplication);
router.route('/saved-items').get(getMySavedItems);
router.route('/toggle-save').post(validate(saveItemSchema), toggleSaveItem);

export default router;
