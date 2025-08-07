import { create } from 'zustand';
import { Schedule, Project } from '../types';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

interface ScheduleStore {
  projects: Project[];
  currentProject: Project | null;
  schedules: Schedule[];
  socket: Socket | null;
  loading: boolean;
  error: string | null;
  
  fetchProjects: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
  deleteProject: (projectId: number) => Promise<void>;
  selectProject: (project: Project) => void;
  fetchSchedules: (projectId: number) => Promise<void>;
  updateSchedule: (schedule: Partial<Schedule>) => void;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  projects: [],
  currentProject: null,
  schedules: [],
  socket: null,
  loading: false,
  error: null,
  
  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get('/progress-manager/api/projects');
      set({ projects: response.data, loading: false });
    } catch (error) {
      set({ error: 'Failed to fetch projects', loading: false });
      console.error('Error fetching projects:', error);
    }
  },
  
  createProject: async (name: string) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post('/progress-manager/api/projects', { name });
      const newProject = response.data;
      set(state => ({
        projects: [newProject, ...state.projects],
        loading: false
      }));
    } catch (error) {
      set({ error: 'Failed to create project', loading: false });
      console.error('Error creating project:', error);
    }
  },
  
  deleteProject: async (projectId: number) => {
    set({ loading: true, error: null });
    try {
      await axios.delete(`/progress-manager/api/projects/${projectId}`);
      set(state => ({
        projects: state.projects.filter(p => p.id !== projectId),
        loading: false
      }));
    } catch (error) {
      set({ error: 'Failed to delete project', loading: false });
      console.error('Error deleting project:', error);
    }
  },
  
  selectProject: (project: Project) => {
    set({ currentProject: project });
    get().fetchSchedules(project.id);
  },
  
  fetchSchedules: async (projectId: number) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get(`/progress-manager/api/schedules/${projectId}`);
      set({ schedules: response.data, loading: false });
      
      const socket = get().socket;
      if (socket) {
        socket.emit('join-project', projectId);
      }
    } catch (error) {
      set({ error: 'Failed to fetch schedules', loading: false });
      console.error('Error fetching schedules:', error);
    }
  },
  
  updateSchedule: async (schedule: Partial<Schedule>) => {
    try {
      // HTTPリクエストで更新
      await axios.put(`/progress-manager/api/schedules/${schedule.id}`, schedule);
      
      // ローカルの状態を即座に更新（楽観的更新）
      set(state => ({
        schedules: state.schedules.map(s => 
          s.id === schedule.id 
            ? { ...s, ...schedule }
            : s
        )
      }));
      
      // Socket.ioで他のクライアントに通知
      const socket = get().socket;
      if (socket && get().currentProject) {
        socket.emit('update-schedule', { ...schedule, project_id: get().currentProject?.id });
      }
      
      // サーバーから最新データを取得（バックグラウンドで）
      const projectId = get().currentProject?.id;
      if (projectId) {
        setTimeout(async () => {
          try {
            const response = await axios.get(`/progress-manager/api/schedules/${projectId}`);
            set({ schedules: response.data });
          } catch (error) {
            console.error('Error fetching updated schedules:', error);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
      set({ error: 'Failed to update schedule' });
    }
  },
  
  connectSocket: () => {
    const socket = io(window.location.origin, {
      path: '/progress-manager/socket.io/'
    });
    
    socket.on('connect', () => {
      console.log('Connected to server');
    });
    
    socket.on('schedules-updated', (schedules: Schedule[]) => {
      // 現在編集中のセルがある場合は、その値を保持
      const currentSchedules = get().schedules;
      const mergedSchedules = schedules.map(newSchedule => {
        const currentSchedule = currentSchedules.find(s => s.id === newSchedule.id);
        // 現在のローカル状態に値がある場合は保持（編集中の可能性）
        if (currentSchedule) {
          return {
            ...newSchedule,
            // ローカルで編集中の値があれば保持
            ...(currentSchedule.start_date !== newSchedule.start_date && currentSchedule.start_date ? { start_date: currentSchedule.start_date } : {}),
            ...(currentSchedule.duration !== newSchedule.duration && currentSchedule.duration ? { duration: currentSchedule.duration } : {}),
            ...(currentSchedule.owner !== newSchedule.owner && currentSchedule.owner ? { owner: currentSchedule.owner } : {}),
            ...(currentSchedule.actual_start !== newSchedule.actual_start && currentSchedule.actual_start ? { actual_start: currentSchedule.actual_start } : {}),
            ...(currentSchedule.actual_duration !== newSchedule.actual_duration && currentSchedule.actual_duration ? { actual_duration: currentSchedule.actual_duration } : {})
          };
        }
        return newSchedule;
      });
      set({ schedules: mergedSchedules });
    });
    
    socket.on('error', (error: { message: string }) => {
      set({ error: error.message });
    });
    
    set({ socket });
  },
  
  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  }
}));