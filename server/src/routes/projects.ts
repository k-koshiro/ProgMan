import express from 'express';
import { getAllProjects, createProject, deleteProject, initializeProjectSchedules } from '../db/queries.js';

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
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    const projectId = await createProject(name);
    await initializeProjectSchedules(projectId);
    
    const project = { 
      id: projectId, 
      name,
      created_at: new Date().toISOString()
    };
    
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
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