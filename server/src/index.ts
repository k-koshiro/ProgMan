import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

import { initDatabase } from './db/init.js';
import { addBaseDateColumn } from './db/migrate.js';
import projectRoutes from './routes/projects.js';
import scheduleRoutes from './routes/schedules.js';
import versionRoutes from './routes/version.js';
import uploadRoutes from './routes/upload.js';
import { setupScheduleSocket } from './sockets/schedule.js';

const __filename = fileURLToPath(import.meta.url || '');
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket.io/',
  cors: {
    origin: ['http://localhost:5173', 'http://com3887'],
    methods: ['GET', 'POST', 'PUT'],
    credentials: true
  }
});

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use('/api/projects', projectRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/version', versionRoutes);
app.use('/api/upload', uploadRoutes);

setupScheduleSocket(io);

const startServer = async () => {
  try {
    await initDatabase();
    await addBaseDateColumn();
    
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
