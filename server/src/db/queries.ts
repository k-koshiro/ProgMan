import { db } from './init.js';
import { Project, Schedule } from '../types/index.js';
import { format, addDays, differenceInDays } from 'date-fns';
import { initialCategories } from '../data/initialData.js';

export const getAllProjects = (): Promise<Project[]> => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM projects ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows as Project[]);
    });
  });
};

export const createProject = (name: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO projects (name) VALUES (?)', [name], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

export const deleteProject = (projectId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // First delete all schedules for this project
      db.run('DELETE FROM schedules WHERE project_id = ?', [projectId], (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Then delete the project itself
        db.run('DELETE FROM projects WHERE id = ?', [projectId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });
};

export const getSchedulesByProject = (projectId: number): Promise<Schedule[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM schedules WHERE project_id = ? ORDER BY sort_order',
      [projectId],
      (err, rows) => {
        if (err) reject(err);
        else {
          const schedules = (rows as Schedule[]).map(schedule => {
            if (schedule.start_date && schedule.duration) {
              const startDate = new Date(schedule.start_date);
              const endDate = addDays(startDate, schedule.duration);
              schedule.end_date = format(endDate, 'yyyy-MM-dd');
            }
            if (schedule.actual_start && schedule.actual_duration) {
              const actualStartDate = new Date(schedule.actual_start);
              const actualEndDate = addDays(actualStartDate, schedule.actual_duration);
              schedule.actual_end = format(actualEndDate, 'yyyy-MM-dd');
            }
            return schedule;
          });
          resolve(schedules);
        }
      }
    );
  });
};

export const updateSchedule = (schedule: Partial<Schedule>): Promise<void> => {
  return new Promise((resolve, reject) => {
    const { id } = schedule;
    
    if (!id) {
      reject(new Error('Schedule ID is required'));
      return;
    }
    
    // まず現在の値を取得
    db.get('SELECT * FROM schedules WHERE id = ?', [id], (err, currentSchedule: Schedule) => {
      if (err) {
        console.error('Error fetching current schedule:', err);
        reject(err);
        return;
      }
      
      if (!currentSchedule) {
        reject(new Error('Schedule not found'));
        return;
      }
      
      // 既存の値と新しい値をマージ
      const updatedSchedule = {
        ...currentSchedule,
        ...schedule,
        id // IDは変更しない
      };
      
      const { owner, start_date, duration, actual_start, actual_duration, progress } = updatedSchedule;
      
      console.log('Updating schedule with merged data:', { id, owner, start_date, duration, actual_start, actual_duration, progress });
      
      let end_date = null;
      let actual_end = null;
      
      if (start_date && duration) {
        const startDate = new Date(start_date);
        const endDate = addDays(startDate, duration - 1); // 開始日を含むため-1
        end_date = format(endDate, 'yyyy-MM-dd');
      }
      
      if (actual_start && actual_duration) {
        const actualStartDate = new Date(actual_start);
        const actualEndDate = addDays(actualStartDate, actual_duration - 1);
        actual_end = format(actualEndDate, 'yyyy-MM-dd');
      }
      
      db.run(
        `UPDATE schedules 
         SET owner = ?, start_date = ?, duration = ?, end_date = ?, progress = ?,
             actual_start = ?, actual_duration = ?, actual_end = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [owner, start_date, duration, end_date, progress, actual_start, actual_duration, actual_end, id],
        function(err) {
          if (err) {
            console.error('Error updating schedule:', err);
            reject(err);
          } else {
            console.log('Schedule updated successfully, rows affected:', this.changes);
            resolve();
          }
        }
      );
    });
  });
};

export const initializeProjectSchedules = (projectId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    let sortOrder = 0;
    const stmt = db.prepare(
      `INSERT INTO schedules (project_id, category, item, sort_order) VALUES (?, ?, ?, ?)`
    );
    
    initialCategories.forEach(categoryData => {
      categoryData.items.forEach(item => {
        stmt.run(projectId, categoryData.category, item, sortOrder++);
      });
    });
    
    stmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};