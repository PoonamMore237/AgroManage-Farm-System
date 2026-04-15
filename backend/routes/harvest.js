const router = require('express').Router();
const auth   = require('../middleware/auth');
const { getDB } = require('../db/database');

const log = (db, action, desc) => db.prepare(`INSERT INTO activity_log (module,action,description) VALUES ('Harvesting',?,?)`).run(action, desc);

router.get('/', auth, (req, res) => {
  const { plot, from, to } = req.query;
  let sql = 'SELECT * FROM harvest_records WHERE 1=1'; const p = [];
  if (plot) { sql += ' AND plot=?'; p.push(plot); }
  if (from) { sql += ' AND harvest_date>=?'; p.push(from); }
  if (to)   { sql += ' AND harvest_date<=?'; p.push(to); }
  sql += ' ORDER BY harvest_date DESC';
  try { res.json({ success: true, data: getDB().prepare(sql).all(...p) }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/summary', auth, (req, res) => {
  try {
    const db = getDB();
    const byPlot = db.prepare(`SELECT plot, COUNT(*) AS batches, SUM(quantity_kg) AS total_kg, SUM(total_revenue) AS total_revenue, AVG(selling_rate) AS avg_rate FROM harvest_records GROUP BY plot ORDER BY total_revenue DESC`).all();
    const grand  = db.prepare(`SELECT SUM(quantity_kg) AS total_kg, SUM(total_revenue) AS total_revenue FROM harvest_records`).get();
    res.json({ success: true, data: { by_plot: byPlot, grand_total: grand } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, (req, res) => {
  const { plot, crop_variety, sample_date, quantity_kg, harvest_date, merchant_name, selling_rate, expenses_food, quality_grade, notes } = req.body;
  if (!plot || !crop_variety || !quantity_kg || !selling_rate) return res.status(400).json({ success: false, message: 'plot, crop_variety, quantity_kg, selling_rate required.' });
  try {
    const db  = getDB();
    const rev = quantity_kg * selling_rate;
    const d   = harvest_date || new Date().toISOString().split('T')[0];
    const info = db.prepare(`INSERT INTO harvest_records (plot,crop_variety,sample_date,quantity_kg,harvest_date,merchant_name,selling_rate,total_revenue,expenses_food,quality_grade,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(plot, crop_variety, sample_date||null, quantity_kg, d, merchant_name||'', selling_rate, rev, expenses_food||0, quality_grade||'A', notes||'');
    db.prepare(`INSERT INTO transactions (type,category,amount,description,date,reference_id,plot) VALUES ('income','Harvest',?,?,?,?,?)`)
      .run(rev, `Harvest: ${crop_variety} from ${plot}`, d, info.lastInsertRowid, plot);
    if (expenses_food > 0) {
      db.prepare(`INSERT INTO transactions (type,category,amount,description,date,reference_id,plot) VALUES ('expense','Harvest Food',?,?,?,?,?)`)
        .run(expenses_food, `Food expenses for harvest at ${plot}`, d, info.lastInsertRowid, plot);
    }
    log(db, 'Harvest Recorded', `${quantity_kg}kg ${crop_variety} from ${plot} — ₹${rev.toLocaleString('en-IN')}`);
    res.status(201).json({ success: true, id: info.lastInsertRowid, revenue: rev });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', auth, (req, res) => {
  const { plot, crop_variety, quantity_kg, harvest_date, merchant_name, selling_rate, quality_grade, notes } = req.body;
  try {
    getDB().prepare(`UPDATE harvest_records SET plot=COALESCE(?,plot),crop_variety=COALESCE(?,crop_variety),quantity_kg=COALESCE(?,quantity_kg),harvest_date=COALESCE(?,harvest_date),merchant_name=COALESCE(?,merchant_name),selling_rate=COALESCE(?,selling_rate),quality_grade=COALESCE(?,quality_grade),notes=COALESCE(?,notes) WHERE id=?`)
      .run(plot,crop_variety,quantity_kg,harvest_date,merchant_name,selling_rate,quality_grade,notes,req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', auth, (req, res) => {
  try { getDB().prepare('DELETE FROM harvest_records WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
