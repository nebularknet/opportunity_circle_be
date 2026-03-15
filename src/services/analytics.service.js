import { Opportunity } from '../models/Opportunity.js';
import { OpportunityView } from '../models/OpportunityView.js';
import { Application } from '../models/Application.js';
import { PublisherProfile } from '../models/PublisherProfile.js';
import mongoose from 'mongoose';

const getPublisherStats = async (publisherId) => {
  const opportunities = await Opportunity.find({ publisherId, isDeleted: false });
  const opportunityIds = opportunities.map(opp => opp._id);
  const activeOpportunityIds = opportunities
    .filter(opp => opp.status === 'ACTIVE')
    .map(opp => opp._id);

  const profile = await PublisherProfile.findOne({ userId: publisherId });
  const isPublisherVerified = profile?.verified || false;

  const stats = await Opportunity.aggregate([
    { $match: { publisherId: new mongoose.Types.ObjectId(publisherId), isDeleted: false } },
    {
      $facet: {
        totalListings: [{ $count: 'count' }],
        activeListings: [
          { $match: { status: 'ACTIVE' } },
          { $count: 'count' }
        ],
        statusBreakdown: [
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ],
      }
    }
  ]);

  const viewStats = await OpportunityView.aggregate([
    { $match: { opportunityId: { $in: opportunityIds } } },
    {
      $group: {
        _id: null,
        totalViews: { $sum: 1 },
      }
    }
  ]);

  const applicantStats = await Application.aggregate([
    { $match: { opportunityId: { $in: opportunityIds } } },
    {
      $facet: {
        totalApplicants: [{ $count: 'count' }],
      }
    }
  ]);

  const totalListings = stats[0].totalListings[0]?.count || 0;
  const activeListingsCount = stats[0].activeListings[0]?.count || 0;
  const totalViews = viewStats[0]?.totalViews || 0;
  const totalApplicants = applicantStats[0].totalApplicants[0]?.count || 0;

  // Engagement Rate = (Applicants + Views) / Total Active Listings
  const engagementRate = activeListingsCount > 0 
    ? ((totalApplicants + totalViews) / activeListingsCount).toFixed(2) 
    : 0;

  return {
    totalListings,
    activeListingsCount,
    verifiedProgramsCount: isPublisherVerified ? activeListingsCount : 0,
    engagementRate: parseFloat(engagementRate),
    totalViews,
    totalApplicants,
    listingStatusBreakdown: stats[0].statusBreakdown,
  };
};

const trackOpportunityView = async ({ opportunityId, userId, viewerIp }) => {
  await OpportunityView.create({
    opportunityId,
    userId,
    viewerIp,
    viewedAt: new Date(),
  });

  await Opportunity.findByIdAndUpdate(opportunityId, {
    $inc: { viewCount: 1 },
  });
};

export { getPublisherStats, trackOpportunityView };
