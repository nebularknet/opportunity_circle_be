import { ApiResponse } from '../utils/apiResponse.js';
import * as applicationService from '../services/application.service.js';
import * as resourceService from '../services/resource.service.js';
import * as seekerService from '../services/seeker.service.js';
import asyncHandler from '../utils/asyncHandler.js';

const submitApplication = asyncHandler(async (req, res) => {
  const { opportunityId } = req.params;
  const application = await applicationService.submitApplication(
    req.user._id,
    opportunityId,
    req.body
  );

  return res
    .status(201)
    .json(new ApiResponse(201, application, 'Application submitted successfully'));
});

const getMyApplications = asyncHandler(async (req, res) => {
  const applications = await applicationService.getSeekerApplications(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, applications, 'Applications fetched successfully'));
});

const toggleSaveItem = asyncHandler(async (req, res) => {
  const { itemId, itemType } = req.body;
  const result = await resourceService.toggleSaveItem(req.user._id, itemId, itemType);

  return res
    .status(200)
    .json(new ApiResponse(200, result, `Item ${result.saved ? 'saved' : 'unsaved'} successfully`));
});

const getMySavedItems = asyncHandler(async (req, res) => {
  const items = await resourceService.getSavedItems(req.user._id, req.query.itemType);

  return res
    .status(200)
    .json(new ApiResponse(200, items, 'Saved items fetched successfully'));
});

import { uploadToCloudinary } from '../config/cloudinary.js';
import fs from 'fs';

const updateProfile = asyncHandler(async (req, res) => {
  let profileData = { ...req.body };

  if (req.file) {
    const result = await uploadToCloudinary(req.file.path, 'seeker-profiles');
    profileData.profilePhotoUrl = result.secure_url;
    // Remove local temp file
    fs.unlinkSync(req.file.path);
  }

  const user = await seekerService.updateProfile(req.user._id, profileData);

  return res
    .status(200)
    .json(new ApiResponse(200, user, 'Profile updated successfully'));
});

const getMyProfile = asyncHandler(async (req, res) => {
  const profile = await seekerService.getProfile(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, profile, 'Profile fetched successfully'));
});

const updatePreferences = asyncHandler(async (req, res) => {
  const preferences = await seekerService.updatePreferences(req.user._id, req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, preferences, 'Preferences updated successfully'));
});

const completeOnboarding = asyncHandler(async (req, res) => {
  const result = await seekerService.completeOnboarding(req.user._id, req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, result, 'Onboarding completed successfully'));
});

const withdrawApplication = asyncHandler(async (req, res) => {
  const { applicationId } = req.params;
  const result = await applicationService.withdrawApplication(applicationId, req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, result, 'Application withdrawn successfully'));
});

export {
  submitApplication,
  getMyApplications,
  toggleSaveItem,
  getMySavedItems,
  updateProfile,
  getMyProfile,
  updatePreferences,
  completeOnboarding,
  withdrawApplication,
};
