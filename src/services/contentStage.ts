import { ContentStage } from '../models/contentStage';
import { Optional } from 'sequelize';

//create service for Content
export const createContentSage = async (req: Optional<any, any>[]): Promise<any> => {
  try {
    const stagingData = await ContentStage.bulkCreate(req);

    const [dataValues] = stagingData;
    return { error: false, message: 'success', dataValues };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to create a record' : '';
    return { error: true, message: errorMsg };
  }
};

//get Single Content by meta data
export const contentStageMetaData = async (req: any): Promise<any> => {
  try {
    const content = await ContentStage.findAll({ where: req });
    return { content };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to get a record' : '';
    return { error: true, message: errorMsg };
  }
};

//update single Content
export const updateContentStage = async (whereClause: any, req: any): Promise<any> => {
  try {
    const updateContent = await ContentStage.update(req, { where: whereClause });

    return { error: false, updateContent };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to update a record' : '';
    return { error: true, message: errorMsg };
  }
};

//get Single Content by id
export const contentStageById = async (id: number): Promise<any> => {
  try {
    const getContent = await ContentStage.findOne({ where: { id } });
    return { error: false, getContent };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to get a record' : '';
    return { error: true, message: errorMsg };
  }
};

export const getAllContentStage = async (): Promise<any> => {
  try {
    const content = await ContentStage.findAll();
    return { content };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to get a record' : '';
    return { error: true, message: errorMsg };
  }
};
