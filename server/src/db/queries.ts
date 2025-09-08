import { db } from './init.js';
import { Project, Schedule } from '../types/index.js';
import { format, addDays, differenceInDays } from 'date-fns';
import { initialCategories } from '../data/initialData.js';
import { scheduleTemplates } from '../data/scheduleTemplate.js';

export const getAllProjects = (): Promise<Project[]> => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM projects ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows as Project[]);
    });
  });
};

export const getProjectById = (projectId: number): Promise<Project | null> => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, row) => {
      if (err) reject(err);
      else resolve(row as Project || null);
    });
  });
};

export const createProject = (name: string, baseDate?: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO projects (name, base_date) VALUES (?, ?)', [name, baseDate || null], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

export const updateProjectName = (projectId: number, name: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE projects SET name = ? WHERE id = ?', [name, projectId], function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const updateProjectBaseDate = (projectId: number, baseDate: string | null): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE projects SET base_date = ? WHERE id = ?', [baseDate, projectId], function(err) {
      if (err) reject(err);
      else resolve();
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

export const deleteProjectSchedules = (projectId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM schedules WHERE project_id = ?', [projectId], function(err) {
      if (err) {
        console.error('Error deleting schedules:', err);
        reject(err);
      } else {
        console.log(`Deleted ${this.changes} schedules for project ${projectId}`);
        resolve();
      }
    });
  });
};

export interface ExcelScheduleRow {
  category?: string | null;
  item: string;
  owner?: string | null;
  start_date?: string | null; // yyyy-MM-dd
  duration?: number | null;   // days
  progress?: number | null;   // 0-100
}

export const replaceSchedulesFromExcel = (projectId: number, rows: ExcelScheduleRow[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN');
      db.run('DELETE FROM schedules WHERE project_id = ?', [projectId], (delErr) => {
        if (delErr) {
          db.run('ROLLBACK');
          return reject(delErr);
        }
        let sortOrder = 0;
        const stmt = db.prepare(`
          INSERT INTO schedules (
            project_id, category, item, owner, start_date, duration, end_date, progress, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const r of rows) {
          const category = (r.category && String(r.category).trim()) || '未分類';
          const item = String(r.item || '').trim();
          if (!item) continue;
          const owner = r.owner ? String(r.owner).trim() : null;
          const start = r.start_date || null;
          const dur = r.duration != null && !Number.isNaN(r.duration) ? Math.max(0, Math.trunc(r.duration)) : null;
          const progress = r.progress != null && !Number.isNaN(r.progress) ? Math.min(100, Math.max(0, Number(r.progress))) : 0;
          stmt.run(
            [projectId, category, item, owner, start, dur, null, progress, sortOrder++],
            (insErr) => {
              if (insErr) {
                console.error('Insert error:', insErr, r);
              }
            }
          );
        }
        stmt.finalize((finErr) => {
          if (finErr) {
            db.run('ROLLBACK');
            return reject(finErr);
          }
          db.run('COMMIT', (cErr) => {
            if (cErr) return reject(cErr);
            resolve();
          });
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
      
      // 更新するフィールドを決定
      const updatedSchedule = { ...currentSchedule, ...schedule };
      
      // end_dateとactual_endは自動計算するので除外
      const { end_date, actual_end, ...fieldsToUpdate } = updatedSchedule;
      
      // 日数が0の場合はnullとして扱う
      if (fieldsToUpdate.duration === 0) {
        fieldsToUpdate.duration = null;
      }
      if (fieldsToUpdate.actual_duration === 0) {
        fieldsToUpdate.actual_duration = null;
      }
      
      // 更新クエリの生成
      const updateFields = Object.keys(fieldsToUpdate)
        .filter(key => key !== 'id' && key !== 'project_id' && key !== 'category' && key !== 'item' && key !== 'sort_order')
        .map(key => `${key} = ?`);
      
      if (updateFields.length === 0) {
        resolve();
        return;
      }
      
      // updated_atを追加
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      
      const values = Object.keys(fieldsToUpdate)
        .filter(key => key !== 'id' && key !== 'project_id' && key !== 'category' && key !== 'item' && key !== 'sort_order')
        .map(key => fieldsToUpdate[key as keyof Schedule]);
      
      values.push(id);
      
      const query = `UPDATE schedules SET ${updateFields.join(', ')} WHERE id = ?`;
      
      console.log('Update query:', query);
      console.log('Update values:', values);
      
      db.run(query, values, function(err) {
        if (err) {
          console.error('Error updating schedule:', err);
          reject(err);
        } else {
          console.log(`Schedule ${id} updated successfully`);
          resolve();
        }
      });
    });
  });
};

export const initializeProjectSchedules = async (projectId: number): Promise<void> => {
  try {
    // Get project to check for base_date
    const project = await getProjectById(projectId);
    const baseDate = project?.base_date ? new Date(project.base_date) : new Date();
    const currentYear = baseDate.getFullYear();
    
    let sortOrder = 0;
    const insertPromises: Promise<void>[] = [];
    
    // テンプレートデータを使用してスケジュールを作成
    scheduleTemplates.forEach(template => {
      const promise = new Promise<void>((resolve, reject) => {
        let startDate = null;
        let endDate = null;
        
        if (template.startDate) {
          // Parse MM/DD format and apply to base year
          const [month, day] = template.startDate.split('/').map(Number);
          if (!isNaN(month) && !isNaN(day)) {
            startDate = new Date(currentYear, month - 1, day);
            
            // If startDate is before baseDate, move to next year
            if (startDate < baseDate) {
              startDate = new Date(currentYear + 1, month - 1, day);
            }
            
            // Calculate end date
            if (template.duration > 0) {
              endDate = addDays(startDate, template.duration - 1);
            }
          }
        }
        
        db.run(
          `INSERT INTO schedules (
            project_id, category, item, sort_order, 
            start_date, duration, end_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId, 
            template.category, 
            template.item, 
            sortOrder++,
            startDate ? format(startDate, 'yyyy-MM-dd') : null,
            template.duration || null,
            endDate ? format(endDate, 'yyyy-MM-dd') : null
          ],
          function(err) {
            if (err) {
              console.error('Error inserting schedule item:', err);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
      insertPromises.push(promise);
    });
    
    await Promise.all(insertPromises);
  } catch (error) {
    console.error('Error initializing project schedules:', error);
    throw error;
  }
};
