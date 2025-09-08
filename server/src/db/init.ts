import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url || '');
const __dirname = dirname(__filename);

const dbPath = path.join(__dirname, '../../data/progman.db');

export const db = new sqlite3.Database(dbPath);

export const initDatabase = () => {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          base_date DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating projects table:', err);
          reject(err);
          return;
        }
      });

      db.run(`
        CREATE TABLE IF NOT EXISTS schedules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          category TEXT NOT NULL,
          item TEXT NOT NULL,
          owner TEXT,
          start_date DATE,
          duration INTEGER,
          end_date DATE,
          progress REAL DEFAULT 0,
          actual_start DATE,
          actual_duration INTEGER,
          actual_end DATE,
          sort_order INTEGER NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating schedules table:', err);
          reject(err);
          return;
        }
        console.log('Database initialized successfully');
        resolve();
      });
    });
  });
};