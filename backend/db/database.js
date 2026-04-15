const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../farmsync.db');
let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fertilizer_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'kg',
      price_per_unit REAL NOT NULL DEFAULT 0,
      purchase_date TEXT,
      low_stock_alert REAL DEFAULT 50,
      payment_receipt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fertilizer_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_id INTEGER REFERENCES fertilizer_stock(id),
      plot TEXT NOT NULL,
      quantity_used REAL NOT NULL,
      water_quantity REAL,
      method TEXT NOT NULL DEFAULT 'Spray',
      chatni_natar_cha_day INTEGER,
      reason TEXT,
      weather TEXT,
      applied_by TEXT,
      applied_date TEXT NOT NULL DEFAULT (date('now')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS drip_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plot TEXT NOT NULL,
      fertilizer_id INTEGER REFERENCES fertilizer_stock(id),
      water_quantity REAL,
      schedule_time TEXT NOT NULL,
      duration_min INTEGER NOT NULL DEFAULT 30,
      frequency TEXT NOT NULL DEFAULT 'Daily',
      status TEXT NOT NULL DEFAULT 'Active',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT,
      worker_type TEXT NOT NULL DEFAULT 'Temporary',
      specialization TEXT,
      daily_wage REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Active',
      join_date TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id),
      date TEXT NOT NULL DEFAULT (date('now')),
      status TEXT NOT NULL DEFAULT 'Present',
      task TEXT,
      location TEXT,
      hours REAL NOT NULL DEFAULT 8,
      overtime REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(worker_id, date)
    );

    CREATE TABLE IF NOT EXISTS salary_advances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL DEFAULT (date('now')),
      team_name TEXT,
      work_description TEXT,
      plot_name TEXT,
      gut_no TEXT,
      advance_payment REAL NOT NULL DEFAULT 0,
      worker_id INTEGER REFERENCES workers(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Available',
      condition_status TEXT NOT NULL DEFAULT 'Good',
      purchase_date TEXT,
      last_service_date TEXT,
      next_service_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS equipment_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      assigned_to TEXT,
      issued_by TEXT,
      plot TEXT,
      task TEXT,
      issued_date TEXT NOT NULL DEFAULT (date('now')),
      return_date TEXT,
      condition_before TEXT,
      condition_after TEXT,
      status TEXT NOT NULL DEFAULT 'In Use',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment(id),
      type TEXT NOT NULL DEFAULT 'Service',
      description TEXT,
      cost REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL DEFAULT (date('now')),
      done_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS harvest_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plot TEXT NOT NULL,
      crop_variety TEXT NOT NULL,
      sample_date TEXT,
      quantity_kg REAL NOT NULL DEFAULT 0,
      harvest_date TEXT NOT NULL DEFAULT (date('now')),
      merchant_name TEXT,
      selling_rate REAL NOT NULL DEFAULT 0,
      total_revenue REAL NOT NULL DEFAULT 0,
      expenses_food REAL DEFAULT 0,
      quality_grade TEXT NOT NULL DEFAULT 'A',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      category TEXT NOT NULL,
      plot TEXT,
      amount REAL NOT NULL DEFAULT 0,
      description TEXT,
      date TEXT NOT NULL DEFAULT (date('now')),
      reference_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed admin
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (userCount.c === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)`)
      .run('Ketaki Patil', 'admin@farmsync.com', hash, 'admin');
    console.log('✅ Admin seeded → admin@farmsync.com / admin123');
  }

  // Seed sample data
  const fCount = db.prepare('SELECT COUNT(*) as c FROM fertilizer_stock').get();
  if (fCount.c === 0) {
    const stocks = [
      ['Urea', 'Nitrogen', 500, 'kg', 35, '2024-01-10', 100],
      ['DAP', 'Phosphate', 200, 'kg', 65, '2024-01-12', 150],
      ['Potash', 'Potassium', 750, 'kg', 45, '2024-01-15', 100],
      ['Micronutrient Mix', 'Organic', 120, 'kg', 120, '2024-01-20', 50],
    ];
    const ins = db.prepare(`INSERT INTO fertilizer_stock (name,type,quantity,unit,price_per_unit,purchase_date,low_stock_alert) VALUES (?,?,?,?,?,?,?)`);
    stocks.forEach(s => ins.run(...s));
  }

  const wCount = db.prepare('SELECT COUNT(*) as c FROM workers').get();
  if (wCount.c === 0) {
    const workers = [
      ['Ramesh Shinde', '9876543210', 'Permanent', 'Grape Expert', 450],
      ['Suresh Patil', '9876543211', 'Temporary', 'Helper', 350],
      ['Mahesh Kadam', '9876543212', 'Permanent', 'Equipment Operator', 500],
      ['Anita More', '9876543213', 'Temporary', 'Harvesting', 300],
      ['Vijay Desai', '9876543214', 'Permanent', 'Irrigation Expert', 480],
    ];
    const ins = db.prepare(`INSERT INTO workers (name,contact,worker_type,specialization,daily_wage) VALUES (?,?,?,?,?)`);
    workers.forEach(w => ins.run(...w));
  }

  const eCount = db.prepare('SELECT COUNT(*) as c FROM equipment').get();
  if (eCount.c === 0) {
    const equip = [
      ['Tractor', 'T-101', 'Tractor', 'Available', 'Good'],
      ['Tractor', 'T-102', 'Tractor', 'In Use', 'Good'],
      ['Power Sprayer', 'SP-01', 'Sprayer', 'Available', 'Good'],
      ['Drip Pump', 'DP-01', 'Irrigation', 'In Use', 'Good'],
      ['Harvester', 'HV-01', 'Harvester', 'Under Maintenance', 'Fair'],
      ['Rotavator', 'RT-01', 'Tillage', 'Available', 'Good'],
    ];
    const ins = db.prepare(`INSERT INTO equipment (name,code,type,status,condition_status) VALUES (?,?,?,?,?)`);
    equip.forEach(e => ins.run(...e));
  }

  const hCount = db.prepare('SELECT COUNT(*) as c FROM harvest_records').get();
  if (hCount.c === 0) {
    const harvests = [
      ['Plot A', 'Green Grapes', 2400, '2026-01-05', 'Shivaji Market', 45, 108000, 'A'],
      ['Plot C', 'Black Grapes', 1200, '2026-02-10', 'Sangli Fruits', 52, 62400, 'A'],
      ['Plot B', 'Thompson Grapes', 1800, '2026-01-20', 'Nashik Traders', 48, 86400, 'B'],
    ];
    const ins = db.prepare(`INSERT INTO harvest_records (plot,crop_variety,quantity_kg,harvest_date,merchant_name,selling_rate,total_revenue,quality_grade) VALUES (?,?,?,?,?,?,?,?)`);
    harvests.forEach(h => ins.run(...h));

    // Auto income transactions
    const ti = db.prepare(`INSERT INTO transactions (type,category,amount,description,date) VALUES ('income','Harvest',?,?,?)`);
    ti.run(108000, 'Harvest: Green Grapes - Plot A', '2026-01-05');
    ti.run(62400,  'Harvest: Black Grapes - Plot C',  '2026-02-10');
    ti.run(86400,  'Harvest: Thompson Grapes - Plot B','2026-01-20');

    // Sample expenses
    const te = db.prepare(`INSERT INTO transactions (type,category,amount,description,date) VALUES ('expense',?,?,?,?)`);
    te.run('Fertilizer', 17500, 'Purchased Urea 500kg', '2026-01-10');
    te.run('Fertilizer', 13000, 'Purchased DAP 200kg',  '2026-01-12');
    te.run('Labour',     50000, 'Monthly wages - January', '2026-01-31');
    te.run('Labour',     48000, 'Monthly wages - February', '2026-02-28');
    te.run('Maintenance', 8000, 'Tractor T-101 service', '2026-01-18');
    te.run('Equipment',  15000, 'Drip pipe replacement', '2026-02-05');
  }

  // Seed today's attendance
  const today = new Date().toISOString().split('T')[0];
  const todayAtt = db.prepare('SELECT COUNT(*) as c FROM attendance WHERE date=?').get(today);
  if (todayAtt.c === 0) {
    const allWorkers = db.prepare('SELECT id FROM workers').all();
    const ins = db.prepare(`INSERT OR IGNORE INTO attendance (worker_id,date,status,task,hours) VALUES (?,?,?,?,?)`);
    allWorkers.forEach((w, i) => {
      ins.run(w.id, today, i === 2 ? 'Absent' : 'Present', 'Grape pruning work', 8);
    });
  }

  // Activity log seed
  const aCount = db.prepare('SELECT COUNT(*) as c FROM activity_log').get();
  if (aCount.c === 0) {
    const acts = [
      ['Fertilizer', 'Spray Applied', 'Urea 50kg applied to Plot A via drip irrigation'],
      ['Labour', 'Attendance Marked', '4 workers marked present - Grape pruning work'],
      ['Equipment', 'Equipment Returned', 'Tractor T-101 serviced and returned to inventory'],
      ['Harvest', 'Harvest Recorded', '2400kg Green Grapes from Plot A — ₹1,08,000'],
    ];
    const ins = db.prepare(`INSERT INTO activity_log (module,action,description) VALUES (?,?,?)`);
    acts.forEach(a => ins.run(...a));
  }

  console.log('✅ Database ready with sample data');
}

module.exports = { getDB };
