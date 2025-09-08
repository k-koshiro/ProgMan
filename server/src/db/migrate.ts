import { db } from './init.js';

export const addBaseDateColumn = () => {
  return new Promise<void>((resolve, reject) => {
    db.run(`
      ALTER TABLE projects 
      ADD COLUMN base_date DATE
    `, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log('base_date column already exists');
          resolve();
        } else {
          console.error('Error adding base_date column:', err);
          reject(err);
        }
      } else {
        console.log('base_date column added successfully');
        resolve();
      }
    });
  });
};