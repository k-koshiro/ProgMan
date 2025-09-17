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
        // コメントページテーブル（プロジェクト×日付で一意）
        db.run(`
          CREATE TABLE IF NOT EXISTS comment_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            comment_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id, comment_date),
            FOREIGN KEY (project_id) REFERENCES projects(id)
          )
        `, (pErr) => {
          if (pErr) {
            console.error('Error creating comment_pages table:', pErr);
            reject(pErr);
            return;
          }
          // comments テーブル作成（担当×日付で一意）
          db.run(`
            CREATE TABLE IF NOT EXISTS comments (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              project_id INTEGER NOT NULL,
              owner TEXT NOT NULL,
              comment_date DATE NOT NULL,
              body TEXT NOT NULL,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(project_id, owner, comment_date),
              FOREIGN KEY (project_id) REFERENCES projects(id)
            )
          `, (cErr) => {
            if (cErr) {
              console.error('Error creating comments table:', cErr);
              reject(cErr);
              return;
            }
            // category_progress テーブル作成（カテゴリ×日付で進捗状態管理）
            db.run(`
              CREATE TABLE IF NOT EXISTS category_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                category TEXT NOT NULL,
                progress_date DATE NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('smooth', 'caution', 'danger', 'idle')),
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, category, progress_date),
                FOREIGN KEY (project_id) REFERENCES projects(id)
              )
            `, (cpErr) => {
              if (cpErr) {
                console.error('Error creating category_progress table:', cpErr);
                reject(cpErr);
                return;
              }
              // 既存コメントからページ情報を補完
              db.run(
                `INSERT OR IGNORE INTO comment_pages (project_id, comment_date)
                 SELECT project_id, comment_date FROM comments GROUP BY project_id, comment_date`,
                (seedErr) => {
                  if (seedErr) {
                    console.error('Error seeding comment_pages:', seedErr);
                    reject(seedErr);
                    return;
                  }
                  resolve();
                }
              );
            });
          });
        });
      });
    });
  });
};
