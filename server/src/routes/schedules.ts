import express from 'express';
import { getSchedulesByProject, updateSchedule } from '../db/queries.js';

const router = express.Router();

router.get('/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const schedules = await getSchedulesByProject(projectId);
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