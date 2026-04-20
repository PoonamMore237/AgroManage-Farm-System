const router = require('express').Router();
const auth   = require('../middleware/auth');
const { getDB } = require('../db/database');

const log = (db, action, desc) => db.prepare(`INSERT INTO activity_log (module,action,description) VALUES ('Labour',?,?)`).run(action, desc);

router.get('/workers', auth, (req, res) => {
  try { res.json({ success: true, data: getDB().prepare('SELECT * FROM workers ORDER BY name ASC').all() }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/workers', auth, (req, res) => {
  const { name, contact, worker_type, specialization, daily_wage, join_date } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Name required.' });
  try {
    const db = getDB();
    const info = db.prepare(`INSERT INTO workers (name,contact,worker_type,specialization,daily_wage,join_date) VALUES (?,?,?,?,?,?)`)
      .run(name, contact||'', worker_type||'Temporary', specialization||'', daily_wage||0, join_date||new Date().toISOString().split('T')[0]);
    log(db, 'Worker Added', `${name} (${worker_type||'Temporary'}) added`);
    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/workers/:id', auth, (req, res) => {
  const { name, contact, worker_type, specialization, daily_wage, status } = req.body;
  try {
    getDB().prepare(`UPDATE workers SET name=COALESCE(?,name),contact=COALESCE(?,contact),worker_type=COALESCE(?,worker_type),specialization=COALESCE(?,specialization),daily_wage=COALESCE(?,daily_wage),status=COALESCE(?,status) WHERE id=?`)
      .run(name, contact, worker_type, specialization, daily_wage, status, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/workers/:id', auth, (req, res) => {
  try { getDB().prepare('DELETE FROM workers WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ATTENDANCE
router.get('/attendance', auth, (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  try {
    // Get all active workers + their attendance for the day
    const rows = getDB().prepare(`
      SELECT w.id, w.name, w.worker_type, w.specialization, w.daily_wage,
        COALESCE(a.status,'Not Marked') AS status, a.task, a.location, COALESCE(a.hours,8) AS hours, a.id AS att_id
      FROM workers w
      LEFT JOIN attendance a ON w.id=a.worker_id AND a.date=?
      WHERE w.status='Active' ORDER BY w.name ASC
    `).all(date);
    res.json({ success: true, data: rows, date });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/attendance', auth, (req, res) => {
  const { date, records } = req.body;
  if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'records[] required.' });
  const d = date || new Date().toISOString().split('T')[0];
  try {
    const db = getDB();
    const upsert = db.prepare(`INSERT INTO attendance (worker_id,date,status,task,location,hours,overtime) VALUES (?,?,?,?,?,?,?) ON CONFLICT(worker_id,date) DO UPDATE SET status=excluded.status,task=excluded.task,location=excluded.location,hours=excluded.hours,overtime=excluded.overtime`);
    db.transaction(recs => recs.forEach(r => upsert.run(r.worker_id, d, r.status||'Present', r.task||'', r.location||'', r.hours||8, r.overtime||0)))(records);
    const present = records.filter(r => (r.status||'Present')==='Present').length;
    log(db, 'Attendance Marked', `${present} workers present for ${d}`);
    res.json({ success: true, message: `Saved for ${records.length} workers.` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/attendance/summary', auth, (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0,7);
  try {
    const db = getDB();
    const rows = db.prepare(`
      SELECT w.id, w.name, w.daily_wage, w.worker_type,
        COUNT(CASE WHEN a.status='Full Day' OR a.status='Present' THEN 1 END) AS full_days,
        COUNT(CASE WHEN a.status='Half Day' THEN 1 END) AS half_days,
        COALESCE(SUM(CASE 
          WHEN a.status='Full Day' OR a.status='Present' THEN w.daily_wage 
          WHEN a.status='Half Day' THEN w.daily_wage / 2 
          ELSE 0 
        END), 0) AS gross_wages,
        COALESCE((SELECT SUM(advance_payment) FROM salary_advances WHERE worker_id=w.id AND strftime('%Y-%m', date)=?), 0) AS total_advances
      FROM workers w
      LEFT JOIN attendance a ON w.id=a.worker_id AND strftime('%Y-%m',a.date)=?
      WHERE w.status='Active' GROUP BY w.id ORDER BY w.name ASC
    `).all(month, month);
    
    // Add net_wages calculation
    const data = rows.map(r => ({
      ...r,
      wages_payable: Math.max(0, r.gross_wages - r.total_advances)
    }));

    res.json({ success: true, data, month });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ADVANCES
router.get('/advances', auth, (req, res) => {
  try { res.json({ success: true, data: getDB().prepare('SELECT sa.*, w.name AS worker_name FROM salary_advances sa LEFT JOIN workers w ON sa.worker_id=w.id ORDER BY sa.date DESC').all() }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/advances', auth, (req, res) => {
  const { date, team_name, work_description, plot_name, gut_no, advance_payment, worker_id } = req.body;
  if (!advance_payment) return res.status(400).json({ success: false, message: 'advance_payment required.' });
  try {
    const db = getDB();
    const info = db.prepare(`INSERT INTO salary_advances (date,team_name,work_description,plot_name,gut_no,advance_payment,worker_id) VALUES (?,?,?,?,?,?,?)`)
      .run(date||new Date().toISOString().split('T')[0], team_name||'', work_description||'', plot_name||'', gut_no||'', advance_payment, worker_id||null);
    db.prepare(`INSERT INTO transactions (type,category,amount,description,date,reference_id) VALUES ('expense','Labour Advance',?,?,?,?)`)
      .run(advance_payment, `Advance: ${team_name || 'Worker'} - ${work_description}`, date||new Date().toISOString().split('T')[0], info.lastInsertRowid);    
    log(db, 'Advance Paid', `₹${advance_payment} paid to ${team_name || 'worker'}`);
    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/attendance/summary/advance', auth, (req, res) => {
  const { worker_id, month, amount } = req.body;
  if (!worker_id || !month) return res.status(400).json({ success: false, message: 'worker_id and month required.' });
  try {
    const db = getDB();
    const date = `${month}-01`; 
    const desc = `Monthly Advance Adjustment`;
    const existing = db.prepare(`SELECT id FROM salary_advances WHERE worker_id=? AND strftime('%Y-%m', date)=? AND work_description=?`).get(worker_id, month, desc);
    if (existing) {
      db.prepare(`UPDATE salary_advances SET advance_payment=? WHERE id=?`).run(amount, existing.id);
      db.prepare(`UPDATE transactions SET amount=? WHERE category='Labour Advance' AND reference_id=?`).run(amount, existing.id);
    } else {
      const info = db.prepare(`INSERT INTO salary_advances (date, team_name, work_description, advance_payment, worker_id) SELECT ?, name, ?, ?, id FROM workers WHERE id=?`)
        .run(date, desc, amount, worker_id);
      db.prepare(`INSERT INTO transactions (type, category, amount, description, date, reference_id) VALUES ('expense', 'Labour Advance', ?, ?, ?, ?)`)
        .run(amount, `Advance: Worker #${worker_id} - Monthly Adj`, date, info.lastInsertRowid);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
