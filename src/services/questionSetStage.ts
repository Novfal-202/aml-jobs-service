import { QuestionSetStage } from '../models/questionSetSatge';
import { AppDataSource } from '../config';
import { Optional } from 'sequelize';

//create service for QuestionSet
export const createQuestionSetSatge = async (req: Optional<any, string>[]): Promise<any> => {
  try {
    const stagingData = await QuestionSetStage.bulkCreate(req);

    const [dataValues] = stagingData;
    return { error: false, message: 'success', dataValues };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to create a record' : '';
    return { error: true, message: errorMsg };
  }
};

//get Single QuestionSet by meta data
export const questionSetStageMetaData = async (req: any): Promise<any> => {
  try {
    const questionSet = await QuestionSetStage.findAll({ where: req });
    return { questionSet };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to get a record' : '';
    return { error: true, message: errorMsg };
  }
};

//update single QuestionSet
export const updateQuestionStageSet = async (whereClause: any, req: any): Promise<any> => {
  try {
    const updateQuestionSet = await QuestionSetStage.update(req, { where: whereClause });

    return { error: false, updateQuestionSet };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to update a record' : '';
    return { error: true, message: errorMsg };
  }
};

//get Single QuestionSet by id
export const questionSetStageById = async (id: number): Promise<any> => {
  try {
    const getQuestionSet = await QuestionSetStage.findOne({ where: { id } });
    return { error: false, getQuestionSet };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to get a record' : '';
    return { error: true, message: errorMsg };
  }
};
