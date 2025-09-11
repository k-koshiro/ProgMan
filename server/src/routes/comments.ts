import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCommentsByProject, upsertComment } from '../db/queries.js';

const router = express.Router();

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

// プロジェクト内の全コメント取得
router.get('/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const rows = await getCommentsByProject(projectId);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// 当日分を含めたUpsert（owner×date）
router.post('/', async (req, res) => {
  try {
    const { project_id, owner, body, comment_date } = req.body || {};
    const dateStr = comment_date || new Date().toISOString().slice(0, 10);
    await upsertComment({ project_id, owner, comment_date: dateStr, body: body ?? '' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error upserting comment:', error);
    res.status(500).json({ error: 'Failed to upsert comment' });
  }
});

export default router;
