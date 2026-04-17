const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    console.error('🔒 Auth Error:', err.message);
    res.status(403).json({ success: false, message: 'Invalid token.' });
  }
};
