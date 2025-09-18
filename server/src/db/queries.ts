import { db } from './init.js';
import { Project, Schedule, CommentEntry, CommentPage, CategoryProgress, ProgressStatus } from '../types/index.js';
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

export const getTopScheduleStartDate = (projectId: number): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT start_date FROM schedules WHERE project_id = ? AND start_date IS NOT NULL ORDER BY sort_order LIMIT 1',
      [projectId],
      (err, row: { start_date?: string } | undefined) => {
        if (err) reject(err);
        else resolve(row?.start_date || null);
      }
    );
  });
};

export const shiftProjectDates = (projectId: number, deltaDays: number, opts?: { shiftActual?: boolean }): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!deltaDays) return resolve();
    const offset = `${deltaDays} day`;
    db.serialize(() => {
      db.run('BEGIN');
      db.run(
        'UPDATE schedules SET start_date = date(start_date, ?) WHERE project_id = ? AND start_date IS NOT NULL',
        [offset, projectId],
        (err) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }
          const finish = (e?: Error | null) => {
            if (e) {
              db.run('ROLLBACK');
              reject(e);
            } else {
              db.run('COMMIT', (cerr) => (cerr ? reject(cerr) : resolve()));
            }
          };
          if (opts?.shiftActual) {
            db.run(
              'UPDATE schedules SET actual_start = date(actual_start, ?) WHERE project_id = ? AND actual_start IS NOT NULL',
              [offset, projectId],
              finish
            );
          } else {
            finish();
          }
        }
      );
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
      
      const values = Object.keys(fieldsToUpdate as Partial<Schedule>)
        .filter(key => key !== 'id' && key !== 'project_id' && key !== 'category' && key !== 'item' && key !== 'sort_order')
        .map(key => (fieldsToUpdate as any)[key]);
      
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

// =====================
// Comment Pages & Entries
// =====================

export const getCommentPages = (projectId: number): Promise<CommentPage[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM comment_pages WHERE project_id = ? ORDER BY comment_date DESC',
      [projectId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows as CommentPage[]);
      }
    );
  });
};

export const getCommentPage = (projectId: number, commentDate: string): Promise<CommentPage | null> => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM comment_pages WHERE project_id = ? AND comment_date = ?',
      [projectId, commentDate],
      (err, row) => {
        if (err) reject(err);
        else resolve((row as CommentPage) || null);
      }
    );
  });
};

export const getLatestCommentPageDate = (projectId: number): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT comment_date FROM comment_pages WHERE project_id = ? ORDER BY comment_date DESC LIMIT 1',
      [projectId],
      (err, row) => {
        if (err) reject(err);
        else resolve((row as { comment_date: string } | undefined)?.comment_date ?? null);
      }
    );
  });
};

export const createCommentPage = (projectId: number, commentDate: string): Promise<CommentPage> => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO comment_pages (project_id, comment_date) VALUES (?, ?)',
      [projectId, commentDate],
      function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          id: this.lastID,
          project_id: projectId,
          comment_date: commentDate,
        });
      }
    );
  });
};

export const deleteCommentPage = (projectId: number, commentDate: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM comments WHERE project_id = ? AND comment_date = ?', [projectId, commentDate], (commentErr) => {
      if (commentErr) {
        reject(commentErr);
        return;
      }
      db.run('DELETE FROM comment_pages WHERE project_id = ? AND comment_date = ?', [projectId, commentDate], (pageErr) => {
        if (pageErr) reject(pageErr);
        else resolve();
      });
    });
  });
};

export const getCommentsByProjectAndDate = (projectId: number, commentDate: string): Promise<CommentEntry[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM comments WHERE project_id = ? AND comment_date = ? ORDER BY owner ASC',
      [projectId, commentDate],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows as CommentEntry[]);
      }
    );
  });
};

export const upsertComment = (entry: Omit<CommentEntry, 'id' | 'updated_at'>): Promise<void> => {
  return new Promise((resolve, reject) => {
    const { project_id, owner, comment_date, body } = entry;
    if (!project_id || !owner || !comment_date) {
      reject(new Error('project_id, owner, comment_date are required'));
      return;
    }
    db.run(
      'INSERT OR IGNORE INTO comment_pages (project_id, comment_date) VALUES (?, ?)',
      [project_id, comment_date],
      (pageErr) => {
        if (pageErr) {
          reject(pageErr);
          return;
        }
        const sql = `
          INSERT INTO comments (project_id, owner, comment_date, body)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(project_id, owner, comment_date)
          DO UPDATE SET body = excluded.body, updated_at = CURRENT_TIMESTAMP
        `;
        db.run(sql, [project_id, owner, comment_date, body ?? ''], (err) => {
          if (err) reject(err);
          else resolve();
        });
      }
    );
  });
};

// カテゴリ進捗状態の取得（プロジェクトと日付で取得）
export const getCategoryProgressByProjectAndDate = (
  projectId: number,
  progressDate: string
): Promise<CategoryProgress[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM category_progress WHERE project_id = ? AND progress_date = ?',
      [projectId, progressDate],
      (err, rows) => {
        if (err) reject(err);
        else resolve((rows as CategoryProgress[]) || []);
      }
    );
  });
};

// カテゴリ進捗状態の更新または挿入
export const upsertCategoryProgress = (progress: {
  project_id: number;
  category: string;
  progress_date: string;
  status: ProgressStatus;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO category_progress (project_id, category, progress_date, status)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(project_id, category, progress_date)
      DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP
    `;
    db.run(
      sql,
      [progress.project_id, progress.category, progress.progress_date, progress.status],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
};

// マイルストーン見込み日の取得（プロジェクトごと）
export const getMilestoneEstimatesByProject = (
  projectId: number
): Promise<Array<{ schedule_id: number; estimate_date: string | null }>> => {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT schedule_id, estimate_date FROM milestone_estimates WHERE project_id = ?',
      [projectId],
      (err, rows) => {
        if (err) reject(err);
        else resolve((rows as Array<{ schedule_id: number; estimate_date: string | null }>) || []);
      }
    );
  });
};

// マイルストーン見込み日の更新または挿入
export const upsertMilestoneEstimate = (estimate: {
  project_id: number;
  schedule_id: number;
  estimate_date: string | null;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!estimate.estimate_date) {
      // 見込み日が空の場合はレコードを削除
      db.run(
        'DELETE FROM milestone_estimates WHERE project_id = ? AND schedule_id = ?',
        [estimate.project_id, estimate.schedule_id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    } else {
      // 見込み日がある場合は挿入または更新
      const sql = `
        INSERT INTO milestone_estimates (project_id, schedule_id, estimate_date)
        VALUES (?, ?, ?)
        ON CONFLICT(project_id, schedule_id)
        DO UPDATE SET estimate_date = excluded.estimate_date, updated_at = CURRENT_TIMESTAMP
      `;
      db.run(
        sql,
        [estimate.project_id, estimate.schedule_id, estimate.estimate_date],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    }
  });
};
