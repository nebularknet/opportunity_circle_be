import { Opportunity } from '../models/Opportunity.js';
import { PublisherProfile } from '../models/PublisherProfile.js';
import { ApiError } from '../utils/apiError.js';
import { trackOpportunityView } from './analytics.service.js';
import { getWorkshopMentors } from './mentor.service.js';

const createOpportunity = async (publisherId, opportunityData) => {
  const profile = await PublisherProfile.findOne({ userId: publisherId });

  if (!profile) {
    throw new ApiError(404, 'Publisher profile not found');
  }

  // Generate search tokens from title and organizationName
  const searchTokens = [
    ...opportunityData.title.en.toLowerCase().split(/\s+/),
    ...opportunityData.organizationName.toLowerCase().split(/\s+/),
    ...(opportunityData.tags || []),
  ];

  const opportunity = await Opportunity.create({
    ...opportunityData,
    publisherId,
    status: 'PENDING', // All new opportunities go to PENDING for admin review
    searchTokens,
  });

  return opportunity;
};

const updateOpportunityStatus = async (opportunityId, status) => {
  const opportunity = await Opportunity.findByIdAndUpdate(
    opportunityId,
    { $set: { status } },
    { new: true }
  );

  if (!opportunity) {
    throw new ApiError(404, 'Opportunity not found');
  }

  if (status === 'ACTIVE') {
    const profile = await PublisherProfile.findOne({ userId: opportunity.publisherId });
    if (profile) {
      profile.approvedListingCount += 1;
      if (profile.approvedListingCount >= 3) {
        profile.moderationStatus = 'TRUSTED';
      }
      await profile.save();
    }
  }

  return opportunity;
};

const getAllOpportunities = async (filters = {}, options = {}) => {
  const {
    type,
    location,
    search,
    status = 'ACTIVE',
    educationLevel,
    fundingType,
  } = filters;
  const { page = 1, limit = 10 } = options;

  const query = { status, isDeleted: false };

  if (type) query.type = type;
  if (location) query.location = new RegExp(location, 'i');
  if (educationLevel) query.educationLevel = educationLevel;
  if (fundingType) query.fundingType = fundingType;

  if (search) {
    query.$text = { $search: search };
  }

  // Use aggregation to join with PublisherProfile for isVerified status
  const pipeline = [
    { $match: query },
    {
      $lookup: {
        from: 'publisherprofiles',
        localField: 'publisherId',
        foreignField: 'userId',
        as: 'publisherProfile',
      },
    },
    {
      $addFields: {
        isVerified: {
          $cond: {
            if: { $gt: [{ $size: '$publisherProfile' }, 0] },
            then: { $arrayElemAt: ['$publisherProfile.verified', 0] },
            else: false,
          },
        },
      },
    },
    { $project: { publisherProfile: 0 } },
    { $sort: search ? { score: { $meta: 'textScore' } } : { createdAt: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
  ];

  const opportunities = await Opportunity.aggregate(pipeline);
  const total = await Opportunity.countDocuments(query);

  return { opportunities, total, page, totalPages: Math.ceil(total / limit) };
};

const getOpportunityById = async (id, userId = null, ip = null) => {
  const opportunity = await Opportunity.findOne({ _id: id, isDeleted: false })
    .populate('publisherId', 'fullName email profilePhotoUrl');
  
  if (!opportunity) {
    throw new ApiError(404, 'Opportunity not found');
  }

  // Track view asynchronously
  if (opportunity.status === 'ACTIVE') {
    trackOpportunityView({ opportunityId: id, userId, viewerIp: ip }).catch(err => {
      console.error('Error tracking view:', err);
    });
  }

  const result = opportunity.toObject();

  // If it's a workshop, fetch mentors
  if (opportunity.type === 'WORKSHOP') {
    result.mentors = await getWorkshopMentors(id);
  }

  return result;
};

const updateOpportunity = async (opportunityId, publisherId, updateData) => {
  const opportunity = await Opportunity.findOne({ _id: opportunityId, publisherId });

  if (!opportunity) {
    throw new ApiError(404, 'Opportunity not found or unauthorized');
  }

  // Regenerate search tokens if title or organizationName changes
  if (updateData.title || updateData.organizationName || updateData.tags) {
    const title = updateData.title?.en || opportunity.title.en;
    const org = updateData.organizationName || opportunity.organizationName;
    const tags = updateData.tags || opportunity.tags;

    updateData.searchTokens = [
      ...title.toLowerCase().split(/\s+/),
      ...org.toLowerCase().split(/\s+/),
      ...(tags || []),
    ];
  }

  const updatedOpportunity = await Opportunity.findByIdAndUpdate(
    opportunityId,
    { $set: updateData },
    { new: true }
  );

  return updatedOpportunity;
};

const deleteOpportunity = async (id, publisherId) => {
  const opportunity = await Opportunity.findOneAndUpdate(
    { _id: id, publisherId },
    { $set: { isDeleted: true, deletedAt: new Date(), status: 'ARCHIVED' } },
    { new: true }
  );

  if (!opportunity) {
    throw new ApiError(404, 'Opportunity not found or unauthorized');
  }

  return opportunity;
};

export {
  createOpportunity,
  updateOpportunityStatus,
  getAllOpportunities,
  getOpportunityById,
  updateOpportunity,
  deleteOpportunity,
};
