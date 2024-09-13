import logger from '../../utils/logger';
import * as _ from 'lodash';
import { CronJob } from 'cron';
import { getAllCloudFolder, getQuestionSignedUrl, getTemplateSignedUrl } from '../../services/awsService';
import { getProcessByMetaData, updateProcess } from '../../services/process';
import path from 'path';
import AdmZip from 'adm-zip';
import { appConfiguration } from '../../config';
import { AppDataSource } from '../../config';
import { Transaction } from 'sequelize';
import { createStageTable, updateStageTable, getStageTableById, getStageTableByMetaData } from '../../services/stageTable';

const { csvFileName, cronJobPrcessUpdate, grid1AddFields, mcqFields, fibFields, grid2Fields } = appConfiguration;

export const scheduleCronJob = () => {
  const checkStatus = new CronJob(cronJobPrcessUpdate, async () => {
    try {
      const processInfo = await getProcessByMetaData({ status: 'open' });
      const { getProcess } = processInfo;

      const validFileNames: string[] = csvFileName;

      for (const process of getProcess) {
        const { process_id, fileName } = process;
        const folderPath = `upload/${process_id}`;

        const s3Objects = await getAllCloudFolder(folderPath);

        if (isFolderEmpty(s3Objects)) {
          await markProcessAsFailed(process_id, 'is_empty', 'The uploaded zip folder is empty, please ensure a valid upload file.');
          continue;
        }

        // Validate if the main folder contains valid ZIP files
        const validZip = await validateZipFiles(process_id, s3Objects, folderPath, fileName, validFileNames);

        if (!validZip) {
          continue;
        }
      }
    } catch (error) {
      const code = _.get(error, 'code', 'QUESTION_JOB_PROCESS');
      const errorMsg = error instanceof Error ? error.message : 'Error during upload validation.Re upload file for new process';
      logger.error({ errorMsg, code });
    }
  });
  checkStatus.start();
};

const isFolderEmpty = (s3Objects: any): boolean => {
  return !s3Objects.Contents || _.isEmpty(s3Objects.Contents);
};

const validateZipFiles = async (process_id: string, s3Objects: any, folderPath: string, fileName: string, validFileNames: string[]): Promise<boolean> => {
  let isZipFile = true;
  try {
    for (const s3Object of s3Objects.Contents) {
      const cloudFileName = s3Object.Key?.split('/').pop();
      const fileExt = path.extname(cloudFileName || '').toLowerCase();

      if (fileExt !== '.zip') {
        await markProcessAsFailed(process_id, 'is_unsupported_format', 'The uploaded file is an unsupported format, please upload all CSV files inside a ZIP file.');
        isZipFile = false;
        break;
      } else {
        await updateProcess(process_id, { status: 'in_progress', updated_by: 1 });
      }

      if (!isZipFile) return false;

      const questionZipEntries = await fetchAndExtractZipEntries('upload', folderPath, fileName);
      let mediaFolderExists = false;

      for (const entry of questionZipEntries) {
        if (entry.isDirectory && entry.entryName === 'media/') {
          mediaFolderExists = true; // Found the media folder
        }

        if (entry.isDirectory && entry.entryName !== 'media/') {
          await markProcessAsFailed(process_id, 'is_unsupported_folder_type', 'The uploaded ZIP folder contains unsupported directories. Ensure all files are placed in the appropriate location.');
          return false;
        }

        if (!validFileNames.includes(entry.entryName)) {
          await markProcessAsFailed(process_id, 'is_unsupported_file_name', `The uploaded file '${entry.entryName}' is not a valid file name.`);
          return false;
        }

        const validCSV = await validateCSVFormat(process_id, folderPath, entry, fileName);
        if (!validCSV) return false;
      }

      // Check if the media folder exists
      if (!mediaFolderExists) {
        await markProcessAsFailed(process_id, 'is_media_folder_missing', 'The uploaded ZIP file does not contain a "media" folder.');
        return false;
      }
    }

    return true;
  } catch (error) {
    const code = _.get(error, 'code', 'UPLOAD_QUESTION_CRON');
    const errorMsg = error instanceof Error ? error.message : 'Error during upload validation, please re-upload the zip file for the new process.';
    logger.error({ errorMsg, code });
    await markProcessAsFailed(process_id, 'is_failed', errorMsg);
    return false;
  }
};

const validateCSVFormat = async (process_id: string, folderPath: string, entry: any, fileName: string): Promise<boolean> => {
  const transaction: Transaction = await AppDataSource.transaction();
  try {
    const templateZipEntries = await fetchAndExtractZipEntries('template', folderPath, fileName);
    const templateFileContent = templateZipEntries
      .find((t) => t.entryName === entry.entryName)
      ?.getData()
      .toString('utf8');

    if (!templateFileContent) {
      await markProcessAsFailed(process_id, 'invalid_template', `Template for '${entry.entryName}' not found.`);
      return false;
    }

    const [templateHeader] = templateFileContent.split('\n').map((row) => row.split(','));

    const questionFileContent = entry.getData().toString('utf8');
    const [header, ...rows] = questionFileContent
      .split('\n')
      .map((row: string) => row.split(','))
      .filter((row: string[]) => row.some((cell) => cell.trim() !== '')); // Filter out rows where all cells are empty

    // Validate header length and column names
    if (header.length !== templateHeader.length) {
      await markProcessAsFailed(process_id, 'invalid_header_length', `CSV file contains more/less fields compared to the template.`);
      return false;
    }
    if (!templateHeader.every((col, i) => col === header[i])) {
      await markProcessAsFailed(process_id, 'invalid_column_name', `The file '${entry.entryName}' does not match the expected CSV format.`);
      return false;
    }

    // Insert all rows into the staging table
    for (const [rowIndex, row] of rows.entries()) {
      const rowData = header.reduce(
        (acc: any, key: any, index: number) => {
          acc[key] = row[index];
          return acc;
        },
        {} as Record<string, string>,
      );

      const { hint, description, QID: question_id, ...rest } = rowData;
      const bodyFields = Object.fromEntries(Object.entries(rest).filter(([key]) => key.startsWith('n') || key.includes('grid') || key.includes('fib') || key.includes('mcq')));

      Object.keys(bodyFields).forEach((key) => delete rowData[key]);

      const insertData = {
        ...rowData,
        question_id,
        process_id,
        hint,
        description,
        body: { ...bodyFields },
      };

      const createStageData = await createStageTable(insertData);
      if (createStageData.error) {
        await markProcessAsFailed(process_id, 'insert_error', `Error inserting data for row ${rowIndex + 1}.`);
        continue;
      }

      // After insertion, perform batch content validation
      const validationError = await validateInsertedData(process_id, createStageData.dataValues.id);
      if (validationError) {
        await markProcessAsFailed(process_id, 'insert_error', `Error inserting data for row ${rowIndex + 1}.`);
        await transaction.rollback();
        return false;
      } else {
        await updateProcess(process_id, {
          status: 'is_completed',
        });
        await updateStageTable(
          { process_id },
          {
            status: 'is_completed',
          },
        );
      }
    }
    await transaction.commit();
    // API call to bulk insert the data
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error during validation. Please re-upload the file.';
    logger.error({ errorMsg, process_id });
    await markProcessAsFailed(process_id, 'failed', errorMsg);
    await transaction.rollback();
    return false;
  }
};

const validateInsertedData = async (process_id: string, id: number): Promise<boolean> => {
  try {
    const records = await getStageTableById(id);
    const {
      getStageTable: { question_id, question_set_id, question_type, L1_skill, body },
    } = records;
    const checkRecord = await getStageTableByMetaData({ question_id, question_set_id, L1_skill });

    if (checkRecord.stageTable.length > 1) {
      await markProcessAsFailed(process_id, 'duplicate_question_id', `Duplicate question_id and question_set_id combination found for question_id ${question_id}.`);
      await updateStageTable({ id }, { status: 'errored', error_info: 'duplication fo question and question set id present' });
    }

    let requiredFields: string[];
    const caseKey = question_type == 'Grid-1' ? `${question_type}_${L1_skill}` : question_type;

    switch (caseKey) {
      case `Grid-1_add`:
        requiredFields = grid1AddFields;
        break;
      case `Grid-2`:
        requiredFields = grid2Fields;
        break;
      case `mcq`:
        requiredFields = mcqFields;
        break;
      case `fib`:
        requiredFields = fibFields;
        break;
      default:
        requiredFields = [];
        break;
    }
    if (!requiredFields.every((fields) => body[fields])) {
      await updateStageTable({ id }, { status: 'errored', error_info: `required field should not be a empty ,add valid data for ${requiredFields.flatMap((fields) => fields).join(',')} ` });
      await markProcessAsFailed(process_id, 'invalid_data', `Dependent fields validation failed for question_id ${question_id}.`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error({ message: `Validation failed for process_id ${process_id}`, error });
    return true;
  }
};

const fetchAndExtractZipEntries = async (folderName: string, folderPath: string, fileName: string): Promise<AdmZip.IZipEntry[]> => {
  try {
    let s3File;
    if (folderName === 'upload') {
      s3File = await getQuestionSignedUrl(folderPath, fileName, 10);
    } else {
      s3File = await getTemplateSignedUrl(folderName, fileName, 10);
    }
    if (!s3File.url) {
      throw new Error('Signed URL is missing or invalid');
    }
    const response = await fetch(s3File.url);

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const zip = new AdmZip(buffer);

    return zip.getEntries();
  } catch (error) {
    const code = _.get(error, 'code', 'UPLOAD_QUESTION_CRON');
    const errorMsg = error instanceof Error ? error.message : 'Error in the validation process,please re-upload the zip file for the new process';
    logger.error({ errorMsg, code });
    return [];
  }
};

// Function to update error status and message
const markProcessAsFailed = async (process_id: string, error_status: string, error_message: string) => {
  await updateProcess(process_id, {
    error_status,
    error_message,
    status: 'is_failed',
  });
};
