import express from 'express';
import { execSync } from 'child_process';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const timestamp = execSync('git log -1 --format=%cI', { encoding: 'utf-8' }).trim();
    
    res.json({
      commit,
      timestamp,
      buildTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching version info:', error);
    res.json({
      commit: 'unknown',
      timestamp: new Date().toISOString(),
      buildTime: new Date().toISOString()
    });
  }
});

export default router;