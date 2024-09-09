import logger from '../../utils/logger';
import * as _ from 'lodash';
import { CronJob } from 'cron';
import { getAllCloudFolder, getQuestionSignedUrl, getTemplateSignedUrl } from '../../services/awsService';
import { getProcessByMetaData, updateProcess } from '../../services/process';
import path from 'path';
import AdmZip from 'adm-zip';
import { appConfiguration } from '../../config';

const { fibCsvFileName, gridCsvFileName, mcqCsvFileName } = appConfiguration;

const checkStatus = new CronJob('0 9,21 * * *', async () => {
  try {
    const processInfo = await getProcessByMetaData({ status: 'open' });
    const { getProcess } = processInfo;

    let validFileNames: string[];

    for (const process of getProcess) {
      const { process_id, fileName, name } = process;
      switch (name) {
        case 'fib.zip':
          validFileNames = fibCsvFileName;
          break;
        case 'mcq.zip':
          validFileNames = mcqCsvFileName;
          break;
        case 'grid.zip':
          validFileNames = gridCsvFileName;
          break;
        default:
          validFileNames = []; // Handle default case
          break;
      }

      const folderPath = `upload/${process_id}`;

      const s3Objects = await getAllCloudFolder(folderPath);

      // Check if the folder is empty
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
    const code = _.get(error, 'code', 'UPLOAD_QUESTION_CRON');
    const errorMsg = error instanceof Error ? error.message : 'Error during upload validation';
    logger.error({ errorMsg, code });
  }
});
checkStatus.start();

// Function to check if the folder is empty
const isFolderEmpty = (s3Objects: any): boolean => {
  return !s3Objects.Contents || _.isEmpty(s3Objects.Contents);
};

// Function to validate the contents of ZIP files
const validateZipFiles = async (process_id: string, s3Objects: any, folderPath: string, fileName: string, validFileNames: string[]): Promise<boolean> => {
  let isZipFile = true;

  try {
    for (const s3Object of s3Objects.Contents) {
      const cloudFileName = s3Object.Key?.split('/').pop();
      const fileExt = path.extname(cloudFileName || '').toLowerCase();

      // Check if the file is a ZIP file
      if (fileExt !== '.zip') {
        await markProcessAsFailed(process_id, 'is_unsupported_format', 'The uploaded file is an unsupported format, please upload all CSV files inside a ZIP file.');
        isZipFile = false;
        break;
      } else {
        await updateProcess(process_id, { status: 'in_progress', updated_by: 1 });
      }

      if (!isZipFile) return false;

      const questionZipEntries = await fetchAndExtractZipEntries('upload', folderPath, fileName);
      for (const entry of questionZipEntries) {
        // Check if the ZIP contains directories
        if (entry.isDirectory) {
          await markProcessAsFailed(process_id, 'is_unsupported_folder_type', 'The uploaded ZIP folder contains files directly. Please ensure that all CSV files are inside the ZIP folder.');
          return false;
        }

        //Check if the file name is valid
        if (!validFileNames.includes(entry.entryName)) {
          await markProcessAsFailed(process_id, 'is_unsupported_file_name', `The uploaded file '${entry.entryName}' is not a valid file name.`);
          return false;
        }

        // Validate the format of the CSV file
        const validCSV = await validateCSVFormat(process_id, folderPath, entry);

        if (!validCSV) return false;
      }
    }

    return true;
  } catch (error) {
    const code = _.get(error, 'code', 'UPLOAD_QUESTION_CRON');
    const errorMsg = error instanceof Error ? error.message : 'Error during upload validation,please re upload the zip file for the new process';
    logger.error({ errorMsg, code });
    await markProcessAsFailed(process_id, 'is failed', errorMsg);
    return false;
  }
};

// Function to validate the format of the CSV file inside the ZIP and insert into temp table
const validateCSVFormat = async (process_id: string, folderPath: string, entry: any): Promise<boolean> => {
  try {
    const templateZipEntries = await fetchAndExtractZipEntries('template', folderPath, entry.entryName.split('_')[0]);
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
    const [header, ...rows] = questionFileContent.split('\n').map((row: string) => row.split(','));

    // Check that the header matches the template and column matched to template
    if (header.length !== templateHeader.length) {
      await markProcessAsFailed(process_id, 'invalid_header_length', `Uploaded csv contain maximum or minimum field compared to template.`);
      return false;
    }
    if (!templateHeader.every((col, i) => col === header[i])) {
      await markProcessAsFailed(process_id, 'invalid_column_name', `The file '${entry.entryName}' does not match the expected CSV format.`);
      return false;
    }

    // Validate each row: Check for empty fields and the correct number of columns
    for (const [rowIndex, row] of rows.entries()) {
      if (row.length !== header.length) {
        await markProcessAsFailed(process_id, 'invalid_row_length', `Row ${rowIndex + 1} does not match the expected number of columns.`);
        return false;
      }

      // Check for empty fields in the row
      const hasEmptyField = row.some((field: any) => field.trim() === '');

      if (hasEmptyField) {
        await markProcessAsFailed(process_id, 'empty_field', `Row ${rowIndex + 1} contains empty fields. Please ensure all fields are filled.`);
        return false;
      }
    }
    // Create temp table and insert CSV data

    return true;
  } catch (error) {
    const code = _.get(error, 'code', 'UPLOAD_QUESTION_CRON');
    const errorMsg = error instanceof Error ? error.message : 'Error during upload validation,please re upload the zip file for the new process';
    logger.error({ errorMsg, code });
    await markProcessAsFailed(process_id, 'is_failed', errorMsg);
    return false;
  }
};

const fetchAndExtractZipEntries = async (folderName: string, folderPath: string, fileName: string): Promise<AdmZip.IZipEntry[]> => {
  try {
    let s3File;
    if (folderName === 'upload') {
      s3File = await getQuestionSignedUrl(folderPath, fileName, 10);
    } else {
      const filename = `${fileName}.zip`;
      s3File = await getTemplateSignedUrl(folderName, filename, 10);
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
    const errorMsg = error instanceof Error ? error.message : 'Error during upload validation,please re upload the zip file for the new process';
    logger.error({ errorMsg, code });
    return [];
  }
};

export const manualTriggerQuestion = () => {
  try {
    checkStatus.fireOnTick();
  } catch (error) {
    const code = _.get(error, 'code', 'QUESTION_CRON_UPDATE');
    const errorMsg = error instanceof Error ? error.message : 'Error during upload validation';
    logger.error({ errorMsg, code });
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
