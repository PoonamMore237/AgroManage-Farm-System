const router = require('express').Router();
const auth   = require('../middleware/auth');
const { getDB } = require('../db/database');

router.get('/stats', auth, (req, res) => {
  try {
    const db = getDB();
    const fertTotal  = db.prepare(`SELECT COALESCE(SUM(quantity),0) AS v FROM fertilizer_stock`).get().v;
    const workers    = db.prepare(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status='Active' THEN 1 END) AS active FROM workers`).get();
    const today      = new Date().toISOString().split('T')[0];
    const present    = db.prepare(`SELECT COUNT(*) AS v FROM attendance WHERE date=? AND status='Present'`).get(today).v;
    const eq         = db.prepare(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status='In Use' THEN 1 END) AS in_use, COUNT(CASE WHEN status='Under Maintenance' THEN 1 END) AS maint FROM equipment`).get();
    const month      = new Date().toISOString().substring(0,7);
    const fin        = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) AS rev, COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS exp FROM transactions WHERE strftime('%Y-%m',date)=?`).get(month);
    res.json({ success: true, data: {
      fertilizer_stock_kg: fertTotal,
      total_workers: workers.total, active_workers: workers.active, present_today: present,
      total_equipment: eq.total, equipment_in_use: eq.in_use, equipment_maintenance: eq.maint,
      monthly_revenue: fin.rev, monthly_expenses: fin.exp, monthly_profit: fin.rev - fin.exp
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/activities', auth, (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10`).all();
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/chart-data', auth, (req, res) => {
  try {
    const db = getDB();
    const expensesByCategory = db.prepare(`SELECT category, COALESCE(SUM(amount),0) AS total FROM transactions WHERE type='expense' GROUP BY category`).all();
    const yieldByPlot = db.prepare(`SELECT plot, COALESCE(SUM(quantity_kg),0) AS total_kg FROM harvest_records GROUP BY plot`).all();
    const trend = db.prepare(`
      SELECT strftime('%b',date) AS month, strftime('%Y-%m',date) AS month_key,
        COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END),0) AS revenue,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) AS expenses
      FROM transactions WHERE date >= date('now','-5 months')
      GROUP BY month_key ORDER BY month_key ASC
    `).all();
    res.json({ success: true, data: { expensesByCategory, yieldByPlot, trend } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
