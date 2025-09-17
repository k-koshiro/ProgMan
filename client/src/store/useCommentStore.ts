import { create } from 'zustand';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import type { CommentEntry, CommentPage, CategoryProgress, ProgressStatus } from '../types';

interface CommentStore {
  comments: CommentEntry[];
  commentPages: CommentPage[];
  categoryProgress: CategoryProgress[];
  latestDate: string | null;
  activeDate: string | null;
  currentProjectId: number | null;
  socket: Socket | null;
  loading: boolean;
  error: string | null;

  fetchCommentPages: (projectId: number) => Promise<{ pages: CommentPage[]; latestDate: string | null }>;
  fetchComments: (projectId: number, date: string) => Promise<void>;
  createCommentPage: (projectId: number, date: string) => Promise<CommentPage>;
  deleteCommentPage: (projectId: number, date: string) => Promise<void>;
  upsertComment: (input: { project_id: number; owner: string; body: string; comment_date: string }) => Promise<void>;
  fetchCategoryProgress: (projectId: number, date: string) => Promise<void>;
  updateCategoryProgress: (projectId: number, category: string, date: string, status: ProgressStatus) => Promise<void>;
  connectSocket: (projectId: number, date: string) => void;
  joinCommentPage: (projectId: number, date: string) => void;
  disconnectSocket: () => void;
}

type CommentsUpdatedPayload = { date: string; comments: CommentEntry[] };
type ProgressUpdatedPayload = { date: string; progressList: CategoryProgress[] };
type CommentPageEventPayload = { projectId: number; comment_date: string };

const sortPagesDesc = (pages: CommentPage[]) =>
  [...pages].sort((a, b) => (a.comment_date < b.comment_date ? 1 : a.comment_date > b.comment_date ? -1 : 0));

export const useCommentStore = create<CommentStore>((set, get) => ({
  comments: [],
  commentPages: [],
  categoryProgress: [],
  latestDate: null,
  activeDate: null,
  currentProjectId: null,
  socket: null,
  loading: false,
  error: null,

  fetchCommentPages: async (projectId: number) => {
    set({ loading: true, error: null, currentProjectId: projectId });
    try {
      const res = await axios.get(`/progress-manager/api/comments/${projectId}/pages`);
      const { pages, latestDate } = res.data as { pages: CommentPage[]; latestDate: string | null };
      set({ commentPages: sortPagesDesc(pages), latestDate, loading: false });
      return { pages, latestDate };
    } catch (e) {
      console.error('fetchCommentPages error', e);
      set({ error: 'コメントページ一覧の取得に失敗しました', loading: false });
      throw e;
    }
  },

  fetchComments: async (projectId: number, date: string) => {
    set({ loading: true, error: null, currentProjectId: projectId, activeDate: date });
    try {
      const res = await axios.get(`/progress-manager/api/comments/${projectId}`, { params: { date } });
      const { comments, latestDate } = res.data as { comments: CommentEntry[]; latestDate: string | null };
      set({ comments, latestDate: latestDate ?? get().latestDate, loading: false, activeDate: date });
    } catch (e) {
      console.error('fetchComments error', e);
      set({ error: 'コメントの取得に失敗しました', loading: false });
      throw e;
    }
  },

  createCommentPage: async (projectId: number, date: string) => {
    try {
      const res = await axios.post(`/progress-manager/api/comments/${projectId}/pages`, { comment_date: date });
      const page = res.data as CommentPage;
      set(state => {
        const exists = state.commentPages.some(p => p.comment_date === page.comment_date);
        const nextPages = exists ? state.commentPages : sortPagesDesc([page, ...state.commentPages]);
        return {
          commentPages: nextPages,
          latestDate: nextPages.length > 0 ? nextPages[0].comment_date : state.latestDate,
        };
      });
      return page;
    } catch (e) {
      console.error('createCommentPage error', e);
      set({ error: 'コメントページの作成に失敗しました' });
      throw e;
    }
  },

  deleteCommentPage: async (projectId: number, date: string) => {
    try {
      await axios.delete(`/progress-manager/api/comments/${projectId}/pages/${date}`);
      set(state => {
        const nextPages = state.commentPages.filter(p => p.comment_date !== date);
        return {
          commentPages: nextPages,
          latestDate: nextPages.length > 0 ? nextPages[0].comment_date : null,
          comments: state.activeDate === date ? [] : state.comments,
          activeDate: state.activeDate === date ? null : state.activeDate,
        };
      });
    } catch (e) {
      console.error('deleteCommentPage error', e);
      set({ error: 'コメントページの削除に失敗しました' });
      throw e;
    }
  },

  upsertComment: async ({ project_id, owner, body, comment_date }) => {
    try {
      await axios.post('/progress-manager/api/comments', { project_id, owner, body, comment_date });
      set(state => {
        if (state.activeDate !== comment_date) return state;
        const idx = state.comments.findIndex(c => c.project_id === project_id && c.owner === owner && c.comment_date === comment_date);
        if (idx >= 0) {
          const next = [...state.comments];
          next[idx] = { ...next[idx], body };
          return { comments: next };
        }
        return { comments: [...state.comments, { project_id, owner, comment_date, body }] };
      });
    } catch (e) {
      console.error('upsertComment error', e);
      set({ error: 'コメントの保存に失敗しました' });
      throw e;
    }
  },

  fetchCategoryProgress: async (projectId: number, date: string) => {
    try {
      const res = await axios.get(`/progress-manager/api/comments/${projectId}/progress`, {
        params: { date }
      });
      const { progressList } = res.data as { progressList: CategoryProgress[]; date: string };
      set({ categoryProgress: progressList });
    } catch (e) {
      console.error('fetchCategoryProgress error', e);
      set({ error: 'カテゴリ進捗状態の取得に失敗しました' });
      throw e;
    }
  },

  updateCategoryProgress: async (projectId: number, category: string, date: string, status: ProgressStatus) => {
    try {
      await axios.put(`/progress-manager/api/comments/${projectId}/progress`, {
        category,
        progress_date: date,
        status
      });
      set(state => {
        const idx = state.categoryProgress.findIndex(
          p => p.project_id === projectId && p.category === category && p.progress_date === date
        );
        if (idx >= 0) {
          const next = [...state.categoryProgress];
          next[idx] = { ...next[idx], status };
          return { categoryProgress: next };
        }
        return {
          categoryProgress: [...state.categoryProgress, {
            project_id: projectId,
            category,
            progress_date: date,
            status
          }]
        };
      });
    } catch (e) {
      console.error('updateCategoryProgress error', e);
      set({ error: 'カテゴリ進捗状態の更新に失敗しました' });
      throw e;
    }
  },

  connectSocket: (projectId: number, date: string) => {
    const currentSocket = get().socket;
    if (currentSocket) {
      currentSocket.emit('join-project', projectId);
      currentSocket.emit('join-comment-page', { projectId, date });
      set({ currentProjectId: projectId });
      return;
    }

    const socket = io(window.location.origin, { path: '/progress-manager/socket.io/' });
    socket.on('connect', () => console.log('Comments socket connected'));
    socket.on('comments-updated', (payload: CommentsUpdatedPayload) => {
      set(state => {
        if (!payload?.date) return state;
        if (state.activeDate && state.activeDate !== payload.date) {
          return state;
        }
        return { comments: payload.comments, activeDate: payload.date };
      });
    });
    socket.on('progress-updated', (payload: ProgressUpdatedPayload) => {
      set(state => {
        if (!payload?.date) return state;
        if (state.activeDate && state.activeDate !== payload.date) {
          return state;
        }
        return { categoryProgress: payload.progressList };
      });
    });
    socket.on('comment-page-created', (payload: CommentPageEventPayload) => {
      set(state => {
        if (state.currentProjectId !== payload.projectId) return state;
        const exists = state.commentPages.some(p => p.comment_date === payload.comment_date);
        if (exists) return state;
        const page: CommentPage = { project_id: payload.projectId, comment_date: payload.comment_date };
        const nextPages = sortPagesDesc([page, ...state.commentPages]);
        return {
          commentPages: nextPages,
          latestDate: nextPages.length > 0 ? nextPages[0].comment_date : state.latestDate,
        };
      });
    });
    socket.on('comment-page-deleted', (payload: CommentPageEventPayload) => {
      set(state => {
        if (state.currentProjectId !== payload.projectId) return state;
        const nextPages = state.commentPages.filter(p => p.comment_date !== payload.comment_date);
        const isActive = state.activeDate === payload.comment_date;
        return {
          commentPages: nextPages,
          latestDate: nextPages.length > 0 ? nextPages[0].comment_date : null,
          comments: isActive ? [] : state.comments,
          activeDate: isActive ? null : state.activeDate,
        };
      });
    });
    socket.on('error', (err: { message: string }) => set({ error: err.message }));
    socket.emit('join-project', projectId);
    socket.emit('join-comment-page', { projectId, date });
    set({ socket, currentProjectId: projectId });
  },

  joinCommentPage: (projectId: number, date: string) => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit('join-comment-page', { projectId, date });
    set({ currentProjectId: projectId });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.emit('leave-comment-page');
      socket.disconnect();
      set({ socket: null, currentProjectId: null });
    }
  },
}));
