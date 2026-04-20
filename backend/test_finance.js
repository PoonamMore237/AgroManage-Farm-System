const Database = require('better-sqlite3');
const db = new Database('./farmsync.db');
const year = '2026';
try {
    const rows = db.prepare(`
      SELECT strftime('%m',date) AS month_num,
        CASE strftime('%m',date)
          WHEN '01' THEN 'Jan' WHEN '02' THEN 'Feb' WHEN '03' THEN 'Mar' WHEN '04' THEN 'Apr'
          WHEN '05' THEN 'May' WHEN '06' THEN 'Jun' WHEN '07' THEN 'Jul' WHEN '08' THEN 'Aug'
          WHEN '09' THEN 'Sep' WHEN '10' THEN 'Oct' WHEN '11' THEN 'Nov' WHEN '12' THEN 'Dec'
        END || ' ' || strftime('%Y',date) AS month_label,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END),0) AS revenue,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expenses
      FROM transactions WHERE strftime('%Y',date)=? GROUP BY month_num ORDER BY month_num ASC
    `).all(year);
    console.log(JSON.stringify(rows, null, 2));
} catch (e) {
    console.error(e);
}
