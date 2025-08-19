import express from 'express';
import { getSchedulesByProject, updateSchedule, initializeProjectSchedules, deleteProjectSchedules } from '../db/queries.js';

const router = express.Router();

router.get('/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    let schedules = await getSchedulesByProject(projectId);
    
    // スケジュールが0件、またはすべてのデータがnullの場合、初期データを再作成
    const hasValidData = schedules.some(s => s.start_date || s.duration || s.owner);
    
    if (schedules.length === 0 || !hasValidData) {
      console.log(`No valid schedules found for project ${projectId}, reinitializing...`);
      try {
        // 既存のデータを削除してから再作成
        if (schedules.length > 0) {
          await deleteProjectSchedules(projectId);
        }
        await initializeProjectSchedules(projectId);
        schedules = await getSchedulesByProject(projectId);
      } catch (initError) {
        console.warn('Failed to initialize schedules, returning existing data:', initError);
        // 初期化に失敗しても既存データを返す
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