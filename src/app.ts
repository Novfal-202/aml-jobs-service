import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import { NOT_FOUND } from 'http-status';
import { appConfiguration, AppDataSource } from './config';
import logger from './utils/logger';
import { amlErrorHandler } from './middlewares/errorhandler';
import { scheduleCronJob } from './controllers/BulkUpload/questionStatusJob';

const { envPort } = appConfiguration;

const app: Application = express();

let server: ReturnType<typeof app.listen>;

// Define the error handler
const unexpectedErrorHandler = (error: Error): void => {
  logger.error('An unexpected error occurred', { message: error.message, stack: error.stack });
  exitHandler();
};

// Graceful server shutdown
const exitHandler = (): void => {
  if (server) {
    // Check if server is defined
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

const initializeServer = async (): Promise<void> => {
  try {
    // Middleware for parsing JSON request body
    app.use(express.json({ limit: '5mb' }));

    // Middleware for parsing urlencoded request body
    app.use(express.urlencoded({ extended: true }));

    // Middleware to enable CORS
    app.use(cors());

    // Enable CORS preflight for all routes
    app.options('*', cors());

    app.use(amlErrorHandler);

    // 404 handler for unknown API requests
    app.use((req: Request, res: Response, next: NextFunction) => {
      next({ statusCode: NOT_FOUND, message: 'Not found' });
    });

    // Database connection
    await AppDataSource.sync().finally(() => logger.info('db connected'));

    // Start the server
    app.listen(envPort, () => {
      logger.info(`Port served.`);
    });

    scheduleCronJob();

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', unexpectedErrorHandler);
    process.on('unhandledRejection', unexpectedErrorHandler);
  } catch (error: any) {
    logger.error('Failed to start server', { message: error.message });
    process.exit(1);
  }
};

// Start the server
void initializeServer();

// Export for testing
export default app;
