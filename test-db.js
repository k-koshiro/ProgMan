const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'server/data/progman.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking database content...\n');

// プロジェクト一覧
db.all('SELECT * FROM projects', (err, projects) => {
  if (err) {
    console.error('Error fetching projects:', err);
    return;
  }
  
  console.log('Projects:');
  projects.forEach(p => {
    console.log(`  ${p.id}: ${p.name} (${p.created_at})`);
  });
  
  // 最新プロジェクトのスケジュール確認
  if (projects.length > 0) {
    const latestProject = projects[projects.length - 1];
    console.log(`\nSchedules for project ${latestProject.id} (${latestProject.name}):`);
    
    db.all(
      'SELECT id, category, item, owner, start_date, duration, end_date, progress FROM schedules WHERE project_id = ? LIMIT 10',
      [latestProject.id],
      (err, schedules) => {
        if (err) {
          console.error('Error fetching schedules:', err);
          return;
        }
        
        schedules.forEach(s => {
          console.log(`  [${s.id}] ${s.category} - ${s.item}`);
          console.log(`    Owner: ${s.owner || '(未設定)'}`);
          console.log(`    Start: ${s.start_date || '(未設定)'}, Duration: ${s.duration || '(未設定)'}, End: ${s.end_date || '(未設定)'}`);
          console.log(`    Progress: ${s.progress || 0}%`);
        });
        
        db.close();
      }
    );
  } else {
    db.close();
  }
});