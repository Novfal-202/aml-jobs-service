import { Question } from '../models/question';
import { AppDataSource } from '../config';
import { Optional } from 'sequelize';

//create service for Question
export const createQuestion = async (req: Optional<any, string>[]): Promise<any> => {
  console.log('🚀 ~ createQuestion ~ req:', req);
  try {
    const stagingData = await Question.bulkCreate(req);

    const [dataValues] = stagingData;
    return { error: false, message: 'success', dataValues };
  } catch (error) {
    console.log('🚀 ~ createQuestion ~ error:', error);
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to create a record' : '';
    return { error: true, message: errorMsg };
  }
};

//get Single Question by meta data
export const getQuestionByMetaData = async (req: any): Promise<any> => {
  try {
    const question = await Question.findAll({ where: req });
    return { question };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to get a record' : '';
    return { error: true, message: errorMsg };
  }
};

//update single Question
export const updateQuestion = async (whereClause: any, req: any): Promise<any> => {
  try {
    const updateQuestion = await Question.update(req, { where: whereClause });

    return { error: false, updateQuestion };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to update a record' : '';
    return { error: true, message: errorMsg };
  }
};

//get Single Question by id
export const getQuestionById = async (id: number): Promise<any> => {
  try {
    const getQuestion = await Question.findOne({ where: { id } });
    return { error: false, getQuestion };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to get a record' : '';
    return { error: true, message: errorMsg };
  }
};
