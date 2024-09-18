import logger from '../../utils/logger';
import * as _ from 'lodash';
import { getFolderMetaData, getFolderData, uploadFile } from '../../services/awsService';
import { getProcessByMetaData, updateProcess } from '../../services/process';
import path from 'path';
import AdmZip from 'adm-zip';
import { appConfiguration } from '../../config';

const { csvFileName } = appConfiguration;
let FILENAME: string;
let Process_id: string;

export const scheduleJob = async () => {
  const processesInfo = await getProcessByMetaData({ status: 'open' });
  const { getAllProcess } = processesInfo;
  try {
    for (const process of getAllProcess) {
      const { process_id, fileName } = process;
      logger.info(`Starting bulk upload job for process id :${process_id}.`);
      FILENAME = fileName;
      Process_id = process_id;
      const folderPath = `upload/${process_id}`;
      const bulkUploadMetadata = await getFolderMetaData(folderPath);
      logger.info(`Starting bulk upload folder validation for process id :${process_id}.`);
      await validateZipFile(bulkUploadMetadata);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error during upload validation.Re upload file for new process';
    await updateProcess(Process_id, { status: 'errored', error_status: 'errored', error_message: 'Error during upload validation.Re upload file for new process' });
    logger.error(errorMsg);
  }
};

const validateZipFile = async (bulkUploadMetadata: any): Promise<any> => {
  if (_.isEmpty(bulkUploadMetadata.Contents)) {
    await updateProcess(Process_id, {
      error_status: 'empty',
      error_message: 'The uploaded zip folder is empty, please ensure a valid upload file.',
      status: 'failed',
    });
    logger.error('The uploaded zip folder is empty, please ensure a valid upload file.');
  }
  const fileExt = path.extname(bulkUploadMetadata.Contents[0].Key || '').toLowerCase();
  if (fileExt !== '.zip') {
    await updateProcess(Process_id, {
      error_status: 'unsupported_format',
      error_message: 'The uploaded file is an unsupported format, please upload all CSV files inside a ZIP file.',
      status: 'failed',
    });
    logger.error('The uploaded file is an unsupported format, please upload all CSV files inside a ZIP file.');
  } else {
    await updateProcess(Process_id, { status: 'progress', updated_by: 1 });
    logger.info(`Bulk upload folder found and valid zip for process id:${Process_id}`);
    await validateCSVFilesInZip();
  }
};

const validateCSVFilesInZip = async (): Promise<boolean> => {
  try {
    const ZipEntries = await fetchAndExtractZipEntries('upload');
    const mediaZipEntries = ZipEntries.filter((e) => !e.entryName.endsWith('.csv'));
    const csvZipEntries = ZipEntries.filter((e) => e.entryName.endsWith('.csv'));
    for (const entry of csvZipEntries) {
      if (entry.isDirectory && entry.entryName.includes('.csv')) {
        await updateProcess(Process_id, {
          error_status: 'unsupported_folder_type',
          error_message: 'The uploaded ZIP folder contains valid files with valid format. Follow the template format.',
          status: 'failed',
        });
        logger.error('The uploaded ZIP folder contains valid files with valid format. Follow the template format.');
        return false;
      }
      if (!csvFileName.includes(entry.entryName)) {
        await updateProcess(Process_id, {
          error_status: 'unsupported_folder_type',
          error_message: `The uploaded file '${entry.entryName}' is not a valid file name.`,
          status: 'failed',
        });
        logger.error(`The uploaded file '${entry.entryName}' is not a valid file name.`);
        return false;
      }
    }
    logger.info('every csv file have valid file name');
    const validCSV = await handleCSVEntries(csvZipEntries, mediaZipEntries);
    return validCSV;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error during upload validation,please re upload the zip file for the new process';
    logger.error(errorMsg);
    await updateProcess(Process_id, {
      error_status: 'errored',
      error_message: errorMsg,
      status: 'errored',
    });
    return false;
  }
};

const handleCSVEntries = async (csvFilesEntries: any, mediaEntires: any): Promise<any> => {
  try {
    for (const entry of csvFilesEntries) {
      const checkKey = entry.entryName.split('_')[1];
      switch (checkKey) {
        case 'question.csv':
          await validateQuestionCsv(entry, mediaEntires);
          break;
        case 'questionSet.csv':
          await validateQuestionSetCsv(entry);
          break;
        case 'content.csv':
          await validateContentCsv(entry, mediaEntires);
          break;
        default:
          await updateProcess(Process_id, {
            error_status: 'unsupported_sheet',
            error_message: `Unsupported sheet in file '${entry.entryName}'.`,
            status: 'failed',
          });
          logger.error(`Unsupported sheet in file '${entry.entryName}'.`);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error during upload validation,please re upload the zip file for the new process';
    logger.error(errorMsg);
    await updateProcess(Process_id, {
      error_status: 'errored',
      error_message: errorMsg,
      status: 'errored',
    });
    return false;
  }
};

const fetchAndExtractZipEntries = async (folderName: string): Promise<AdmZip.IZipEntry[]> => {
  try {
    let bulkUploadFolder;
    if (folderName === 'upload') {
      bulkUploadFolder = await getFolderData(`upload/${Process_id}/${FILENAME}`);
    } else {
      bulkUploadFolder = await getFolderData(`template/${FILENAME}`);
    }
    const buffer = (await streamToBuffer(bulkUploadFolder)) as Buffer;
    const zip = new AdmZip(buffer);
    logger.info('converted stream to zip entries');
    return zip.getEntries();
  } catch (error) {
    const code = _.get(error, 'code', 'UPLOAD_QUESTION_CRON');
    const errorMsg = error instanceof Error ? error.message : 'Error in the validation process,please re-upload the zip file for the new process';
    logger.error({ errorMsg, code });
    return [];
  }
};

const validateQuestionCsv = async (questionEntry: any, mediaEntries: any) => {
  try {
    const templateHeader = await getCSVTemplateHeader(questionEntry.entryName);
    const { header, rows } = getCSVHeaderAndRow(questionEntry);
    const isValidHeader = await validHeader(questionEntry.entryName, header, templateHeader);
    if (!isValidHeader) return;
    const processData = processRow(rows, header);
    logger.info('header and row process successfully as object');
    const updatedProcessData = await validMedia(processData, mediaEntries, 'question');
    logger.info('media inserted and updated in the process Data', updatedProcessData);
    return;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error during upload validation,please re upload the zip file for the new process';
    logger.error(errorMsg);
    await updateProcess(Process_id, {
      error_status: 'errored',
      error_message: errorMsg,
      status: 'errored',
    });
  }
};

const validateQuestionSetCsv = async (questionSetEntry: any) => {
  try {
    const templateHeader = await getCSVTemplateHeader(questionSetEntry.entryName);
    const { header, rows } = getCSVHeaderAndRow(questionSetEntry);
    const isValidHeader = await validHeader(questionSetEntry.entryName, header, templateHeader);
    if (!isValidHeader) return;
    const processData = processRow(rows, header);
    logger.info('header and row process successfully as object', processData);
    return;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error during upload validation,please re upload the zip file for the new process';
    logger.error(errorMsg);
    await updateProcess(Process_id, {
      error_status: 'errored',
      error_message: errorMsg,
      status: 'errored',
    });
  }
};

const validateContentCsv = async (contentEntry: any, mediaEntries: any) => {
  try {
    const templateHeader = await getCSVTemplateHeader(contentEntry.entryName);
    const { header, rows } = getCSVHeaderAndRow(contentEntry);
    const isValidHeader = await validHeader(contentEntry.entryName, header, templateHeader);
    if (!isValidHeader) return;
    const processData = processRow(rows, header);
    logger.info('header and row process successfully as objects');
    const updatedProcessData = await validMedia(processData, mediaEntries, 'content');
    logger.info('media inserted and updated in the process Data', updatedProcessData);
    return;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error during upload validation,please re upload the zip file for the new process';
    logger.error(errorMsg);
    await updateProcess(Process_id, {
      error_status: 'errored',
      error_message: errorMsg,
      status: 'errored',
    });
  }
};

const validMedia = async (processedCSVData: any, mediaEntries: any[], type: string) => {
  const mediaCsvData = await Promise.all(
    processedCSVData.map(async (p: any) => {
      const mediaFiles = await Promise.all(
        p.media_files.map(async (o: string) => {
          const foundMedia = mediaEntries.slice(1).find((media: any) => {
            return media.entryName.split('/')[1] === o;
          });
          if (foundMedia) {
            const mediaData = await uploadFile(foundMedia, type);
            return mediaData;
          }
          return null;
        }),
      );
      p.media_files = mediaFiles.filter((media: any) => media !== null);
      return p;
    }),
  );
  return mediaCsvData;
};

const processRow = (rows: string[][], header: string[]) => {
  return rows.map((row) =>
    row.reduce(
      (acc, cell, index) => {
        const headerName = header[index].replace(/\r/g, '');
        const cellValue = cell.includes('#') ? cell.split('#').map((v: string) => v.trim()) : cell.replace(/\r/g, '');
        if (headerName.startsWith('mcq') || headerName.startsWith('fib') || headerName.startsWith('grid')) {
          acc.body = acc.body || {};
          acc.body[headerName] = cellValue;
        } else if (headerName.includes('media')) {
          acc.media_files = acc.media_files || [];
          if (cellValue) acc.media_files.push(cellValue);
        } else if (headerName.includes('QID')) {
          acc['question_id'] = cellValue;
        } else if (headerName.includes('sequence') || headerName.includes('benchmark_time')) {
          acc[headerName] = Number(cellValue);
        } else if (headerName.includes('sub_skill_x+x')) {
          acc['sub_skill_xx'] = cellValue;
        } else if (headerName.includes('sub_skill_x+0')) {
          acc['sub_skill_x0'] = cellValue;
        } else {
          acc[headerName] = cellValue;
        }
        return acc;
      },
      {} as Record<string, any>,
    ),
  );
};

const validHeader = async (entryName: string, header: any, templateHeader: any): Promise<boolean> => {
  if (header.length !== templateHeader.length) {
    await updateProcess(Process_id, { error_status: 'invalid_header_length', error_message: `CSV file contains more/less fields compared to the template.`, status: 'failed' });
    logger.error(`CSV file contains more/less fields compared to the template.`);
  }

  const validHeader = templateHeader.every((col: any, i: number) => col === header[i]);
  if (!validHeader) {
    await updateProcess(Process_id, { error_status: 'invalid_column_name', error_message: `The file '${entryName}' does not match the expected CSV format.`, status: 'failed' });
    logger.error(`The file '${entryName}' does not match the expected CSV format.`);
    return false;
  }
  logger.info(`${entryName} contain valid header`);
  return true;
};

const getCSVTemplateHeader = async (entryName: string) => {
  const templateZipEntries = await fetchAndExtractZipEntries('template');
  const templateFileContent = templateZipEntries
    .find((t) => t.entryName === entryName)
    ?.getData()
    .toString('utf8');
  if (!templateFileContent) {
    await updateProcess(Process_id, { error_status: 'invalid_template', error_message: `Template for '${entryName}' not found.`, status: 'failed' });
    logger.error(`The file '${entryName}' does not match the expected CSV format.`);
    return false;
  }
  const [templateHeader] = templateFileContent.split('\n').map((row) => row.split(','));
  logger.info('template header extracted');
  return templateHeader;
};
const getCSVHeaderAndRow = (csvEntries: any) => {
  const [header, ...rows] = csvEntries
    .getData()
    .toString('utf8')
    .split('\n')
    .map((row: string) => row.split(','))
    .filter((row: string[]) => row.some((cell) => cell.trim() !== ''));
  logger.info('header and rows are extracted');
  return { header, rows };
};

const streamToBuffer = (stream: any) => {
  return new Promise((resolve, reject) => {
    const chunks: any = [];
    stream.on('data', (chunk: any) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
};
