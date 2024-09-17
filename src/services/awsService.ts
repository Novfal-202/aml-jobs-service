import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { appConfiguration } from '../config';

const { bucketName } = appConfiguration;

const s3Client = new S3Client({});

export const getTemplateSignedUrl = async (folderName: string, fileName: string, expiry: number) => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: `${folderName}/${fileName}`,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * expiry || 300,
    });

    return { error: false, url, message: 'success' };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to generate URL for get' : '';
    return { error: true, message: errorMsg };
  }
};

export const uploadTemplateSignedUrl = async (folderName: string, fileName: string, expiry: number) => {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `${folderName}/${fileName}`,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * expiry || 300,
    });

    return { error: false, fileName, url, message: 'success' };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to generate URLs for upload' : '';
    return { error: true, message: errorMsg };
  }
};

export const uploadSignedUrl = async (fileName: string) => {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * 300,
    });

    return { error: false, fileName, url, message: 'success' };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to generate URLs for upload' : '';
    return { error: true, message: errorMsg };
  }
};

export const getQuestionSignedUrl = async (folderName: string, fileName: string, expiry: number) => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: `${folderName}/${fileName}`,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * expiry || 300,
    });

    return { error: false, url, message: 'success' };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to generate URL for get' : '';
    return { error: true, message: errorMsg };
  }
};

export const getAllCloudFolder = async (folderPath: string) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: folderPath,
    });

    const s3Objects = await s3Client.send(command);
    const { Contents } = s3Objects;
    return { error: false, Contents, message: 'success' };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to get all folder' : '';
    return { error: true, message: errorMsg };
  }
};

export const uploadmedia = async (fileName: string) => {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 60 * 300,
    });

    return { error: false, fileName, url, message: 'success' };
  } catch (error) {
    const err = error instanceof Error;
    const errorMsg = err ? error.message || 'failed to generate URLs for upload' : '';
    return { error: true, message: errorMsg };
  }
};
