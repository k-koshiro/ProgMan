import { Server, Socket } from 'socket.io';
import { getSchedulesByProject, getCommentsByProjectAndDate } from '../db/queries.js';
import { Schedule } from '../types/index.js';

export const setupScheduleSocket = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);
    
    let currentProjectId: number | null = null;
    let currentCommentRoom: { projectId: number; date: string } | null = null;

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

    // コメント更新通知（HTTP保存後にクライアントから発火想定）
    socket.on('join-comment-page', (payload?: { projectId?: number; date?: string }) => {
      const projectId = payload?.projectId ?? currentProjectId;
      const date = payload?.date;
      if (!projectId || !date) {
        socket.emit('error', { message: 'Project ID and date are required' });
        return;
      }
      if (currentCommentRoom) {
        socket.leave(`project-${currentCommentRoom.projectId}-${currentCommentRoom.date}`);
      }
      currentCommentRoom = { projectId, date };
      socket.join(`project-${projectId}-${date}`);
      console.log(`Socket ${socket.id} joined comment page ${projectId}-${date}`);
    });

    socket.on('leave-comment-page', () => {
      if (currentCommentRoom) {
        socket.leave(`project-${currentCommentRoom.projectId}-${currentCommentRoom.date}`);
        currentCommentRoom = null;
      }
    });

    const emitComments = async (projectId: number, date: string) => {
      const comments = await getCommentsByProjectAndDate(projectId, date);
      io.to(`project-${projectId}-${date}`).emit('comments-updated', { date, comments });
    };

    socket.on('refresh-comments', async (payload?: { projectId?: number; date?: string }) => {
      try {
        const projectId = payload?.projectId ?? currentCommentRoom?.projectId ?? currentProjectId;
        const date = payload?.date ?? currentCommentRoom?.date;
        if (!projectId || !date) {
          socket.emit('error', { message: 'Project ID and date are required' });
          return;
        }
        await emitComments(projectId, date);
      } catch (error) {
        console.error('Error broadcasting comments update:', error);
        socket.emit('error', { message: 'Failed to broadcast comments update' });
      }
    });

    // 互換性のための旧イベント名
    socket.on('update-comment', async (projectIdParam?: number | { projectId?: number; date?: string }) => {
      try {
        if (typeof projectIdParam === 'object' && projectIdParam !== null) {
          const { projectId, date } = projectIdParam;
          if (!projectId || !date) {
            socket.emit('error', { message: 'Project ID and date are required' });
            return;
          }
          await emitComments(projectId, date);
          return;
        }
        const projectId = typeof projectIdParam === 'number' ? projectIdParam : currentCommentRoom?.projectId ?? currentProjectId;
        const date = currentCommentRoom?.date;
        if (!projectId || !date) {
          socket.emit('error', { message: 'Project ID and date are required' });
          return;
        }
        await emitComments(projectId, date);
      } catch (error) {
        console.error('Error broadcasting comments update:', error);
        socket.emit('error', { message: 'Failed to broadcast comments update' });
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};
