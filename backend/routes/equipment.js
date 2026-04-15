const router = require('express').Router();
const auth   = require('../middleware/auth');
const { getDB } = require('../db/database');

const log = (db, action, desc) => db.prepare(`INSERT INTO activity_log (module,action,description) VALUES ('Equipment',?,?)`).run(action, desc);

router.get('/', auth, (req, res) => {
  try { res.json({ success: true, data: getDB().prepare('SELECT * FROM equipment ORDER BY name ASC').all() }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, (req, res) => {
  const { name, code, type, status, condition_status, purchase_date, last_service_date, next_service_date, notes } = req.body;
  if (!name || !type) return res.status(400).json({ success: false, message: 'name and type required.' });
  try {
    const db = getDB();
    const info = db.prepare(`INSERT INTO equipment (name,code,type,status,condition_status,purchase_date,last_service_date,next_service_date,notes) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(name, code||null, type, status||'Available', condition_status||'Good', purchase_date||null, last_service_date||null, next_service_date||null, notes||'');
    log(db, 'Equipment Added', `${name} added to inventory`);
    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', auth, (req, res) => {
  const { name, code, type, status, condition_status, last_service_date, next_service_date, notes } = req.body;
  try {
    getDB().prepare(`UPDATE equipment SET name=COALESCE(?,name),code=COALESCE(?,code),type=COALESCE(?,type),status=COALESCE(?,status),condition_status=COALESCE(?,condition_status),last_service_date=COALESCE(?,last_service_date),next_service_date=COALESCE(?,next_service_date),notes=COALESCE(?,notes),updated_at=datetime('now') WHERE id=?`)
      .run(name,code,type,status,condition_status,last_service_date,next_service_date,notes,req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', auth, (req, res) => {
  try { getDB().prepare('DELETE FROM equipment WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/:id/issue', auth, (req, res) => {
  const { assigned_to, issued_by, plot, task, issued_date, condition_before } = req.body;
  try {
    const db = getDB();
    const eq = db.prepare('SELECT * FROM equipment WHERE id=?').get(req.params.id);
    if (!eq) return res.status(404).json({ success: false, message: 'Not found.' });
    if (eq.status !== 'Available') return res.status(400).json({ success: false, message: `Equipment is ${eq.status}.` });
    db.prepare(`UPDATE equipment SET status='In Use',updated_at=datetime('now') WHERE id=?`).run(req.params.id);
    const info = db.prepare(`INSERT INTO equipment_usage (equipment_id,assigned_to,issued_by,plot,task,issued_date,condition_before) VALUES (?,?,?,?,?,?,?)`)
      .run(req.params.id, assigned_to||'', issued_by||'', plot||'', task||'', issued_date||new Date().toISOString().split('T')[0], condition_before||'');
    log(db, 'Equipment Issued', `${eq.name} issued to ${assigned_to||'unknown'}`);
    res.json({ success: true, usage_id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/:id/return', auth, (req, res) => {
  const { return_date, condition_status, condition_after } = req.body;
  try {
    const db = getDB();
    const eq = db.prepare('SELECT name FROM equipment WHERE id=?').get(req.params.id);
    db.prepare(`UPDATE equipment SET status='Available',condition_status=COALESCE(?,condition_status),updated_at=datetime('now') WHERE id=?`).run(condition_status, req.params.id);
    db.prepare(`UPDATE equipment_usage SET return_date=?,status='Returned',condition_after=? WHERE equipment_id=? AND status='In Use'`).run(return_date||new Date().toISOString().split('T')[0], condition_after||condition_status||'', req.params.id);
    log(db, 'Equipment Returned', `${eq?.name} returned`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/:id/maintenance', auth, (req, res) => {
  const { type, description, cost, date, done_by } = req.body;
  try {
    const db = getDB();
    const eq = db.prepare('SELECT name FROM equipment WHERE id=?').get(req.params.id);
    db.prepare(`UPDATE equipment SET status='Under Maintenance',updated_at=datetime('now') WHERE id=?`).run(req.params.id);
    const info = db.prepare(`INSERT INTO maintenance_log (equipment_id,type,description,cost,date,done_by) VALUES (?,?,?,?,?,?)`)
      .run(req.params.id, type||'Service', description||'', cost||0, date||new Date().toISOString().split('T')[0], done_by||'');
    if (cost > 0)
      db.prepare(`INSERT INTO transactions (type,category,amount,description,date) VALUES ('expense','Maintenance',?,?,?)`).run(cost, `Maintenance: ${eq?.name}`, date||new Date().toISOString().split('T')[0]);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
