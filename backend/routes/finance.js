const router = require('express').Router();
const auth   = require('../middleware/auth');
const { getDB } = require('../db/database');

router.get('/transactions', auth, (req, res) => {
  const { type, month, category } = req.query;
  let sql = 'SELECT * FROM transactions WHERE 1=1'; const p = [];
  if (type)     { sql += ' AND type=?'; p.push(type); }
  if (month)    { sql += " AND strftime('%Y-%m',date)=?"; p.push(month); }
  if (category) { sql += ' AND category=?'; p.push(category); }
  sql += ' ORDER BY date DESC';
  try { res.json({ success: true, data: getDB().prepare(sql).all(...p) }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/transactions', auth, (req, res) => {
  const { type, category, plot, amount, description, date } = req.body;
  if (!type || !category || !amount) return res.status(400).json({ success: false, message: 'type, category, amount required.' });
  if (!['income','expense'].includes(type)) return res.status(400).json({ success: false, message: 'type must be income or expense.' });
  try {
    const info = getDB().prepare(`INSERT INTO transactions (type,category,plot,amount,description,date) VALUES (?,?,?,?,?,?)`)
      .run(type, category, plot||null, amount, description||'', date||new Date().toISOString().split('T')[0]);
    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/transactions/:id', auth, (req, res) => {
  try { getDB().prepare('DELETE FROM transactions WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/summary', auth, (req, res) => {
  const year = req.query.year || new Date().getFullYear().toString();
  try {
    const db = getDB();
    const monthly = db.prepare(`
      SELECT strftime('%m',date) AS month_num, strftime('%b %Y',date) AS month_label,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END),0) AS revenue,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expenses
      FROM transactions WHERE strftime('%Y',date)=? GROUP BY month_num ORDER BY month_num ASC
    `).all(year).map(m => ({ ...m, profit: m.revenue-m.expenses, margin: m.revenue>0?((m.revenue-m.expenses)/m.revenue*100).toFixed(1):0 }));
    const byCategory = db.prepare(`SELECT category, SUM(amount) AS total FROM transactions WHERE type='expense' AND strftime('%Y',date)=? GROUP BY category ORDER BY total DESC`).all(year);
    const annual = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS total_revenue, COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS total_expenses FROM transactions WHERE strftime('%Y',date)=?`).get(year);
    annual.net_profit = annual.total_revenue - annual.total_expenses;
    annual.profit_margin = annual.total_revenue>0?(annual.net_profit/annual.total_revenue*100).toFixed(1):0;
    res.json({ success: true, data: { monthly, by_category: byCategory, annual } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/plot-summary', auth, (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare(`SELECT plot, SUM(quantity_kg) AS total_kg, SUM(total_revenue) AS revenue, COUNT(*) AS batches FROM harvest_records GROUP BY plot`).all();
    
    // Calculate full P&L per plot
    const plRows = db.prepare(`
      SELECT plot, 
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS total_income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS total_expense
      FROM transactions 
      WHERE plot IS NOT NULL AND plot != ''
      GROUP BY plot 
      ORDER BY plot
    `).all();

    res.json({ success: true, data: rows, profit_loss: plRows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
