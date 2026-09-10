import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
// .env takes precedence over inherited shell vars (shells may export PORT etc.)
dotenv.config({ override: true });
import { connectDatabase } from '../config/database';
import { initSocket } from '../websocket/socket';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler';
import routes from '../routes';
import { logger } from '../utils/logger';
import { ensureUploadDir } from '../config/storage';
import { seed } from '../seed/seedData';

import { startScheduledJobs } from '../jobs/scheduledJobs';

const app = express();
const server = http.createServer(app);

ensureUploadDir();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/uploads', express.static('uploads'));

app.use('/api/v1', routes);

app.use('/api/v1/health', (_req, res) => {
  res.json({ success: true, message: 'Attendance System API is running', timestamp: new Date().toISOString() });
});

app.use(errorHandler);
app.use(notFoundHandler);

const PORT = process.env.PORT || 5000;

async function start(): Promise<void> {
  try {
    await connectDatabase();

    // Auto-seed when the database is empty so a fresh checkout boots with demo data
    const { UserModel } = await import('../models/User');
    const userCount = await UserModel.estimatedDocumentCount();
    if (userCount === 0) {
      logger.info('Empty database detected — seeding demo data…');
      const { seed } = await import('../seed/seedData');
      await seed();
    }

    initSocket(server);
    startScheduledJobs();
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/api/v1/health`);
    });
  } catch (error: any) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

if (process.env.SEED === 'true') {
  seed().then(() => start()).catch((err) => { logger.error(err); process.exit(1); });
} else {
  start();
}
