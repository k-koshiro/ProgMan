import express from 'express';
import {
  getSchedulesByProject,
  updateSchedule,
  getMilestoneEstimatesByProject,
  upsertMilestoneEstimate
} from '../db/queries.js';

const router = express.Router();

router.get('/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const schedules = await getSchedulesByProject(projectId);

    // 除外すべき古いカテゴリのリスト
    const excludedCategories = ['プロマネ', '検査技術', '企画システム'];

    // 除外カテゴリをフィルタリング
    const filteredSchedules = schedules.filter(schedule => {
      const category = (schedule.category || '').trim();
      return !excludedCategories.includes(category);
    });

    res.json(filteredSchedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const schedule = { ...req.body, id };
    console.log('HTTP PUT request for schedule:', schedule);
    await updateSchedule(schedule);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// マイルストーン見込み日を取得
router.get('/:projectId/milestone-estimates', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const estimates = await getMilestoneEstimatesByProject(projectId);
    res.json(estimates);
  } catch (error) {
    console.error('Error fetching milestone estimates:', error);
    res.status(500).json({ error: 'Failed to fetch milestone estimates' });
  }
});

// マイルストーン見込み日を更新
router.put('/:projectId/milestone-estimates/:scheduleId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const scheduleId = parseInt(req.params.scheduleId);
    const { estimate_date } = req.body;

    await upsertMilestoneEstimate({
      project_id: projectId,
      schedule_id: scheduleId,
      estimate_date: estimate_date || null
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating milestone estimate:', error);
    res.status(500).json({ error: 'Failed to update milestone estimate' });
  }
});

export default router;
