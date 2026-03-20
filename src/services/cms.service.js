import { CmsPage } from '../models/CmsPage.js';
import { ApiError } from '../utils/apiError.js';

const getCmsPage = async (pageKey) => {
  const page = await CmsPage.findOne({ pageKey });
  if (!page) throw new ApiError(404, 'CMS page not found');
  return page;
};

const updateCmsPage = async (pageKey, userId, updateData) => {
  const page = await CmsPage.findOneAndUpdate(
    { pageKey },
    {
      $set: { ...updateData, updatedBy: userId },
    },
    { new: true, upsert: true, runValidators: true }
  );

  return page;
};

const seedDefaultPages = async () => {
  const defaultPages = [
    {
      pageKey: 'home',
      title: { en: 'Home Protocol', fr: 'Protocole d\'accueil' },
      mainHeading: { en: 'Orchestrating Global Professional Synergy', fr: 'Orchestrating de la synergie professionnelle mondiale' },
      heroImageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop'
    },
    {
      pageKey: 'about',
      title: { en: 'Identity Grid', fr: 'Grille d\'identité' },
      mainHeading: { en: 'Defining the Professional Singularity', fr: 'Définir la singularité professionnelle' },
      heroImageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop'
    },
    {
      pageKey: 'opportunities',
      title: { en: 'Market Intelligence', fr: 'Intelligence du marché' },
      mainHeading: { en: 'Calibrating Career Trajectories', fr: 'Calibrage des trajectoires de carrière' },
      heroImageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop'
    }
  ];

  for (const page of defaultPages) {
    await CmsPage.findOneAndUpdate(
      { pageKey: page.pageKey },
      { $setOnInsert: page },
      { upsert: true }
    );
  }
};

const getAllCmsPages = async () => {
  let pages = await CmsPage.find({}).select('pageKey title updatedAt');
  
  if (pages.length === 0) {
    await seedDefaultPages();
    pages = await CmsPage.find({}).select('pageKey title updatedAt');
  }
  
  return pages;
};

export {
  getCmsPage,
  updateCmsPage,
  getAllCmsPages,
};
