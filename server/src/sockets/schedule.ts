import { Server, Socket } from 'socket.io';
import { updateSchedule, getSchedulesByProject } from '../db/queries.js';
import { Schedule } from '../types/index.js';

export const setupScheduleSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);
    
    let currentProjectId: number | null = null;
    
    socket.on('join-project', (projectId: number) => {
      if (currentProjectId) {
        socket.leave(`project-${currentProjectId}`);
      }
      currentProjectId = projectId;
      socket.join(`project-${projectId}`);
      console.log(`Socket ${socket.id} joined project ${projectId}`);
    });
    
    socket.on('update-schedule', async (data: Partial<Schedule>) => {
      try {
        const projectId = data.project_id || currentProjectId;
        if (!projectId) {
          socket.emit('error', { message: 'Project ID is required' });
          return;
        }
        
        // データベースから最新のスケジュールを取得して配信
        const updatedSchedules = await getSchedulesByProject(projectId);
        io.to(`project-${projectId}`).emit('schedules-updated', updatedSchedules);
      } catch (error) {
        console.error('Error broadcasting schedule update:', error);
        socket.emit('error', { message: 'Failed to broadcast update' });
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};