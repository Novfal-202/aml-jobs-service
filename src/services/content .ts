import { Optional } from 'sequelize';
import { Content } from '../models/content'; // Import Content model

// Create a new content
export const createContent = async (req: Optional<any, string>[]): Promise<any> => {
  const insertContent = await Content.bulkCreate(req);
  return { error: false, insertContent };
};

// Get a single content by identifier
export const getContentById = async (id: number): Promise<any> => {
  const contentDetails = await Content.findOne({
    where: { id },
    attributes: { exclude: ['id'] }, // Exclude internal id if necessary
  });
  return contentDetails;
};

// Update content by identifier
export const updateContent = async (identifier: string, req: any): Promise<any> => {
  const whereClause: Record<string, any> = { identifier };
  whereClause.is_active = true; // Ensure only active contents are updated
  const updateContent = await Content.update(req, { where: whereClause });
  return updateContent;
};
