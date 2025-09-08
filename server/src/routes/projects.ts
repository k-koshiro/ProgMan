import express from 'express';
import { getAllProjects, createProject, deleteProject, updateProjectName, updateProjectBaseDate } from '../db/queries.js';

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
