require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Init DB
require('./db/database').getDB();

// API Routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/fertilizer', require('./routes/fertilizer'));
app.use('/api/labour',     require('./routes/labour'));
app.use('/api/equipment',  require('./routes/equipment'));
app.use('/api/harvest',    require('./routes/harvest'));
app.use('/api/finance',    require('./routes/finance'));

// Serve frontend from /frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => {
  const fs   = require('fs');
  const file = path.join(__dirname, '../frontend/index.html');
  if (fs.existsSync(file)) res.sendFile(file);
  else res.status(404).send('Frontend not found');
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, message: 'Server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🌿 FarmSync running → http://localhost:${PORT}`);
  console.log(`   Login → admin@farmsync.com / admin123\n`);
});
