import { ApiResponse } from '../utils/apiResponse.js';
import * as mentorService from '../services/mentor.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

const createMentor = asyncHandler(async (req, res) => {
  const mentor = await mentorService.createMentor(req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, mentor, 'Mentor created successfully'));
});

const getMentors = asyncHandler(async (req, res) => {
  const mentors = await mentorService.getMentors();

  return res
    .status(200)
    .json(new ApiResponse(200, mentors, 'Mentors fetched successfully'));
});

const linkMentorToWorkshop = asyncHandler(async (req, res) => {
  const { opportunityId, mentorId } = req.body;
  const result = await mentorService.linkMentorToWorkshop(opportunityId, mentorId);

  return res
    .status(200)
    .json(new ApiResponse(200, result, 'Mentor linked to workshop successfully'));
});

/**
 * Toggle mentor active/locked status
 * PATCH /api/mentors/:id/status
 */
const toggleMentorStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const mentor = await mentorService.getMentorById(id);

  mentor.isActive = !mentor.isActive;
  await mentor.save();

  return res.status(200).json(new ApiResponse(200, mentor, `Mentor ${mentor.isActive ? 'activated' : 'locked'} successfully`));
});

/**
 * Toggle mentor verification status
 * PATCH /api/mentors/:id/verify
 */
const updateMentorVerification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const mentor = await mentorService.getMentorById(id);

  mentor.isVerified = !mentor.isVerified;
  await mentor.save();

  return res.status(200).json(new ApiResponse(200, mentor, `Mentor ${mentor.isVerified ? 'verified' : 'unverified'} successfully`));
});

export {
  createMentor,
  getMentors,
  linkMentorToWorkshop,
  toggleMentorStatus,
  updateMentorVerification,
};
