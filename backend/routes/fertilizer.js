const router = require('express').Router();
const auth   = require('../middleware/auth');
const { getDB } = require('../db/database');

const log = (db, action, desc) => db.prepare(`INSERT INTO activity_log (module,action,description) VALUES ('Fertilizer',?,?)`).run(action, desc);

// STOCK
router.get('/stock', auth, (req, res) => {
  try { res.json({ success: true, data: getDB().prepare('SELECT * FROM fertilizer_stock ORDER BY created_at DESC').all() }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/stock', auth, (req, res) => {
  const { name, type, quantity, unit, price_per_unit, purchase_date, low_stock_alert, payment_receipt } = req.body;
  if (!name || !type || quantity == null) return res.status(400).json({ success: false, message: 'name, type, quantity required.' });
  try {
    const db = getDB();
    const info = db.prepare(`INSERT INTO fertilizer_stock (name,type,quantity,unit,price_per_unit,purchase_date,low_stock_alert,payment_receipt) VALUES (?,?,?,?,?,?,?,?)`)
      .run(name, type, quantity, unit||'kg', price_per_unit||0, purchase_date||null, low_stock_alert||50, payment_receipt||null);
    if (price_per_unit && quantity)
      db.prepare(`INSERT INTO transactions (type,category,amount,description,date) VALUES ('expense','Fertilizer',?,?,?)`)
        .run(price_per_unit * quantity, `Purchased ${name}`, purchase_date || new Date().toISOString().split('T')[0]);
    log(db, 'Stock Added', `${name} - ${quantity}${unit||'kg'} added`);
    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/stock/:id', auth, (req, res) => {
  const { name, type, quantity, unit, price_per_unit, purchase_date, low_stock_alert } = req.body;
  try {
    getDB().prepare(`UPDATE fertilizer_stock SET name=COALESCE(?,name),type=COALESCE(?,type),quantity=COALESCE(?,quantity),unit=COALESCE(?,unit),price_per_unit=COALESCE(?,price_per_unit),purchase_date=COALESCE(?,purchase_date),low_stock_alert=COALESCE(?,low_stock_alert),updated_at=datetime('now') WHERE id=?`)
      .run(name,type,quantity,unit,price_per_unit,purchase_date,low_stock_alert,req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/stock/:id', auth, (req, res) => {
  try { getDB().prepare('DELETE FROM fertilizer_stock WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// SPRAY
router.get('/spray', auth, (req, res) => {
  try {
    res.json({ success: true, data: getDB().prepare(`SELECT fu.*,fs.name AS fertilizer_name,fs.unit FROM fertilizer_usage fu LEFT JOIN fertilizer_stock fs ON fu.stock_id=fs.id ORDER BY fu.applied_date DESC`).all() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/spray', auth, (req, res) => {
  const { stock_id, plot, quantity_used, method, applied_by, applied_date, notes, water_quantity, chatni_natar_cha_day, reason, weather } = req.body;
  if (!stock_id || !plot || !quantity_used) return res.status(400).json({ success: false, message: 'stock_id, plot, quantity_used required.' });
  try {
    const db = getDB();
    const stock = db.prepare('SELECT * FROM fertilizer_stock WHERE id=?').get(stock_id);
    if (!stock) return res.status(404).json({ success: false, message: 'Stock not found.' });
    if (stock.quantity < quantity_used) return res.status(400).json({ success: false, message: 'Insufficient stock.' });
    db.prepare(`UPDATE fertilizer_stock SET quantity=quantity-?,updated_at=datetime('now') WHERE id=?`).run(quantity_used, stock_id);
    const info = db.prepare(`INSERT INTO fertilizer_usage (stock_id,plot,quantity_used,method,applied_by,applied_date,notes,water_quantity,chatni_natar_cha_day,reason,weather) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(stock_id, plot, quantity_used, method||'Spray', applied_by||'', applied_date||new Date().toISOString().split('T')[0], notes||'', water_quantity||null, chatni_natar_cha_day||null, reason||'', weather||'');
    log(db, 'Spray Applied', `${stock.name} ${quantity_used}${stock.unit} applied to ${plot}`);
    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DRIP
router.get('/drip', auth, (req, res) => {
  try {
    res.json({ success: true, data: getDB().prepare(`SELECT ds.*,fs.name AS fertilizer_name FROM drip_schedule ds LEFT JOIN fertilizer_stock fs ON ds.fertilizer_id=fs.id ORDER BY ds.created_at DESC`).all() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/drip', auth, (req, res) => {
  const { plot, fertilizer_id, schedule_time, duration_min, frequency, notes, water_quantity } = req.body;
  if (!plot || !schedule_time) return res.status(400).json({ success: false, message: 'plot and schedule_time required.' });
  try {
    const info = getDB().prepare(`INSERT INTO drip_schedule (plot,fertilizer_id,schedule_time,duration_min,frequency,notes,water_quantity) VALUES (?,?,?,?,?,?,?)`)
      .run(plot, fertilizer_id||null, schedule_time, duration_min||30, frequency||'Daily', notes||'', water_quantity||null);
    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/drip/:id', auth, (req, res) => {
  const { status, schedule_time, duration_min, frequency } = req.body;
  try {
    getDB().prepare(`UPDATE drip_schedule SET status=COALESCE(?,status),schedule_time=COALESCE(?,schedule_time),duration_min=COALESCE(?,duration_min),frequency=COALESCE(?,frequency) WHERE id=?`)
      .run(status, schedule_time, duration_min, frequency, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
