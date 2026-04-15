const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { getDB } = require('../db/database');
const auth = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required.' });
  try {
    const db   = getDB();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/register', (req, res) => {
  const { name, email, password, role = 'admin' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ success: false, message: 'All fields required.' });
  try {
    const db   = getDB();
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)').run(name, email.toLowerCase().trim(), hash, role);
    res.status(201).json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ success: false, message: 'Email already registered.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/me', auth, (req, res) => res.json({ success: true, user: req.user }));

module.exports = router;
