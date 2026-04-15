# 🌿 FarmSync — Complete Agro Management System

## Project Structure
```
farmsync/
├── backend/
│   ├── server.js          ← Express server (runs on port 5000)
│   ├── package.json
│   ├── .env               ← Already configured
│   ├── db/database.js     ← SQLite DB + all tables + sample data
│   ├── middleware/auth.js
│   └── routes/
│       ├── auth.js
│       ├── dashboard.js
│       ├── fertilizer.js
│       ├── labour.js
│       ├── equipment.js
│       ├── harvest.js
│       └── finance.js
└── frontend/
    ├── index.html   ← Main dashboard (fully connected to API)
    └── login.html   ← Login page
```

---

## 🚀 RUN IN 3 COMMANDS

```bash
cd farmsync/backend
npm install
npm start
```

Then open: **http://localhost:5000/login.html**

Login: `admin@farmsync.com` / `admin123`

---

## ✅ What Works Out-of-the-Box

| Feature | Status |
|---------|--------|
| Login / JWT auth | ✅ |
| Dashboard (live stats + charts) | ✅ |
| Fertilizer stock CRUD | ✅ |
| Spray records + drip schedule | ✅ |
| Labour / Workers management | ✅ |
| Daily attendance (mark + save) | ✅ |
| Monthly wage summary | ✅ |
| Equipment CRUD + Issue/Return | ✅ |
| Equipment maintenance logs | ✅ |
| Harvest records + revenue | ✅ |
| Finance P&L + charts | ✅ |
| Activity feed | ✅ |
| Sample data pre-loaded | ✅ |

---

## ☁️ Deploy to Railway (Free)

1. Push to GitHub:
   ```bash
   git init && git add . && git commit -m "FarmSync launch"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. Go to https://railway.app → New Project → Deploy from GitHub

3. Set these env vars in Railway dashboard:
   - `JWT_SECRET` = any long random string
   - `NODE_ENV` = production

4. Done! Railway gives you a public URL.

---

## ☁️ Deploy to Render (Free)

1. Push to GitHub (same as above)
2. Go to https://render.com → New Web Service
3. Connect your repo
4. Set: Root Directory = `backend`, Build = `npm install`, Start = `node server.js`
5. Add env vars → Deploy!
