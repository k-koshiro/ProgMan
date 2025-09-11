import { create } from 'zustand';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import type { CommentEntry } from '../types';

interface CommentStore {
  comments: CommentEntry[];
  socket: Socket | null;
  loading: boolean;
  error: string | null;

  fetchComments: (projectId: number) => Promise<void>;
  upsertComment: (input: { project_id: number; owner: string; body: string; comment_date?: string }) => Promise<void>;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export const useCommentStore = create<CommentStore>((set, get) => ({
  comments: [],
  socket: null,
  loading: false,
  error: null,

  fetchComments: async (projectId: number) => {
    set({ loading: true, error: null });
    try {
      const res = await axios.get(`/progress-manager/api/comments/${projectId}`);
      set({ comments: res.data, loading: false });
      const socket = get().socket;
      if (socket) socket.emit('join-project', projectId);
    } catch (e) {
      console.error('fetchComments error', e);
      set({ error: 'Failed to fetch comments', loading: false });
    }
  },

  upsertComment: async ({ project_id, owner, body, comment_date }) => {
    try {
      await axios.post('/progress-manager/api/comments', { project_id, owner, body, comment_date });
      // 楽観更新: 今日分を差し替え
      const today = (comment_date || new Date().toISOString().slice(0, 10));
      set(state => {
        const idx = state.comments.findIndex(c => c.project_id === project_id && c.owner === owner && c.comment_date === today);
        if (idx >= 0) {
          const next = [...state.comments];
          next[idx] = { ...next[idx], body };
          return { comments: next };
        }
        return { comments: [{ project_id, owner, comment_date: today, body }, ...state.comments] };
      });
      const socket = get().socket;
      if (socket) socket.emit('update-comment', project_id);
    } catch (e) {
      console.error('upsertComment error', e);
      set({ error: 'Failed to save comment' });
    }
  },

  connectSocket: () => {
    const socket = io(window.location.origin, { path: '/progress-manager/socket.io/' });
    socket.on('connect', () => console.log('Comments socket connected'));
    socket.on('comments-updated', (rows: CommentEntry[]) => set({ comments: rows }));
    socket.on('error', (err: { message: string }) => set({ error: err.message }));
    set({ socket });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));

