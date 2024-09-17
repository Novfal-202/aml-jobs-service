import logger from '../../utils/logger';
import * as _ from 'lodash';
import { CronJob } from 'cron';
import { getAllCloudFolder, getQuestionSignedUrl, getTemplateSignedUrl } from '../../services/awsService';
import { getProcessByMetaData, updateProcess } from '../../services/process';
import path from 'path';
import AdmZip from 'adm-zip';
import { appConfiguration } from '../../config';
import { createQuestionStage, updateQuestionStage, questionStageMetaData } from '../../services/questionStage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createQuestionSetSatge, questionSetStageMetaData, updateQuestionStageSet } from '../../services/questionSetStage';
import { createContentSage, contentStageMetaData, updateContentStage } from '../../services/contentStage';
import * as uuid from 'uuid';
import { createContent } from '../../services/content ';
import { ContentStage } from '../../models/contentStage';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createQuestionSet } from '../../services/questionSet';
import { QuestionStage } from '../../models/questionStage';
import { QuestionSetStage } from '../../models/questionSetSatge';
import { createQuestion } from '../../services/question';

const { csvFileName, cronJobPrcessUpdate, grid1AddFields, mcqFields, fibFields, grid2Fields, bucketName } = appConfiguration;

const s3Client = new S3Client({});

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
        await validateZipFiles(process_id, s3Objects, folderPath, fileName, validFileNames);
      }
    } catch (error) {
      const code = _.get(error, 'code', 'QUESTION_JOB_PROCESS');
      const errorMsg = error instanceof Error ? error.message : 'Error during upload validation.Re upload file for new process';
      logger.error({ code, errorMsg });
    }
  });
  checkStatus.start();
};

const isFolderEmpty = (s3Objects: any): boolean => {
  return !s3Objects.Contents || _.isEmpty(s3Objects.Contents);
};

const validateZipFiles = async (process_id: string, s3Objects: any, folderPath: string, fileName: string, validFileNames: string[]): Promise<boolean> => {
  try {
    const fileExt = path.extname(s3Objects.Contents[0].Key || '').toLowerCase();
    if (fileExt !== '.zip') {
      await markProcessAsFailed(process_id, 'is_unsupported_format', 'The uploaded file is an unsupported format, please upload all CSV files inside a ZIP file.');
      //return false;
    } else {
      await updateProcess(process_id, { status: 'in_progress', updated_by: 1 });
    }
    const questionZipEntries = await fetchAndExtractZipEntries('upload', folderPath, fileName);
    let mediaFolderExists = false;
    const mediaContent = questionZipEntries.filter((mediaEntry: any) => !mediaEntry.isDirectory && mediaEntry.entryName.startsWith('media/')).map((mediaEntry: any) => mediaEntry);
    for (const entry of questionZipEntries) {
      if (entry.isDirectory && entry.entryName === 'media/') {
        mediaFolderExists = true;
        break;
      }
    }

    if (!mediaFolderExists) {
      await markProcessAsFailed(process_id, 'is_media_folder_missing', 'The uploaded ZIP file does not contain a "media" folder.');
      //return false;
    }

    for (const entry of questionZipEntries) {
      if (entry.isDirectory && entry.entryName.includes('media/')) continue;
      if (!entry.isDirectory && entry.entryName.startsWith('media/')) continue;
      if (!validFileNames.includes(entry.entryName)) {
        await markProcessAsFailed(process_id, 'is_unsupported_file_name', `The uploaded file '${entry.entryName}' is not a valid file name.`);
        //return false;
      }

      await validateCSVFormat(process_id, folderPath, entry, fileName, mediaContent);
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

const validateCSVFormat = async (process_id: string, folderPath: string, entry: any, fileName: string, mediaContent: string[]): Promise<boolean> => {
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
    const [templateHeader] = templateFileContent
      .toString()
      .split('\n')
      .map((row) => row.split(','));

    const questionFileContent = entry.getData().toString('utf8');
    const [Qheader, ...Qrows] = questionFileContent
      .split('\n')
      .map((row: string) => row.split(','))
      .filter((row: string[]) => row.some((cell) => cell.trim() !== ''));
    const checkKey = entry.entryName.split('_')[1];
    switch (checkKey) {
      case 'question.csv':
        await validateQuestionCsv(entry.entryName, process_id, Qheader, Qrows, templateHeader, mediaContent);
        break;
      case 'questionSet.csv':
        await validateQuestionSetCsv(entry.entryName, process_id, Qheader, Qrows, templateHeader);
        break;
      case 'content.csv':
        await validateContentCsv(entry.entryName, process_id, Qheader, Qrows, templateHeader, mediaContent);
        return true;
      default:
        await markProcessAsFailed(process_id, 'unsupported_sheet', `Unsupported sheet in file '${entry.entryName}'.`);
    }
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error during validation. Please re-upload the file.';
    logger.error({ errorMsg, process_id });
    await markProcessAsFailed(process_id, 'failed', errorMsg);
    return false;
  }
};

const validateContentCsv = async (entryName: string, process_id: string, header: any, rows: any, templateHeader: any, mediaContent: any) => {
  try {
    const validHeader = templateHeader.every((col: any, i: number) => col === header[i]);
    if (!validHeader) {
      await markProcessAsFailed(process_id, 'invalid_column_name', `The file '${entryName}' does not match the expected CSV format.`);
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    const insertDataPromises = rows.map(async (row: any) => {
      return header.reduce(
        async (accPromise: Promise<Record<string, any>>, key: any, index: number) => {
          const acc = await accPromise;

          let cleanedKey = key.replace(/\r/g, '');
          let value = row[index].trim();
          if (cleanedKey === 'repository_name') {
            value = value || 'AMl';
          }
          if (cleanedKey === 'L2_skill' || cleanedKey === 'L3_skill' || cleanedKey === 'sub_skills') {
            value = value ? value.split('#').map((v: string) => v.trim()) : [value];
          }
          if (cleanedKey.includes('media')) {
            cleanedKey = 'media';
            value = value ? value.split('#').map((v: string) => v.trim()) : [value];
            const filteredMedia = value ? mediaContent.filter((m: any) => m.entryName.includes(value)) : [];
            let mediaValue;
            if (filteredMedia.length > 0) {
              mediaValue = await multiFileUpload(mediaContent, 'content');
              if (!mediaValue) {
                await markProcessAsFailed(process_id, 'media_file_missing', `Media file '${value}' mentioned in column '${index}' at row is missing in the ZIP file.`);
                return false;
              }
            }
            value = mediaValue;
          }
          acc[cleanedKey] = value;
          acc.process_id = process_id;
          return acc;
        },
        Promise.resolve({} as Record<string, any>),
      );
    });
    const insertData = await Promise.all(insertDataPromises);

    const createStageData = await createContentSage(insertData);
    if (createStageData.error) {
      await markProcessAsFailed(process_id, 'insert_error', `Error inserting data for row ${1}.`);
    }
    const validationError = await validateContentInsert(process_id, createStageData.dataValues.L1_skill);
    if (!validationError) {
      await markProcessAsFailed(process_id, 'insert_error', `Error inserting data for row ${createStageData.dataValues.id}.`);
    } else {
      await updateProcess(process_id, {
        status: 'completed',
      });
      await ContentStage.truncate({ restartIdentity: true });
    }
    return;
  } catch (error) {
    logger.error(error);
  }
};

const validateQuestionCsv = async (entryName: string, process_id: string, header: any, rows: any, templateHeader: any, mediaContent: any) => {
  try {
    const mediaColumns = header.filter((col: string) => col.includes('media'));
    const validHeader = templateHeader.every((col: any, i: number) => col === header[i]);
    if (header.length !== templateHeader.length) {
      await markProcessAsFailed(process_id, 'invalid_header_length', `CSV file contains more/less fields compared to the template.`);
    }
    if (!validHeader) {
      await markProcessAsFailed(process_id, 'invalid_column_name', `The file '${entryName}' does not match the expected CSV format.`);
    }
    if (mediaColumns.length === 0) {
      await markProcessAsFailed(process_id, 'media_columns_missing', `The file '${entryName}' does not contain media-related columns.`);
    }

    const insertData = await Promise.all(
      rows.map(async (row: any) => {
        const mappedRow = await header.reduce(
          async (accPromise: Promise<Record<string, any>>, key: any, index: number) => {
            const acc = await accPromise;
            let cleanedKey = key.replace(/\r/g, ''); // Clean the header key
            let value = row[index]?.trim() || ''; // Trim the row value and handle empty cases
            if (cleanedKey === 'L2_skill' || cleanedKey === 'L3_skill' || cleanedKey.includes('sub_skill')) {
              value = value ? value.split('#').map((v: string) => v.trim()) : [value];
            }
            if (value.includes('#')) {
              value = value.split('#').map((v: string) => v.trim());
            }
            if (cleanedKey.includes('media')) {
              cleanedKey = 'media';
              const filteredMedia = value ? mediaContent.filter((m: any) => m.entryName.includes(value)) : [];
              if (filteredMedia.length > 0) {
                const mediaInfo = await multiFileUpload(filteredMedia, 'question');
                if (mediaInfo) {
                  // await markProcessAsFailed(process_id, 'media_file_missing', `Media file '${value}' mentioned in column '${index}' at row is missing in the ZIP file.`);
                  value = mediaInfo;
                  // return false;
                }
              }
            }
            acc[cleanedKey] = value;
            return acc;
          },
          Promise.resolve({} as Record<string, any>),
        );
        const { hint, description, QID: question_id, ...rest } = mappedRow;
        const bodyFields = Object.fromEntries(Object.entries(rest).filter(([key]) => key.startsWith('n') || key.includes('grid') || key.includes('fib') || key.includes('mcq')));
        Object.keys(bodyFields).forEach((key) => delete mappedRow[key]);
        return {
          ...mappedRow,
          question_id,
          process_id,
          hint,
          description,
          body: { ...bodyFields },
        };
      }),
    );

    const createStageData = await createQuestionStage(insertData);

    if (createStageData.error) {
      await markProcessAsFailed(process_id, 'insert_error', `Error inserting data for row.`);
    }
    const validationError = await validateQuestionInsert(process_id, createStageData.dataValues);
    if (!validationError) {
      await markProcessAsFailed(process_id, 'insert_error', `Error inserting data for row.`);
    } else {
      await updateProcess(process_id, {
        status: 'completed',
      });
      await updateQuestionStage(
        { process_id },
        {
          status: 'is_completed',
        },
      );
      await QuestionStage.truncate({ restartIdentity: true });
    }
    return true;
  } catch (error) {
    logger.error('error in validate question');
  }
};

const validateQuestionSetCsv = async (entryName: string, process_id: string, header: any, rows: any, templateHeader: any) => {
  try {
    const validHeader = templateHeader.every((col: any, i: number) => col === header[i]);
    if (!validHeader) {
      await markProcessAsFailed(process_id, 'invalid_column_name', `The file '${entryName}' does not match the expected CSV format.`);
    }

    const insertData = rows.map((row: any) => {
      return header.reduce(
        (acc: any, key: any, index: number) => {
          const cleanedKey = key.replace(/\r/g, '');
          let value = row[index].trim();
          if (cleanedKey === 'is_atomic') {
            value = value.toLowerCase() === 'true';
          }
          if (cleanedKey === 'QSID') {
            acc['question_set_id'] = value;
          }
          if (cleanedKey === 'L2_skill' || cleanedKey === 'L3_skill' || cleanedKey.includes('sub_skill')) {
            value = value ? value.split('#').map((v: string) => v.trim()) : [value];
          }
          acc[cleanedKey] = value;
          acc.process_id = process_id;
          return acc;
        },
        {} as Record<string, any>,
      );
    });

    const createStageData = await createQuestionSetSatge(insertData);
    const validationError = await validateQuestionSetInsert(process_id, createStageData.dataValues);
    if (validationError) {
      await markProcessAsFailed(process_id, 'insert_error', `Error inserting data for row.`);
      return false;
    } else {
      // await updateProcess(process_id, {
      //   status: 'is_completed',
      // });
      await updateProcess(process_id, {
        status: 'completed',
      });
      await QuestionSetStage.truncate({ restartIdentity: true });
    }

    return true;
  } catch (error) {
    logger.error('error in validate question set');
  }
};

const validateContentInsert = async (process_id: string, L1_skill: string): Promise<boolean> => {
  try {
    const contentAll = await contentStageMetaData({ process_id, L1_skill });
    const { content } = contentAll;
    const contentInsertData = [];
    for (const c of content) {
      const checkRecord = await contentStageMetaData({ content_id: c.dataValues.content_id, L1_skill });
      if (checkRecord.content.length > 1) {
        await markProcessAsFailed(process_id, 'duplicate_Content_id', `Duplicate Content_id found ${c.dataValues.content_id}.`);
        await updateContentStage({ id: c.dataValues.id }, { status: 'errored', error_info: 'duplication fo Content and id present' });
      }
      contentInsertData.push({
        identifier: uuid.v4(),
        name: { en: c.title },
        description: { en: c.description },
        tenant: { en: c.tenant || 'AML' },
        repository: { en: c.repository_name || 'AML' },
        taxonomy: {
          l1_skill: {
            en: c.L1_skill,
          },
          l2_skill: {
            en: c.L2_skill,
          },
          l3_skill: {
            en: c.L3_skill,
          },
          board: {
            en: c.board,
          },
          class: {
            en: c.class,
          },
        },
        sub_skills: c.sub_skills || null,
        gradient: c.gradient || null,
        media: c.media,
        status: 'draft',
        created_by: 'system',
        updated_by: null,
        is_active: true,
      });
    }
    const contentInsert = await createContent(contentInsertData);
    return !contentInsert.error;
  } catch (error) {
    logger.error({ message: `Validation failed for process_id ${process_id} in content`, error });
    return true;
  }
};

const validateQuestionInsert = async (process_id: string, ques: any): Promise<boolean> => {
  try {
    const questionAll = await questionStageMetaData({ process_id, L1_skill: ques.L1_skill });
    const { question } = questionAll;
    const questionInsertData = [];

    for (const q of question) {
      const {
        dataValues: { id, question_id, question_set_id, question_type, L1_skill, body },
      } = q;

      // Check for duplicate records
      const checkRecord = await questionStageMetaData({ question_id, question_set_id, L1_skill });
      if (checkRecord.question.length > 1) {
        await updateQuestionStage(
          { id },
          {
            status: 'errored',
            error_info: 'Duplicate question and question_set_id combination found.',
          },
        );
        await markProcessAsFailed(process_id, 'duplicate_question_id', `Duplicate question_id and question_set_id combination found for question_id ${question_id}.`);
        continue;
      }

      let requiredFields: string[] = [];
      const caseKey = question_type === 'Grid-1' ? `${question_type}_${L1_skill}` : question_type;
      switch (caseKey) {
        case `Grid-1_add`:
          requiredFields = grid1AddFields;
          break;
        case `Grid-2`:
          requiredFields = grid2Fields;
          break;
        case `mcq`:
          requiredFields = mcqFields; // Define mcqFields based on your requirements
          break;
        case `fib`:
          requiredFields = fibFields; // Define fibFields based on your requirements
          break;
        default:
          requiredFields = [];
          break;
      }

      // Validate required fields
      if (!requiredFields.every((field) => body[field])) {
        await updateQuestionStage(
          { id },
          {
            status: 'errored',
            error_info: `Missing required data: ${requiredFields.join(', ')}`,
          },
        );
        await markProcessAsFailed(process_id, 'invalid_data', `Validation failed for question_id ${question_id}.`);
        continue;
      }

      const { grid_fib_n1, grid_fib_n2, grid1_pre_fills_quotient, grid1_pre_fills_remainder } = body;
      const prefillValues = [grid1_pre_fills_quotient, grid1_pre_fills_remainder];
      const filledValues = prefillValues.map((p) => (p === 'F' ? 'Filled' : p === 'B' ? 'Empty' : p));
      const intermediateSteps = calculateIntermediateSteps(parseInt(grid_fib_n1, 10), parseInt(grid_fib_n2, 10));
      questionInsertData.push({
        identifier: uuid.v4(),
        question_set_id: q.question_set_id,
        qid: q.question_id,
        name: { en: q.question_text },
        description: { en: q.description },
        tenant: { en: q.tenant || 'AML' },
        type: q.question_type,
        operation: q.L1_skill,
        repository: { en: q.repository_name || 'AML' },
        taxonomy: {
          l1_skill: { en: q.L1_skill },
          l2_skill: { en: q.L2_skill },
          l3_skill: { en: q.L3_skill },
          board: { en: q.board },
          class: { en: q.class },
        },
        sub_skills: q.sub_skills,
        benchmark_time: 1 * q.benchmark_time,
        status: 'draft',
        created_by: 'system',
        updated_by: null,
        is_active: true,
        question_body: {
          numbers: [grid_fib_n1, grid_fib_n2],
          showCarry: grid1_pre_fills_quotient === 'F',
          prefill: filledValues,
          division_intermediate_steps_preFill: intermediateSteps.intermediate_steps.map((step) => step.quotient),
          wrongAnswers: [],
        },
      });
    }

    if (questionInsertData.length > 0) {
      await createQuestion(questionInsertData);
      return true;
    }
    return false;
  } catch (error) {
    logger.error({ message: `Validation failed for process_id ${process_id} in question`, error });
    return false; // Returning false on error
  }
};

// Helper function to calculate intermediate steps
const calculateIntermediateSteps = (dividend: number, divisor: number) => {
  const steps = [];
  let current = dividend;
  while (current >= divisor) {
    const quotient = Math.floor(current / divisor);
    const remainder = current % divisor;
    steps.push({
      step: steps.length + 1,
      division: `${current} ÷ ${divisor}`,
      quotient: quotient,
      remainder: remainder,
    });
    current = remainder * 10; // Bring down the next digit
  }
  return {
    intermediate_steps: steps,
    final_result: {
      quotient: steps.reduce((acc, step) => acc + step.quotient, ''),
      remainder: steps[steps.length - 1]?.remainder || 0,
    },
  };
};

const validateQuestionSetInsert = async (process_id: string, ques: any): Promise<boolean> => {
  try {
    const questionAll = await questionSetStageMetaData({ process_id, L1_skill: ques.L1_skill });
    const { questionSet } = questionAll;
    const questionSetInsertData = [];
    for (const q of questionSet) {
      const {
        dataValues: { id, question_set_id },
      } = q;
      const checkRecord = await questionSetStageMetaData({ question_set_id });
      if (checkRecord.questionSet.length > 1) {
        await markProcessAsFailed(process_id, 'duplicate_question_id', `Duplicate question_set_id  found for question_id ${question_set_id}.`);
        await updateQuestionStage({ id }, { status: 'errored', error_info: 'duplication for question set id present' });
        questionSetInsertData.push({
          identifier: uuid.v4(),
          qsid: q.question_set_id,
          title: { en: q.title },
          description: { en: q.description },
          tenant: { en: q.tenant || 'AML' },
          repository: { en: q.repository_name || 'AML' },
          sequence: 1 * q.sequence,
          taxonomy: {
            l1_skill: {
              en: q.L1_skill,
            },
            l2_skill: {
              en: q.L2_skill,
            },
            l3_skill: {
              en: q.L3_skill,
            },
            board: {
              en: q.board,
            },
            class: {
              en: q.class,
            },
          },
          sub_skills: q.sub_skills,
          purpose: q.purpose,
          gradient: q.gradient,
          is_atomic: q.is_atomic,
          group_name: q.group_name,
          status: 'draft',
          created_by: 'system',
          updated_by: null,
          is_active: true,
        });
      }
    }
    if (questionSetInsertData.length > 0) {
      await createQuestionSet(questionSetInsertData);
      return true;
    }
    return false;
  } catch (error) {
    logger.error({ message: `Validation failed for process_id ${process_id} in question set`, error });
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
    status: 'open',
  });
};

const multiFileUpload = async (media: any[], type: string): Promise<any[]> => {
  const results: { src: string; fileName: string }[] = [];
  for (const m of media) {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `media/${type}/${m.entryName.split('/')[1]}`,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * 300,
    });

    if (url) {
      const response = await fetch(url, { method: 'PUT', body: m.getData() });

      if (response.ok) {
        results.push({
          src: 'media/question',
          fileName: m.entryName.split('/')[1],
        });
      }
    }
  }
  return results ? results : [];
};
