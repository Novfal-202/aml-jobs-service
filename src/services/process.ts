import { Process } from '../models/process';
import { AppDataSource } from '../config';
import { Optional } from 'sequelize';

//create service for Process
export const createProcess = async (req: Optional<any, string>): Promise<any> => {
  try {
    await Process.create(req);

    return { error: false, message: 'success' };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to create a record' : '';
    return { error: true, message: errorMsg };
  }
};

//get Single Process by meta data
export const getProcessByMetaData = async (req: any): Promise<any> => {
  try {
    req.is_active = true;
    const getProcess = await Process.findAll({ where: req, raw: true });
    return { error: false, getProcess };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to get a record' : '';
    return { error: true, message: errorMsg };
  }
};

//update single Process
export const updateProcess = async (process_id: string, req: any): Promise<any> => {
  try {
    const whereClause: Record<string, any> = { process_id };
    whereClause.is_active = true;
    const updateProcess = await Process.update(req, { where: whereClause });

    return { error: false, updateProcess };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to update a record' : '';
    return { error: true, message: errorMsg };
  }
};

//get Single Process by id
export const getProcessById = async (process_id: string): Promise<any> => {
  try {
    const whereClause: Record<string, any> = { process_id };
    whereClause.is_active = true;
    const getProcess = await Process.findOne({ where: whereClause, raw: true });
    return { error: false, getProcess };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to get a record' : '';
    return { error: true, message: errorMsg };
  }
};
