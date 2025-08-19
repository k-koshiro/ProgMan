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

export const updateProjectName = (projectId: number, name: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE projects SET name = ? WHERE id = ?', [name, projectId], function(err) {
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

export const initializeProjectSchedules = (projectId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    let sortOrder = 0;
    const insertPromises: Promise<void>[] = [];
    
    // 各カテゴリーとアイテムを個別にINSERTする
    initialCategories.forEach(categoryData => {
      categoryData.items.forEach(item => {
        const promise = new Promise<void>((res, rej) => {
          db.run(
            `INSERT INTO schedules (project_id, category, item, sort_order) VALUES (?, ?, ?, ?)`,
            [projectId, categoryData.category, item, sortOrder++],
            function(err) {
              if (err) {
                console.error('Error inserting schedule item:', err);
                rej(err);
              } else {
                res();
              }
            }
          );
        });
        insertPromises.push(promise);
      });
    });
    
    // すべてのINSERTが完了するまで待つ
    Promise.all(insertPromises)
      .then(() => resolve())
      .catch(err => {
        console.error('Error initializing schedules:', err);
        reject(err);
      });
  });
};