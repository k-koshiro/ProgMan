import express from 'express';
import { getSchedulesByProject, updateSchedule, initializeProjectSchedules, deleteProjectSchedules } from '../db/queries.js';

const router = express.Router();

router.get('/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    let schedules = await getSchedulesByProject(projectId);
    
    // スケジュールが0件の場合のみ、初期データを作成
    if (schedules.length === 0) {
      console.log(`No schedules found for project ${projectId}, initializing...`);
      try {
        await initializeProjectSchedules(projectId);
        schedules = await getSchedulesByProject(projectId);
      } catch (initError) {
        console.warn('Failed to initialize schedules:', initError);
        // 初期化に失敗しても空配列を返す
        schedules = [];
      }
    }
    
    res.json(schedules);
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

export default router;