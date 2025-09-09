import express from 'express';
import { getAllProjects, createProject, deleteProject, updateProjectName, updateProjectBaseDate, getTopScheduleStartDate, shiftProjectDates } from '../db/queries.js';
import { differenceInCalendarDays, parseISO } from 'date-fns';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const projects = await getAllProjects();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, base_date } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    const projectId = await createProject(name, base_date);
    
    const project = { 
      id: projectId, 
      name,
      base_date,
      created_at: new Date().toISOString()
    };
    
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const { name, base_date } = req.body;
    
    if (name !== undefined) {
      await updateProjectName(projectId, name);
    }
    
    if (base_date !== undefined) {
      // 連動: 先頭タスクの開始日との差分で全体をシフト
      try {
        const topStart = await getTopScheduleStartDate(projectId);
        if (topStart) {
          const delta = differenceInCalendarDays(parseISO(base_date), parseISO(topStart));
          if (delta !== 0) {
            await shiftProjectDates(projectId, delta /* , { shiftActual: false } */);
          }
        }
      } catch (e) {
        console.warn('Failed to shift schedules with base_date change:', e);
      }
      await updateProjectBaseDate(projectId, base_date);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    await deleteProject(projectId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
