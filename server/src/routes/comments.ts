import express from 'express';
import { Server } from 'socket.io';
import {
  createCommentPage,
  deleteCommentPage,
  getCommentPage,
  getCommentPages,
  getCommentsByProjectAndDate,
  getLatestCommentPageDate,
  upsertComment,
} from '../db/queries.js';

const router = express.Router();

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

const parseProjectId = (value: string | undefined) => {
  if (!value) return NaN;
  return parseInt(value, 10);
};

const ensureValidDate = (input: unknown): string | null => {
  if (typeof input !== 'string') return null;
  return isoDatePattern.test(input) ? input : null;
};

// 固定セクション（全体報告・担当者一覧）
router.get('/sections', async (_req, res) => {
  // 現仕様は固定配置で返却（必要に応じてJSONから読込へ切替可能）
  res.json({
    overallKey: '__OVERALL__',
    overallLabel: '全体報告',
    left: ['デザイン','メカ','ハード','ゲージ','プロマネ'],
    right: ['企画','画像','出玉','サブ','メイン']
  });
});

// コメントページ一覧
router.get('/:projectId/pages', async (req, res) => {
  try {
    const projectId = parseProjectId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      res.status(400).json({ error: 'Invalid projectId' });
      return;
    }
    const pages = await getCommentPages(projectId);
    res.json({
      pages,
      latestDate: pages.length > 0 ? pages[0].comment_date : null,
    });
  } catch (error) {
    console.error('Error fetching comment pages:', error);
    res.status(500).json({ error: 'Failed to fetch comment pages' });
  }
});

// コメントページ作成
router.post('/:projectId/pages', async (req, res) => {
  try {
    const projectId = parseProjectId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      res.status(400).json({ error: 'Invalid projectId' });
      return;
    }
    const commentDate = ensureValidDate(req.body?.comment_date);
    if (!commentDate) {
      res.status(400).json({ error: 'Invalid comment_date' });
      return;
    }
    const page = await createCommentPage(projectId, commentDate);
    const io = req.app.get('io') as Server | undefined;
    io?.to(`project-${projectId}`).emit('comment-page-created', { projectId, comment_date: commentDate });
    res.status(201).json(page);
  } catch (error) {
    if ((error as Error).message?.includes('SQLITE_CONSTRAINT')) {
      res.status(409).json({ error: 'Comment page already exists' });
      return;
    }
    console.error('Error creating comment page:', error);
    res.status(500).json({ error: 'Failed to create comment page' });
  }
});

// コメントページ削除
router.delete('/:projectId/pages/:date', async (req, res) => {
  try {
    const projectId = parseProjectId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      res.status(400).json({ error: 'Invalid projectId' });
      return;
    }
    const commentDate = ensureValidDate(req.params.date);
    if (!commentDate) {
      res.status(400).json({ error: 'Invalid comment_date' });
      return;
    }
    const exists = await getCommentPage(projectId, commentDate);
    if (!exists) {
      res.status(404).json({ error: 'Comment page not found' });
      return;
    }
    await deleteCommentPage(projectId, commentDate);
    const io = req.app.get('io') as Server | undefined;
    io?.to(`project-${projectId}`).emit('comment-page-deleted', { projectId, comment_date: commentDate });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting comment page:', error);
    res.status(500).json({ error: 'Failed to delete comment page' });
  }
});

// プロジェクト内のコメント取得（日付単位）
router.get('/:projectId', async (req, res) => {
  try {
    const projectId = parseProjectId(req.params.projectId);
    if (Number.isNaN(projectId)) {
      res.status(400).json({ error: 'Invalid projectId' });
      return;
    }
    const queryDate = ensureValidDate(typeof req.query.date === 'string' ? req.query.date : undefined);
    const latestDate = await getLatestCommentPageDate(projectId);

    if (!queryDate) {
      if (!latestDate) {
        res.json({ comments: [], latestDate: null });
        return;
      }
      const comments = await getCommentsByProjectAndDate(projectId, latestDate);
      res.json({ comments, latestDate });
      return;
    }

    const page = await getCommentPage(projectId, queryDate);
    if (!page) {
      res.status(404).json({ error: 'Comment page not found', latestDate });
      return;
    }

    const comments = await getCommentsByProjectAndDate(projectId, queryDate);
    res.json({ comments, latestDate });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// 当日分を含めたUpsert（owner×date）
router.post('/', async (req, res) => {
  try {
    const { project_id, owner, body, comment_date } = req.body || {};
    const projectId = typeof project_id === 'number' ? project_id : parseInt(project_id, 10);
    const dateStr = ensureValidDate(comment_date) || new Date().toISOString().slice(0, 10);
    if (!projectId || !owner) {
      res.status(400).json({ error: 'project_id and owner are required' });
      return;
    }
    await upsertComment({ project_id: projectId, owner, comment_date: dateStr, body: body ?? '' });
    const comments = await getCommentsByProjectAndDate(projectId, dateStr);
    const io = req.app.get('io') as Server | undefined;
    io?.to(`project-${projectId}-${dateStr}`).emit('comments-updated', { date: dateStr, comments });
    res.json({ success: true, comment_date: dateStr });
  } catch (error) {
    console.error('Error upserting comment:', error);
    res.status(500).json({ error: 'Failed to upsert comment' });
  }
});

export default router;
