import { StageTable } from '../models/stageTable';
import { AppDataSource } from '../config';
import { Optional } from 'sequelize';

//create service for StageTable
export const createStageTable = async (req: Optional<any, string>): Promise<any> => {
  const transact = await AppDataSource.transaction();
  try {
    const stagingData = await StageTable.create(req, { transaction: transact });
    await transact.commit();
    const { dataValues } = stagingData;
    return { error: false, message: 'success', dataValues };
  } catch (error) {
    await transact.rollback();
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to create a record' : '';
    return { error: true, message: errorMsg };
  }
};

//get Single StageTable by meta data
export const getStageTableByMetaData = async (req: any): Promise<any> => {
  try {
    const stageTable = await StageTable.findAll({ where: req });
    return { stageTable };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to get a record' : '';
    return { error: true, message: errorMsg };
  }
};

//update single StageTable
export const updateStageTable = async (whereClause: any, req: any): Promise<any> => {
  try {
    const transact = await AppDataSource.transaction();
    const updateStageTable = await StageTable.update(req, { where: whereClause, transaction: transact });
    await transact.commit();
    return { error: false, updateStageTable };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to update a record' : '';
    return { error: true, message: errorMsg };
  }
};

//get Single StageTable by id
export const getStageTableById = async (id: number): Promise<any> => {
  try {
    const getStageTable = await StageTable.findOne({ where: { id } });
    return { error: false, getStageTable };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to get a record' : '';
    return { error: true, message: errorMsg };
  }
};
