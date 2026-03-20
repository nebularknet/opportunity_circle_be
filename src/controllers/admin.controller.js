import { ApiResponse } from '../utils/apiResponse.js';
import * as opportunityService from '../services/opportunity.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { User } from '../models/User.js';
import { Opportunity } from '../models/Opportunity.js';
import { PublisherProfile } from '../models/PublisherProfile.js';

/**
 * Get all pending opportunities for moderation
 * GET /api/admin/moderation-queue
 */
const getModerationQueue = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  const result = await opportunityService.getAllOpportunities(
    { status: 'PENDING' },
    { page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, result, 'Moderation queue fetched successfully'));
});

/**
 * Approve or reject an opportunity
 * PATCH /api/admin/opportunities/:id/status
 */
const updateOpportunityStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!['ACTIVE', 'REJECTED'].includes(status)) {
    throw new ApiError(400, 'Invalid status for moderation. Use ACTIVE or REJECTED.');
  }

  const opportunity = await opportunityService.updateOpportunityStatus(id, status);

  // TODO: Send notification to publisher with reason if rejected

  return res
    .status(200)
    .json(new ApiResponse(200, opportunity, `Opportunity ${status === 'ACTIVE' ? 'approved' : 'rejected'} successfully`));
});

/**
 * Get platform-wide statistics for the admin dashboard
 * GET /api/admin/stats
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalSeekers,
    totalPublishers,
    liveOpportunities,
    pendingOpportunities,
    recentUsers,
    recentOpportunities
  ] = await Promise.all([
    User.countDocuments({ role: 'SEEKER' }),
    User.countDocuments({ role: 'PUBLISHER' }),
    Opportunity.countDocuments({ status: 'ACTIVE' }),
    Opportunity.countDocuments({ status: 'PENDING' }),
    User.find({ role: { $ne: 'ADMIN' } })
      .select('fullName email role createdAt profilePhotoUrl')
      .sort({ createdAt: -1 })
      .limit(5),
    Opportunity.find({})
      .sort({ createdAt: -1 })
      .limit(5)
  ]);

  return res.status(200).json(new ApiResponse(200, {
    totalSeekers,
    totalPublishers,
    liveOpportunities,
    pendingOpportunities,
    recentUsers,
    recentOpportunities
  }, 'Dashboard stats fetched successfully'));
});

/**
 * Get all registered users with optional role filter and pagination
 * GET /api/admin/users
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 20, search = '' } = req.query;
  const match = { role: { $ne: 'ADMIN' } };
  
  if (role && role !== 'ALL') {
    match.role = role;
  }

  if (search) {
    match.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const result = await User.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $skip: skip },
          { $limit: Number(limit) },
          {
            $lookup: {
              from: 'publisherprofiles',
              localField: '_id',
              foreignField: 'userId',
              as: 'publisherProfile'
            }
          },
          {
            $addFields: {
              publisherProfile: { $arrayElemAt: ['$publisherProfile', 0] }
            }
          },
          { $project: { password: 0, refreshToken: 0 } }
        ]
      }
    }
  ]);

  const users = result[0].data;
  const total = result[0].metadata[0]?.total || 0;
    
  return res.status(200).json(new ApiResponse(200, {
    users,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit))
  }, 'Users fetched successfully'));
});

/**
 * Toggle user status (suspend/activate)
 * PATCH /api/admin/users/:id/status
 */
const toggleUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Toggle deletedAt as a way to suspend
  user.deletedAt = user.deletedAt ? null : new Date();
  await user.save();

  return res.status(200).json(new ApiResponse(200, user, `User ${user.deletedAt ? 'suspended' : 'activated'} successfully`));
});

/**
 * Verify a publisher organization (Robust version with upsert)
 * PATCH /api/admin/publishers/:userId/verify
 */
const verifyPublisher = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body; // 'TRUSTED' or 'PENDING'

  // First, verify the user exists and is a publisher
  const user = await User.findById(userId);
  if (!user || user.role !== 'PUBLISHER') {
    throw new ApiError(403, 'Invalid user for publisher verification');
  }

  // Find or create profile
  const profile = await PublisherProfile.findOneAndUpdate(
    { userId },
    { 
      moderationStatus: status, 
      verified: status === 'TRUSTED',
      // If we are creating it, we need a default organizationName
      $setOnInsert: { organizationName: user.fullName || 'Pending Organization' }
    },
    { new: true, upsert: true }
  );

  return res.status(200).json(new ApiResponse(200, profile, `Publisher status updated to ${status}`));
});

/**
 * Get Admin's own profile
 * GET /api/admin/profile
 */
const getAdminProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password -refreshToken');
  if (!user) {
    throw new ApiError(404, 'Admin user not found');
  }
  return res.status(200).json(new ApiResponse(200, user, 'Admin profile fetched successfully'));
});

/**
 * Update Admin's own profile
 * PATCH /api/admin/profile
 */
const updateAdminProfile = asyncHandler(async (req, res) => {
  const { fullName, email, profilePhotoUrl } = req.body;
  
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullName,
        email,
        profilePhotoUrl
      }
    },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

  if (!user) {
    throw new ApiError(404, 'Admin user not found');
  }

  return res.status(200).json(new ApiResponse(200, user, 'Admin profile updated successfully'));
});

/**
 * Get full details of a specific user (Seeker or Publisher)
 * GET /api/admin/users/:id
 */
const getUserDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select('-password -refreshToken');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  let profile = null;
  let preferences = null;

  if (user.role === 'PUBLISHER') {
    profile = await PublisherProfile.findOne({ userId: user._id });
  } else if (user.role === 'SEEKER') {
    // For seekers, we might have preferences and other metadata
    // Check if there's a SeekerProfile model, otherwise use User document fields
    // Based on previous checks, seekers often don't have a separate profile doc yet
    // but they do have preferences
    const { UserPreference } = await import('../models/UserPreference.js');
    preferences = await UserPreference.findOne({ userId: user._id });
  }

  return res.status(200).json(new ApiResponse(200, {
    user,
    profile,
    preferences
  }, 'User details fetched successfully'));
});

export {
  getModerationQueue,
  updateOpportunityStatus,
  getDashboardStats,
  getAllUsers,
  toggleUserStatus,
  verifyPublisher,
  getAdminProfile,
  updateAdminProfile,
  getUserDetails,
};
