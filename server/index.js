const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { sendOtpEmail, sendWelcomeEmail } = require('./mailer');
const ai = require('./ai');

const app = express();
app.use(cors());
app.use(express.json());

// Serve built frontend files if they exist (for production/standalone mode)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(express.static(distPath));
  console.log('Serving frontend from dist/');
}

const dataPath = path.join(__dirname, 'jobbridge_users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Helper: authenticate JWT and attach payload to req.user
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || '';

// Plan definitions
const JOB_PLANS = {
  basic: { name: 'Basic', price: 2000, duration_days: 7, credits: 1 },
  standard: { name: 'Standard', price: 3500, duration_days: 14, credits: 1 },
  premium: { name: 'Premium', price: 5000, duration_days: 30, credits: 3 },
};

const AI_PLANS = {
  ai_monthly: { name: 'AI Career Tools Monthly', price: 1500, duration_days: 30, type: 'ai' },
  ai_annual: { name: 'AI Career Tools Annual', price: 15000, duration_days: 365, type: 'ai' },
};

const SERVICE_PLANS = {
  service_verified: { name: 'Verified Professional', price: 3000, duration_days: 30, type: 'service' },
  service_featured: { name: 'Featured Professional', price: 5000, duration_days: 30, type: 'service' },
};

function readUsers() {
  try {
    if (db && db.available) {
      return db.getAllUsers() || [];
    }
    if (!fs.existsSync(dataPath)) return [];
    const raw = fs.readFileSync(dataPath, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('readUsers error', err);
    return [];
  }
}

function writeUsers(users) {
  if (db && db.available) {
    try {
      for (const u of users) db.upsertUser(u);
    } catch (e) {
      console.error('db upsert users error', e);
    }
  }
  fs.writeFileSync(dataPath, JSON.stringify(users, null, 2), 'utf-8');
}

const otpPath = path.join(__dirname, 'jobbridge_otps.json');

function readOtps() {
  try {
    if (!fs.existsSync(otpPath)) return [];
    const raw = fs.readFileSync(otpPath, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('readOtps error', err);
    return [];
  }
}

function writeOtps(otps) {
  fs.writeFileSync(otpPath, JSON.stringify(otps, null, 2), 'utf-8');
}

// If sqlite is available, migrate JSON data into DB on startup (only if DB is empty)
const jobsPath = path.join(__dirname, 'jobs.json');
if (db && db.available) {
  try {
    const existingUsers = db.getAllUsers();
    if (existingUsers.length === 0) {
      db.migrateFromJson({ usersPath: dataPath, jobsPath });
      console.log('Migrated JSON data into SQLite');
    }
  } catch (e) {
    console.error('Migration to SQLite failed', e);
  }
}

app.post('/signup', (req, res) => {
  const { email, password, full_name, role, company } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const users = readUsers();
    if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email already registered' });
    const id = uuidv4();
    const password_hash = bcrypt.hashSync(password, 8);
    const user = { id, email, password_hash, full_name: full_name || null, role: role || 'job_seeker', company: company || null, phone: null, created_at: new Date().toISOString() };
    users.push(user);
    writeUsers(users);
    return res.json({ success: true, id, email });
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'Database error saving new user' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

// Login endpoint -> returns basic user info
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const users = readUsers();
    const user = users.find(u => u.email === email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const { password_hash, ...safe } = user;
    // issue JWT
    const token = jwt.sign({ id: safe.id, email: safe.email, role: safe.role }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ success: true, user: safe, token });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Create or upsert profile (used as fallback for create-profile function)
app.post('/profile', (req, res) => {
  const { id, email, full_name, role, company, phone } = req.body;
  if (!id || !email) return res.status(400).json({ error: 'id and email required' });
  try {
    // verify service token or allow (this is local dev fallback)
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        jwt.verify(auth.split(' ')[1], JWT_SECRET);
      } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    const users = readUsers();
    let user = users.find(u => u.id === id || u.email === email);
    if (user) {
      user.full_name = full_name || user.full_name;
      user.role = role || user.role;
      user.company = company || user.company;
      user.phone = phone || user.phone;
    } else {
      user = { id, email, password_hash: '', full_name: full_name || null, role: role || 'job_seeker', company: company || null, phone: phone || null, created_at: new Date().toISOString() };
      users.push(user);
    }
    writeUsers(users);
    const { password_hash, ...safe } = user;
    return res.json({ success: true, profile: safe });
  } catch (err) {
    console.error('profile create error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Get profile by id
app.get('/profile/:id', (req, res) => {
  const id = req.params.id;
  try {
    // allow access if token matches id or public lookup
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const token = auth.split(' ')[1];
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload && payload.id && payload.id !== id) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    const users = readUsers();
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: 'Profile not found' });
    const { password_hash, ...safe } = user;
    return res.json({ success: true, profile: safe });
  } catch (err) {
    console.error('profile error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Request OTP (stores code and sends it via email)
app.post('/otp/request', (req, res) => {
  const { email, phone, user_id, channel } = req.body;
  if (!email && !phone) return res.status(400).json({ error: 'email or phone required' });
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const id = uuidv4();
    const otp = { id, user_id: user_id || null, email: email || null, phone: phone || null, code, channel: channel || (email ? 'email' : 'sms'), expires_at: expiresAt, used: 0 };
    if (db && db.available) {
      db.createOtp(otp);
    } else {
      const otps = readOtps();
      otps.push({ ...otp, used: false });
      writeOtps(otps);
    }
    // Send the code to the user's email
    if (email) {
      sendOtpEmail(email, code);
    }
    return res.json({ success: true, id });
  } catch (err) {
    console.error('otp request error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Verify OTP
app.post('/otp/verify', (req, res) => {
  const { email, phone, code } = req.body;
  if (!code || (!email && !phone)) return res.status(400).json({ error: 'email or phone and code required' });
  try {
    if (db && db.available) {
      const match = db.findOtp(email || null, phone || null, code);
      if (!match) return res.status(400).json({ error: 'Invalid or expired code' });
      db.markOtpUsed(match.id);
      return res.json({ success: true });
    }
    const otps = readOtps();
    const now = new Date().toISOString();
    const match = otps.find(o => ((email && o.email === email) || (phone && o.phone === phone)) && o.code === code && !o.used && o.expires_at > now);
    if (!match) return res.status(400).json({ error: 'Invalid or expired code' });
    match.used = true;
    writeOtps(otps);
    return res.json({ success: true });
  } catch (err) {
    console.error('otp verify error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Welcome email endpoint
app.post('/welcome', (req, res) => {
  const { email, name, role } = req.body;
  if (email) {
    sendWelcomeEmail(email, name, role);
  }
  return res.json({ success: true });
});

// Admin: Get all jobs with status (admin only)
app.get('/admin/jobs', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    let jobs;
    if (db && db.available) {
      jobs = db.getAllJobs();
    } else {
      jobs = readJobs();
    }
    return res.json({ success: true, jobs });
  } catch (err) {
    console.error('admin jobs error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Admin: Approve a job (admin only)
app.post('/admin/jobs/:id/approve', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    if (db && db.available) {
      const job = db.getJobById(req.params.id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      job.status = 'approved';
      db.updateJob(job);
      return res.json({ success: true, job });
    }
    const jobs = readJobs();
    const idx = jobs.findIndex(j => j.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Job not found' });
    jobs[idx].status = 'approved';
    writeJobs(jobs);
    return res.json({ success: true, job: jobs[idx] });
  } catch (err) {
    console.error('admin approve error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Admin: Reject a job (admin only)
app.post('/admin/jobs/:id/reject', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    const { reason } = req.body;
    if (db && db.available) {
      const job = db.getJobById(req.params.id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      job.status = 'rejected';
      job.rejection_reason = reason || null;
      db.updateJob(job);
      return res.json({ success: true, job });
    }
    const jobs = readJobs();
    const idx = jobs.findIndex(j => j.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Job not found' });
    jobs[idx].status = 'rejected';
    jobs[idx].rejection_reason = reason || null;
    writeJobs(jobs);
    return res.json({ success: true, job: jobs[idx] });
  } catch (err) {
    console.error('admin reject error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Admin: Get all applications (admin only)
app.get('/admin/applications', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    let applications = [];
    if (db && db.available) {
      applications = db.getAllApplications();
    } else {
      const appsPath = path.join(__dirname, 'applications.json');
      applications = fs.existsSync(appsPath) ? JSON.parse(fs.readFileSync(appsPath, 'utf-8') || '[]') : [];
    }
    const users = readUsers();
    const jobs = readJobs();
    const enriched = applications.map(app => {
      const user = users.find(u => u.id === app.user_id);
      const job = jobs.find(j => j.id === app.job_id);
      const { password_hash, ...safeUser } = user || {};
      return { ...app, applicant: safeUser || null, job: job || null };
    });
    return res.json({ success: true, applications: enriched });
  } catch (err) {
    console.error('admin applications error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Admin: Get all users (admin only)
app.get('/admin/users', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    const users = readUsers();
    const safe = users.map(({ password_hash, ...u }) => u);
    return res.json({ success: true, users: safe });
  } catch (err) {
    console.error('admin users error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Admin: Get all transactions (admin only)
app.get('/admin/transactions', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    let transactions = [];
    if (db && db.available) {
      transactions = db.getAllTransactions();
    } else {
      const txsPath = path.join(__dirname, 'transactions.json');
      transactions = fs.existsSync(txsPath) ? JSON.parse(fs.readFileSync(txsPath, 'utf-8') || '[]') : [];
    }
    const users = readUsers();
    const enriched = transactions.map(tx => {
      const user = users.find(u => u.id === tx.user_id);
      const { password_hash, ...safeUser } = user || {};
      return { ...tx, user: safeUser || null };
    });
    return res.json({ success: true, transactions: enriched });
  } catch (err) {
    console.error('admin transactions error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Admin: Get dashboard stats (admin only)
app.get('/admin/stats', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    let stats = { users: 0, jobs: 0, pendingJobs: 0, approvedJobs: 0, rejectedJobs: 0, applications: 0, revenue: 0, transactionsCount: 0 };
    if (db && db.available) {
      stats.users = db.getUsersCount();
      stats.applications = db.getApplicationsCount();
      stats.revenue = db.getTransactionsTotal('completed');
      const txs = db.getAllTransactions();
      stats.transactionsCount = txs.filter(t => t.status === 'completed').length;
      const jobs = db.getAllJobs();
      stats.jobs = jobs.length;
      stats.pendingJobs = jobs.filter(j => j.status === 'pending').length;
      stats.approvedJobs = jobs.filter(j => j.status === 'approved' || !j.status).length;
      stats.rejectedJobs = jobs.filter(j => j.status === 'rejected').length;
    } else {
      const users = readUsers();
      const jobs = readJobs();
      stats.users = users.length;
      stats.jobs = jobs.length;
      stats.pendingJobs = jobs.filter(j => j.status === 'pending').length;
      stats.approvedJobs = jobs.filter(j => j.status === 'approved' || !j.status).length;
      stats.rejectedJobs = jobs.filter(j => j.status === 'rejected').length;
      const appsPath = path.join(__dirname, 'applications.json');
      const apps = fs.existsSync(appsPath) ? JSON.parse(fs.readFileSync(appsPath, 'utf-8') || '[]') : [];
      stats.applications = apps.length;
      const txsPath = path.join(__dirname, 'transactions.json');
      const txs = fs.existsSync(txsPath) ? JSON.parse(fs.readFileSync(txsPath, 'utf-8') || '[]') : [];
      stats.transactionsCount = txs.filter(t => t.status === 'completed').length;
      stats.revenue = txs.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.amount || 0), 0);
    }
    return res.json({ success: true, stats });
  } catch (err) {
    console.error('admin stats error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Admin: Comprehensive dashboard data (admin only)
app.get('/admin/dashboard', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    const dashboard = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    if (db && db.available) {
      const allUsers = db.getAllUsers();
      const allJobs = db.getAllJobs();
      const allTx = db.getAllTransactions();
      dashboard.totalUsers = allUsers.length;
      dashboard.totalJobs = allJobs.length;
      dashboard.pendingJobs = allJobs.filter(function(j) { return j.status === 'pending'; }).length;
      dashboard.approvedJobs = allJobs.filter(function(j) { return j.status === 'approved' || !j.status; }).length;
      dashboard.rejectedJobs = allJobs.filter(function(j) { return j.status === 'rejected'; }).length;
      dashboard.totalApplications = db.getApplicationsCount();
      dashboard.totalRevenue = db.getTransactionsTotal('completed');
      dashboard.completedPayments = allTx.filter(function(t) { return t.status === 'completed'; }).length;
      dashboard.roleCounts = db.getUsersByRoleCount();
      dashboard.activeSubscribers = db.getActiveSubscribersCount();
      dashboard.activeAiSubscribers = db.getActiveAiSubscribersCount();
      dashboard.applicationStatusCounts = db.getApplicationsByStatusCount();
      dashboard.categoryDistribution = db.getCategoryDistribution();
      dashboard.planDistribution = db.getPlanDistribution('completed');
      dashboard.jobsTrend = db.getJobsByDateRange(thirtyDaysAgo, now.toISOString());
      dashboard.applicationsTrend = db.getApplicationsByDateRange(thirtyDaysAgo, now.toISOString());
      dashboard.revenueTrend = db.getRevenueByDateRange(thirtyDaysAgo, now.toISOString());
      var todayJobs = db.getJobsByDateRange(todayStart, now.toISOString());
      dashboard.jobsToday = todayJobs.reduce(function(s, r) { return s + r.count; }, 0);
      var todayApps = db.getApplicationsByDateRange(todayStart, now.toISOString());
      dashboard.applicationsToday = todayApps.reduce(function(s, r) { return s + r.count; }, 0);
      var newUsersThisWeek = allUsers.filter(function(u) { return u.created_at >= sevenDaysAgo; });
      dashboard.newUsersThisWeek = newUsersThisWeek.length;
      dashboard.newRecruitersThisWeek = newUsersThisWeek.filter(function(u) { return u.role === 'recruiter'; }).length;
    } else {
      var users = readUsers();
      var jobs = readJobs();
      var appsPath = path.join(__dirname, 'applications.json');
      var apps = fs.existsSync(appsPath) ? JSON.parse(fs.readFileSync(appsPath, 'utf-8') || '[]') : [];
      var txsPath = path.join(__dirname, 'transactions.json');
      var txs = fs.existsSync(txsPath) ? JSON.parse(fs.readFileSync(txsPath, 'utf-8') || '[]') : [];

      dashboard.totalUsers = users.length;
      dashboard.totalJobs = jobs.length;
      dashboard.pendingJobs = jobs.filter(function(j) { return j.status === 'pending'; }).length;
      dashboard.approvedJobs = jobs.filter(function(j) { return j.status === 'approved' || !j.status; }).length;
      dashboard.rejectedJobs = jobs.filter(function(j) { return j.status === 'rejected'; }).length;
      dashboard.totalApplications = apps.length;
      dashboard.totalRevenue = txs.filter(function(t) { return t.status === 'completed'; }).reduce(function(s, t) { return s + (t.amount || 0); }, 0);
      dashboard.completedPayments = txs.filter(function(t) { return t.status === 'completed'; }).length;

      var roleMap = {};
      users.forEach(function(u) { var r = u.role || 'job_seeker'; roleMap[r] = (roleMap[r] || 0) + 1; });
      dashboard.roleCounts = Object.keys(roleMap).map(function(role) { return { role: role, count: roleMap[role] }; });

      dashboard.activeSubscribers = users.filter(function(u) { return u.subscription_status === 'active'; }).length;
      dashboard.activeAiSubscribers = users.filter(function(u) { return u.ai_subscription_status === 'active'; }).length;

      var appStatusMap = {};
      apps.forEach(function(a) { var s = a.status || 'pending'; appStatusMap[s] = (appStatusMap[s] || 0) + 1; });
      dashboard.applicationStatusCounts = Object.keys(appStatusMap).map(function(status) { return { status: status, count: appStatusMap[status] }; });

      var catMap = {};
      jobs.filter(function(j) { return j.category; }).forEach(function(j) { catMap[j.category] = (catMap[j.category] || 0) + 1; });
      dashboard.categoryDistribution = Object.keys(catMap).map(function(category) { return { category: category, count: catMap[category] }; });

      var planMap = {};
      txs.filter(function(t) { return t.status === 'completed'; }).forEach(function(t) { var p = t.plan || 'unknown'; planMap[p] = (planMap[p] || 0) + 1; });
      dashboard.planDistribution = Object.keys(planMap).map(function(plan) { return { plan: plan, count: planMap[plan] }; });

      var dateRange = function(items, dateField, start, end) {
        var map = {};
        items
          .filter(function(i) { return i[dateField] >= start && i[dateField] <= end; })
          .forEach(function(i) {
            var d = i[dateField].split('T')[0];
            map[d] = (map[d] || 0) + 1;
          });
        return Object.keys(map).map(function(date) { return { date: date, count: map[date] }; });
      };
      dashboard.jobsTrend = dateRange(jobs, 'created_at', thirtyDaysAgo, now.toISOString());
      dashboard.applicationsTrend = dateRange(apps, 'created_at', thirtyDaysAgo, now.toISOString());

      var revMap = {};
      txs.filter(function(t) { return t.status === 'completed' && t.created_at >= thirtyDaysAgo; })
        .forEach(function(t) {
          var d = t.created_at.split('T')[0];
          revMap[d] = (revMap[d] || 0) + (t.amount || 0);
        });
      dashboard.revenueTrend = Object.keys(revMap).map(function(date) { return { date: date, total: revMap[date] }; });

      var todayKey = now.toISOString().split('T')[0];
      dashboard.jobsToday = jobs.filter(function(j) { return j.created_at && j.created_at.startsWith(todayKey); }).length;
      dashboard.applicationsToday = apps.filter(function(a) { return a.created_at && a.created_at.startsWith(todayKey); }).length;
      dashboard.newUsersThisWeek = users.filter(function(u) { return u.created_at >= sevenDaysAgo; }).length;
      dashboard.newRecruitersThisWeek = users.filter(function(u) { return u.role === 'recruiter' && u.created_at >= sevenDaysAgo; }).length;
    }

    return res.json({ success: true, dashboard });
  } catch (err) {
    console.error('admin dashboard error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Admin secret code check
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'jobbridge-admin-2026';
app.post('/admin/check-secret', (req, res) => {
  const { code } = req.body;
  if (code === ADMIN_SECRET) return res.json({ success: true, valid: true });
  return res.json({ success: true, valid: false });
});

// AI: Generate job description
app.post('/ai/generate-jd', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ error: 'Only recruiters can use this feature' });
    const { title, requirements } = req.body;
    if (!title) return res.status(400).json({ error: 'Job title is required' });
    const jd = await ai.generateJD(title, requirements || []);
    return res.json({ success: true, jd });
  } catch (err) {
    console.error('AI generate JD error', err);
    return res.status(500).json({ error: 'AI generation failed' });
  }
});

// Helper: check AI subscription for job seeker AI tools
function requireAiSubscription(req, res, next) {
  if (db && db.available) {
    const row = db.getUserAiSubscription(req.user.id);
    if (row && row.ai_subscription_status === 'active' && row.ai_subscription_expires_at && new Date(row.ai_subscription_expires_at) > new Date()) {
      return next();
    }
  } else {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (user && user.ai_subscription_status === 'active' && user.ai_subscription_expires_at && new Date(user.ai_subscription_expires_at) > new Date()) {
      return next();
    }
  }
  return res.status(403).json({ error: 'AI Career Tools subscription required', upgrade: true, redirect: '/pricing' });
}

// AI: Extract skills from resume text
app.post('/ai/extract-skills', authenticate, requireAiSubscription, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 20) return res.status(400).json({ error: 'Resume text is too short' });
    const skills = await ai.extractSkills(text);
    return res.json({ success: true, skills });
  } catch (err) {
    console.error('AI extract skills error', err);
    return res.status(500).json({ error: 'Skill extraction failed' });
  }
});

// AI: Tailor resume for a specific job
app.post('/ai/tailor-resume', authenticate, requireAiSubscription, async (req, res) => {
  try {
    const { resume_text, job_description, job_title } = req.body;
    if (!resume_text || !job_title) return res.status(400).json({ error: 'Resume text and job title required' });
    const tailored = await ai.tailorResume(resume_text, job_description || '', job_title);
    return res.json({ success: true, tailored_resume: tailored });
  } catch (err) {
    console.error('AI tailor resume error', err);
    return res.status(500).json({ error: 'Resume tailoring failed' });
  }
});

// AI: Generate cover letter
app.post('/ai/generate-cover-letter', authenticate, requireAiSubscription, async (req, res) => {
  try {
    const { resume_text, job_description, job_title, company_name } = req.body;
    if (!resume_text || !job_title) return res.status(400).json({ error: 'Resume text and job title required' });
    const letter = await ai.generateCoverLetter(resume_text, job_description || '', job_title, company_name || '');
    return res.json({ success: true, cover_letter: letter });
  } catch (err) {
    console.error('AI cover letter error', err);
    return res.status(500).json({ error: 'Cover letter generation failed' });
  }
});

// AI: Score candidates against job requirements
app.post('/ai/score-candidates', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ error: 'Only recruiters can score candidates' });
    const { job_requirements, candidates } = req.body;
    if (!job_requirements || !candidates) return res.status(400).json({ error: 'Job requirements and candidates required' });
    const scored = await ai.scoreCandidates(job_requirements, candidates);
    return res.json({ success: true, ranked_candidates: scored });
  } catch (err) {
    console.error('AI score candidates error', err);
    return res.status(500).json({ error: 'Candidate scoring failed' });
  }
});

function readJobs() {
  try {
    if (!fs.existsSync(jobsPath)) return [];
    const raw = fs.readFileSync(jobsPath, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('readJobs error', err);
    return [];
  }
}

function writeJobs(jobs) {
  if (db && db.available) {
    try {
      for (const j of jobs) db.createJob(j);
    } catch (e) {
      console.error('db writeJobs error', e);
    }
  }
  fs.writeFileSync(jobsPath, JSON.stringify(jobs, null, 2), 'utf-8');
}

// List jobs (only approved for non-admins)
app.get('/jobs', (req, res) => {
  try {
    const auth = req.headers.authorization;
    let isAdmin = false;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
        if (payload.role === 'admin') isAdmin = true;
      } catch (e) {}
    }

    let jobs;
    if (db && db.available) {
      jobs = db.getAllJobs();
    } else {
      jobs = readJobs();
    }

    if (!isAdmin) {
      jobs = jobs.filter(j => j.status === 'approved' || !j.status);
    }

    return res.json({ success: true, jobs });
  } catch (err) {
    console.error('jobs list error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Get single job
app.get('/jobs/:id', (req, res) => {
  try {
    if (db && db.available) {
      const job = db.getJobById(req.params.id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      return res.json({ success: true, job });
    }
    const jobs = readJobs();
    const job = jobs.find(j => j.id === req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ success: true, job });
  } catch (err) {
    console.error('jobs get error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Create job (protected: recruiter only, subscription required)
app.post('/jobs', authenticate, (req, res) => {
  try {
    const { title, company, location, type, salary, description, recruiter_id, benefits, category, company_logo } = req.body;
    if (!title || !company) return res.status(400).json({ error: 'title and company required' });

    // confirm requester is a recruiter via JWT payload
    if (req.user.role !== 'recruiter') return res.status(403).json({ error: 'Only recruiters can post jobs' });

    // Check subscription credits
    let credits = 0;
    let subStatus = 'inactive';
    if (db && db.available) {
      const row = db.getUserSubscription(req.user.id);
      if (row) {
        subStatus = row.subscription_status || 'inactive';
        credits = row.job_post_credits || 0;
        // Check expiry
        if (row.subscription_expires_at && new Date(row.subscription_expires_at) < new Date()) {
          subStatus = 'expired';
          credits = 0;
        }
      }
    } else {
      const users = readUsers();
      const user = users.find(u => u.id === req.user.id);
      if (user) {
        subStatus = user.subscription_status || 'inactive';
        credits = user.job_post_credits || 0;
        if (user.subscription_expires_at && new Date(user.subscription_expires_at) < new Date()) {
          subStatus = 'expired';
          credits = 0;
        }
      }
    }

    if (subStatus !== 'active' || credits < 1) {
      return res.status(403).json({
        error: 'No active subscription or insufficient credits',
        subscription: { status: subStatus, credits },
        upgrade: true,
      });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const job = {
      id,
      recruiter_id: recruiter_id || req.user.id,
      title,
      company,
      description: description || '',
      location: location || 'Remote',
      type: type || 'Full-time',
      salary_range: salary || null,
      is_featured: false,
      is_active: true,
      status: 'pending',
      expires_at: null,
      views: 0,
      applications_count: 0,
      created_at: now,
      updated_at: now,
      benefits: benefits || null,
      category: category || null,
      company_logo: company_logo || null,
    };

    if (db && db.available) {
      db.createJob(job);
      db.decrementCredits(req.user.id);
      return res.json({ success: true, job, credits_remaining: credits - 1 });
    }

    const jobs = readJobs();
    jobs.unshift(job);
    writeJobs(jobs);
    // Decrement credit
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    if (user) {
      user.job_post_credits = (user.job_post_credits || 0) - 1;
      writeUsers(users);
    }
    return res.json({ success: true, job, credits_remaining: (credits - 1) });
  } catch (err) {
    console.error('jobs create error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Update job
app.put('/jobs/:id', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ error: 'Only recruiters can update jobs' });

    let existing;
    if (db && db.available) {
      existing = db.getJobById(req.params.id);
    } else {
      const jobs = readJobs();
      existing = jobs.find(j => j.id === req.params.id);
    }

    if (!existing) return res.status(404).json({ error: 'Job not found' });
    if (existing.recruiter_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to update this job' });

    // Sanitize update: Only allow specific fields and prevent metadata modification
    const { title, company, location, type, salary_range, description, is_active, expires_at } = req.body;
    const updated = { 
      ...existing, 
      title: title || existing.title,
      company: company || existing.company,
      location: location || existing.location,
      type: type || existing.type,
      salary_range: salary_range || existing.salary_range,
      description: description || existing.description,
      is_active: is_active !== undefined ? is_active : existing.is_active,
      expires_at: expires_at !== undefined ? expires_at : existing.expires_at,
      updated_at: new Date().toISOString() 
    };

    if (db && db.available) {
      db.updateJob(updated);
      return res.json({ success: true, job: updated });
    }

    const jobs = readJobs();
    const idx = jobs.findIndex(j => j.id === req.params.id);
    jobs[idx] = updated;
    writeJobs(jobs);
    return res.json({ success: true, job: updated });
  } catch (err) {
    console.error('jobs update error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Delete job
app.delete('/jobs/:id', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ error: 'Only recruiters can delete jobs' });

    let existing;
    if (db && db.available) {
      existing = db.getJobById(req.params.id);
    } else {
      const jobs = readJobs();
      existing = jobs.find(j => j.id === req.params.id);
    }

    if (!existing) return res.status(404).json({ error: 'Job not found' });
    if (existing.recruiter_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to delete this job' });

    if (db && db.available) {
      db.deleteJob(req.params.id);
      return res.json({ success: true });
    }

    const jobs = readJobs();
    const filtered = jobs.filter(j => j.id !== req.params.id);
    if (filtered.length === jobs.length) return res.status(404).json({ error: 'Job not found' });
    writeJobs(filtered);
    return res.json({ success: true });
  } catch (err) {
    console.error('jobs delete error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// === APPLICATION ROUTES ===

const multer = require('multer');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `cv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.rtf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only pdf, doc, docx & rtf files allowed'));
  },
});

// Submit an application
app.post('/applications', authenticate, upload.single('cv'), (req, res) => {
  try {
    if (req.user.role !== 'job_seeker') return res.status(403).json({ error: 'Only job seekers can apply' });
    const { job_id, date_of_birth, gender, is_disabled, is_displaced, professional_headline, years_of_experience, function: fn, work_type, highest_qualification, location, availability, salary_expectation, cover_letter } = req.body;
    if (!job_id || !professional_headline || !years_of_experience) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const application = {
      id,
      job_id,
      user_id: req.user.id,
      date_of_birth: date_of_birth || null,
      gender: gender || null,
      is_disabled: is_disabled === 'true' || is_disabled === 'yes' ? 1 : 0,
      is_displaced: is_displaced === 'true' || is_displaced === 'yes' ? 1 : 0,
      professional_headline,
      years_of_experience,
      function: fn || '',
      work_type: work_type || '',
      highest_qualification: highest_qualification || '',
      location: location || '',
      availability: availability || '',
      salary_expectation: parseInt(salary_expectation) || 0,
      cv_path: req.file ? req.file.filename : null,
      cv_original_name: req.file ? req.file.originalname : null,
      cover_letter: cover_letter || null,
      status: 'pending',
      recruiter_notes: null,
      created_at: now,
    };

    if (db && db.available) {
      db.createApplication(application);
      // Increment applications_count on the job
      const job = db.getJobById(job_id);
      if (job) {
        job.applications_count = (job.applications_count || 0) + 1;
        db.updateJob(job);
      }
    } else {
      const appsPath = path.join(__dirname, 'applications.json');
      const apps = fs.existsSync(appsPath) ? JSON.parse(fs.readFileSync(appsPath, 'utf-8') || '[]') : [];
      apps.unshift(application);
      fs.writeFileSync(appsPath, JSON.stringify(apps, null, 2));
      // Update jobs.json count
      const jobs = readJobs();
      const job = jobs.find(j => j.id === job_id);
      if (job) {
        job.applications_count = (job.applications_count || 0) + 1;
        writeJobs(jobs);
      }
    }

    return res.json({ success: true, application });
  } catch (err) {
    console.error('application create error', err);
    return res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Upload error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.includes('Only pdf')) {
    return res.status(400).json({ error: err.message || 'File upload error' });
  }
  next(err);
});

// Get applications for a specific job (recruiter/admin)
app.get('/jobs/:id/applications', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only recruiters and admins can view applications' });
    }

    let applications;
    if (db && db.available) {
      applications = db.getApplicationsByJob(req.params.id);
    } else {
      const appsPath = path.join(__dirname, 'applications.json');
      applications = fs.existsSync(appsPath) ? JSON.parse(fs.readFileSync(appsPath, 'utf-8') || '[]') : [];
      applications = applications.filter(a => a.job_id === req.params.id);
    }

    // Attach user profile info
    const users = readUsers();
    const enriched = applications.map(app => {
      const user = users.find(u => u.id === app.user_id);
      const { password_hash, ...safeUser } = user || {};
      return { ...app, applicant: safeUser || null };
    });

    return res.json({ success: true, applications: enriched });
  } catch (err) {
    console.error('applications list error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Get current user's applications
app.get('/my-applications', authenticate, (req, res) => {
  try {
    let applications;
    if (db && db.available) {
      applications = db.getApplicationsByUser(req.user.id);
    } else {
      const appsPath = path.join(__dirname, 'applications.json');
      applications = fs.existsSync(appsPath) ? JSON.parse(fs.readFileSync(appsPath, 'utf-8') || '[]') : [];
      applications = applications.filter(a => a.user_id === req.user.id);
    }

    // Attach job info
    const jobs = readJobs();
    const enriched = applications.map(app => {
      const job = jobs.find(j => j.id === app.job_id);
      return { ...app, job: job || null };
    });

    return res.json({ success: true, applications: enriched });
  } catch (err) {
    console.error('my-applications error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Get all applications for a recruiter's jobs
app.get('/recruiter/applications', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'recruiter') return res.status(403).json({ error: 'Only recruiters' });

    let applications;
    if (db && db.available) {
      applications = db.getApplicationsByRecruiter(req.user.id);
    } else {
      const appsPath = path.join(__dirname, 'applications.json');
      const allApps = fs.existsSync(appsPath) ? JSON.parse(fs.readFileSync(appsPath, 'utf-8') || '[]') : [];
      const jobs = readJobs().filter(j => j.recruiter_id === req.user.id);
      const jobIds = jobs.map(j => j.id);
      applications = allApps.filter(a => jobIds.includes(a.job_id));
    }

    const users = readUsers();
    const jobs = readJobs();
    const enriched = applications.map(app => {
      const user = users.find(u => u.id === app.user_id);
      const { password_hash, ...safeUser } = user || {};
      const job = jobs.find(j => j.id === app.job_id);
      return { ...app, applicant: safeUser || null, job: job || null };
    });

    return res.json({ success: true, applications: enriched });
  } catch (err) {
    console.error('recruiter applications error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Update application status (recruiter)
app.put('/applications/:id/status', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'recruiter' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only recruiters can update application status' });
    }

    const { status, notes } = req.body;
    if (!['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (db && db.available) {
      const app = db.getApplicationById(req.params.id);
      if (!app) return res.status(404).json({ error: 'Application not found' });
      db.updateApplicationStatus({ id: req.params.id, status, notes: notes || null });
    } else {
      const appsPath = path.join(__dirname, 'applications.json');
      const apps = fs.existsSync(appsPath) ? JSON.parse(fs.readFileSync(appsPath, 'utf-8') || '[]') : [];
      const idx = apps.findIndex(a => a.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Application not found' });
      apps[idx].status = status;
      apps[idx].recruiter_notes = notes || null;
      fs.writeFileSync(appsPath, JSON.stringify(apps, null, 2));
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('application status error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Serve uploaded CV files
app.use('/uploads', express.static(uploadsDir));

// === PAYMENT & SUBSCRIPTION ROUTES ===

// Initialize a payment transaction
app.post('/pay/initialize', authenticate, (req, res) => {
  try {
    const { plan } = req.body;
    const isAiPlan = AI_PLANS[plan];
    const isJobPlan = JOB_PLANS[plan];
    const isServicePlan = SERVICE_PLANS[plan];
    if (!isAiPlan && !isJobPlan && !isServicePlan) return res.status(400).json({ error: 'Invalid plan.' });
    if (isJobPlan && req.user.role !== 'recruiter') return res.status(403).json({ error: 'Only recruiters can purchase job posting plans' });
    if (isAiPlan && req.user.role !== 'job_seeker') return res.status(403).json({ error: 'Only job seekers can purchase AI Career Tools' });
    if (isServicePlan && req.user.role !== 'provider') return res.status(403).json({ error: 'Only service providers can purchase listing plans' });

    const planConfig = isAiPlan || isJobPlan || isServicePlan;
    const reference = 'JB-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    const txId = uuidv4();

    const tx = {
      id: txId,
      user_id: req.user.id,
      reference,
      amount: planConfig.price,
      currency: 'NGN',
      status: 'pending',
      plan,
      metadata: JSON.stringify(planConfig),
      created_at: new Date().toISOString(),
    };

    if (db && db.available) {
      db.createTransaction(tx);
    } else {
      const txsPath = path.join(__dirname, 'transactions.json');
      const txs = fs.existsSync(txsPath) ? JSON.parse(fs.readFileSync(txsPath, 'utf-8') || '[]') : [];
      txs.push(tx);
      fs.writeFileSync(txsPath, JSON.stringify(txs, null, 2));
    }

    return res.json({
      success: true,
      reference,
      amount: planConfig.price,
      plan: planConfig.name,
      public_key: PAYSTACK_PUBLIC_KEY,
    });
  } catch (err) {
    console.error('pay initialize error', err);
    return res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// Verify a Paystack payment and activate subscription
app.post('/pay/verify', authenticate, async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ error: 'Reference required' });

    // Find the local transaction
    let tx;
    if (db && db.available) {
      tx = db.getTransactionByRef(reference);
    } else {
      const txsPath = path.join(__dirname, 'transactions.json');
      const txs = fs.existsSync(txsPath) ? JSON.parse(fs.readFileSync(txsPath, 'utf-8') || '[]') : [];
      tx = txs.find(t => t.reference === reference);
    }

    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status === 'completed') return res.json({ success: true, message: 'Already verified' });
    if (tx.user_id !== req.user.id) return res.status(403).json({ error: 'Not your transaction' });

    // Verify with Paystack API
    let verified = false;
    if (PAYSTACK_SECRET_KEY) {
      try {
        const https = require('https');
        const verifyRes = await new Promise((resolve, reject) => {
          const url = `https://api.paystack.co/transaction/verify/${reference}`;
          https.get(url, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
          }, (resp) => {
            let data = '';
            resp.on('data', chunk => data += chunk);
            resp.on('end', () => {
              try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
          }).on('error', reject);
        });
        if (verifyRes.status && verifyRes.data.status === 'success') {
          verified = true;
        }
      } catch (err) {
        console.error('Paystack verification error', err);
        return res.status(500).json({ error: 'Payment verification failed. Please contact support.' });
      }
    } else {
      // No Paystack key — auto-verify for development/testing
      verified = true;
      console.warn('PAYSTACK_SECRET_KEY not set — auto-verifying transaction in dev mode');
    }

    if (!verified) {
      return res.status(400).json({ error: 'Payment not confirmed by Paystack' });
    }

    // Mark transaction as completed
    const now = new Date().toISOString();
    if (db && db.available) {
      db.verifyTransaction({ reference, status: 'completed', verified_at: now });
    } else {
      const txsPath = path.join(__dirname, 'transactions.json');
      const txs = fs.existsSync(txsPath) ? JSON.parse(fs.readFileSync(txsPath, 'utf-8') || '[]') : [];
      const idx = txs.findIndex(t => t.reference === reference);
      if (idx !== -1) { txs[idx].status = 'completed'; txs[idx].verified_at = now; }
      fs.writeFileSync(txsPath, JSON.stringify(txs, null, 2));
    }

    // Activate subscription
    const jobPlan = JOB_PLANS[tx.plan];
    const aiPlan = AI_PLANS[tx.plan];
    const servicePlan = SERVICE_PLANS[tx.plan];
    const planConfig = jobPlan || aiPlan || servicePlan;
    if (!planConfig) return res.status(400).json({ error: 'Unknown plan ' + tx.plan });

    const expiresAt = new Date(Date.now() + planConfig.duration_days * 24 * 60 * 60 * 1000).toISOString();
    const isAi = !!aiPlan;
    const isService = !!servicePlan;

    if (db && db.available) {
      if (isAi) {
        db.updateAiSubscription({
          user_id: req.user.id,
          tier: tx.plan,
          status: 'active',
          expires_at: expiresAt,
        });
      } else if (isService) {
        db.updateProviderSubscription({
          user_id: req.user.id,
          tier: tx.plan,
          status: 'active',
          expires_at: expiresAt,
        });
      } else {
        db.updateSubscription({
          user_id: req.user.id,
          tier: tx.plan,
          status: 'active',
          expires_at: expiresAt,
          credits: planConfig.credits,
        });
      }
    } else {
      const users = readUsers();
      const user = users.find(u => u.id === req.user.id);
      if (user) {
        if (isAi) {
          user.ai_subscription_tier = tx.plan;
          user.ai_subscription_status = 'active';
          user.ai_subscription_expires_at = expiresAt;
        } else if (isService) {
          user.provider_subscription_tier = tx.plan;
          user.provider_subscription_status = 'active';
          user.provider_subscription_expires_at = expiresAt;
        } else {
          user.subscription_tier = tx.plan;
          user.subscription_status = 'active';
          user.subscription_expires_at = expiresAt;
          user.job_post_credits = planConfig.credits;
        }
        writeUsers(users);
      }
    }

    return res.json({
      success: true,
      subscription: isAi ? {
        ai_tier: tx.plan,
        ai_status: 'active',
        ai_expires_at: expiresAt,
      } : isService ? {
        provider_tier: tx.plan,
        provider_status: 'active',
        provider_expires_at: expiresAt,
      } : {
        tier: tx.plan,
        status: 'active',
        expires_at: expiresAt,
        credits: planConfig.credits,
      },
    });
  } catch (err) {
    console.error('pay verify error', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// Get current user subscription info
app.get('/user/subscription', authenticate, (req, res) => {
  try {
    let sub = { tier: null, status: 'inactive', expires_at: null, credits: 0 };

    if (db && db.available) {
      const row = db.getUserSubscription(req.user.id);
      if (row) {
        sub = {
          tier: row.subscription_tier,
          status: row.subscription_status,
          expires_at: row.subscription_expires_at,
          credits: row.job_post_credits || 0,
        };
      }
    } else {
      const users = readUsers();
      const user = users.find(u => u.id === req.user.id);
      if (user) {
        sub = {
          tier: user.subscription_tier || null,
          status: user.subscription_status || 'inactive',
          expires_at: user.subscription_expires_at || null,
          credits: user.job_post_credits || 0,
        };
      }
    }

    // Check if expired
    if (sub.status === 'active' && sub.expires_at && new Date(sub.expires_at) < new Date()) {
      sub.status = 'expired';
      sub.credits = 0;
    }

    return res.json({ success: true, subscription: sub });
  } catch (err) {
    console.error('subscription error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Get current user AI subscription info
app.get('/user/ai-subscription', authenticate, (req, res) => {
  try {
    let sub = { ai_tier: null, ai_status: 'inactive', ai_expires_at: null };

    if (db && db.available) {
      const row = db.getUserAiSubscription(req.user.id);
      if (row) {
        sub = {
          ai_tier: row.ai_subscription_tier,
          ai_status: row.ai_subscription_status,
          ai_expires_at: row.ai_subscription_expires_at,
        };
      }
    } else {
      const users = readUsers();
      const user = users.find(u => u.id === req.user.id);
      if (user) {
        sub = {
          ai_tier: user.ai_subscription_tier || null,
          ai_status: user.ai_subscription_status || 'inactive',
          ai_expires_at: user.ai_subscription_expires_at || null,
        };
      }
    }

    // Check if expired
    if (sub.ai_status === 'active' && sub.ai_expires_at && new Date(sub.ai_expires_at) < new Date()) {
      sub.ai_status = 'expired';
    }

    return res.json({ success: true, ai_subscription: sub });
  } catch (err) {
    console.error('ai subscription error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ===== EMPLOYEE ACTIVITIES =====
const ACTIVITIES_PATH = path.join(__dirname, 'activities.json');

function readActivities() {
  try {
    if (fs.existsSync(ACTIVITIES_PATH)) {
      return JSON.parse(fs.readFileSync(ACTIVITIES_PATH, 'utf-8') || '[]');
    }
  } catch (e) { /* ignore */ }
  return [];
}

function writeActivities(items) {
  fs.writeFileSync(ACTIVITIES_PATH, JSON.stringify(items, null, 2));
}

// Seed activities from the Excel data if file doesn't exist
(function seedActivities() {
  if (fs.existsSync(ACTIVITIES_PATH)) return;
  const status = 'approved';
  const seed = [
    {
      id: 'act-001', employeeName: 'Samuel Owoyemi', department: 'Office Automation',
      date: '2026-06-17', weekLabel: 'JUNE 15th - JUNE 19th',
      entryType: 'teaching', category: 'Data Science', status,
      summary: 'Regression Techniques for Learning Using Python',
      details: 'Taught linear and nonlinear regression models, focusing on their application and evaluation. Students practiced building models using Python libraries.',
      createdAt: '2026-06-17T10:00:00Z', userId: 'seed-001',
    },
    {
      id: 'act-002', employeeName: 'Samuel Owoyemi', department: 'Office Automation',
      date: '2026-06-17', weekLabel: 'JUNE 15th - JUNE 19th',
      entryType: 'admin', category: 'Records', status,
      summary: 'Updated defaulters sheet with Naomi',
      details: 'Worked with Naomi in updating the defaulters\u2019 sheet to ensure accurate records of outstanding payments and proper follow-up.',
      createdAt: '2026-06-17T12:00:00Z', userId: 'seed-001',
    },
    {
      id: 'act-003', employeeName: 'Samuel Owoyemi', department: 'Office Automation',
      date: '2026-06-18', weekLabel: 'JUNE 15th - JUNE 19th',
      entryType: 'teaching', category: 'Programming', status,
      summary: 'Application in Python',
      details: 'Introduced students to building a simple Python-based application, demonstrating how programming concepts integrate with real-world functionality.',
      createdAt: '2026-06-18T10:00:00Z', userId: 'seed-001',
    },
    {
      id: 'act-004', employeeName: 'Samuel Owoyemi', department: 'Office Automation',
      date: '2026-06-18', weekLabel: 'JUNE 15th - JUNE 19th',
      entryType: 'support', category: 'Student Engagement', status,
      summary: 'Reached out to absent students via WhatsApp',
      details: 'Reached out to absent students to encourage attendance and updated all daily records.',
      createdAt: '2026-06-18T14:00:00Z', userId: 'seed-001',
    },
    {
      id: 'act-005', employeeName: 'Samuel Owoyemi', department: 'Office Automation',
      date: '2026-06-19', weekLabel: 'JUNE 15th - JUNE 19th',
      entryType: 'teaching', category: 'Data Science', status,
      summary: 'Practical revision on GUI Programming in Tkinter Using Python',
      details: 'Carried out a practical revision on GUI Programming in Tkinter Using Python. The session revisited interface design principles and event handling.',
      createdAt: '2026-06-19T10:00:00Z', userId: 'seed-001',
    },
    {
      id: 'act-006', employeeName: 'Bisi Adeyemi', department: 'Sales/Marketing/Counsellor',
      date: '2026-06-17', weekLabel: 'JUNE 15th - JUNE 19th',
      entryType: 'sales', category: 'Conversion', status,
      summary: 'Walk-in prospect counselling and enrolment',
      details: 'Attended to one walk-in prospect who came in for IT placement. Initially interested in ADSE but after detailed discussion and counseling, agreed ADSE would not be suitable. Decided to begin with CPISM. Made a 50% payment.',
      createdAt: '2026-06-17T15:00:00Z', userId: 'seed-002',
    },
    {
      id: 'act-007', employeeName: 'Bisi Adeyemi', department: 'Sales/Marketing/Counsellor',
      date: '2026-06-18', weekLabel: 'JUNE 15th - JUNE 19th',
      entryType: 'collections', category: 'Records', status,
      summary: 'Defaulters document update and online enquiries',
      details: 'Worked with Bisi on updating and organizing the defaulters\u2019 Excel document to ensure records remained accurate and up to date. Supported the Ring Road centre with online enquiries.',
      createdAt: '2026-06-18T11:00:00Z', userId: 'seed-002',
    },
    {
      id: 'act-008', employeeName: 'Tolu Ogunlesi', department: 'Sales/Marketing/Counsellor',
      date: '2026-06-19', weekLabel: 'JUNE 15th - JUNE 19th',
      entryType: 'marketing', category: 'Promotions', status,
      summary: 'Online enquiries, walk-in prospect, rally preparation',
      details: 'Attended to online enquiries and phone calls at Agodi. Visited the Ring Road branch, attended to a walk-in prospect, and worked on promotional content. Contributed to rally planning.',
      createdAt: '2026-06-19T16:00:00Z', userId: 'seed-003',
    },
  ];
  writeActivities(seed);
  console.log('Seeded ' + seed.length + ' employee activities');
})();

// GET /api/activities — list activities (admin only, or authenticated)
app.get('/api/activities', authenticate, (req, res) => {
  try {
    let activities = readActivities();
    const { department, employee, entryType, weekLabel, startDate, endDate, category } = req.query;

    if (department) activities = activities.filter(a => a.department.toLowerCase().includes(department.toLowerCase()));
    if (employee) activities = activities.filter(a => a.employeeName.toLowerCase().includes(employee.toLowerCase()));
    if (entryType) activities = activities.filter(a => a.entryType === entryType);
    if (weekLabel) activities = activities.filter(a => a.weekLabel === weekLabel);
    if (category) activities = activities.filter(a => a.category && a.category.toLowerCase().includes(category.toLowerCase()));
    if (startDate) activities = activities.filter(a => a.date >= startDate);
    if (endDate) activities = activities.filter(a => a.date <= endDate);
    if (req.query.status) activities = activities.filter(a => a.status === req.query.status);

    activities.sort(function(a, b) { return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt); });

    return res.json({ success: true, activities });
  } catch (err) {
    console.error('activities list error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/activities/stats — aggregated stats for admin
app.get('/api/activities/stats', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    const activities = readActivities();
    const stats = {
      total: activities.length,
      byDepartment: {},
      byType: {},
      byWeek: {},
      byEmployee: {},
      recentWeeks: [],
    };
    activities.forEach(function(a) {
      stats.byDepartment[a.department] = (stats.byDepartment[a.department] || 0) + 1;
      stats.byType[a.entryType] = (stats.byType[a.entryType] || 0) + 1;
      stats.byWeek[a.weekLabel] = (stats.byWeek[a.weekLabel] || 0) + 1;
      stats.byEmployee[a.employeeName] = (stats.byEmployee[a.employeeName] || 0) + 1;
    });
    var weeks = Object.keys(stats.byWeek).sort();
    stats.recentWeeks = weeks.slice(-5);
    return res.json({ success: true, stats });
  } catch (err) {
    console.error('activities stats error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/activities — create a new activity (status: pending by default)
app.post('/api/activities', authenticate, (req, res) => {
  try {
    const { employeeName, department, date, weekLabel, entryType, category, summary, details } = req.body;
    if (!employeeName || !department || !summary) {
      return res.status(400).json({ error: 'employeeName, department, and summary are required' });
    }
    const activities = readActivities();
    const activity = {
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      employeeName,
      department,
      date: date || new Date().toISOString().split('T')[0],
      weekLabel: weekLabel || '',
      entryType: entryType || 'other',
      category: category || '',
      summary,
      details: details || '',
      status: 'pending',
      userId: req.user.id,
      createdAt: new Date().toISOString(),
    };
    activities.unshift(activity);
    writeActivities(activities);
    return res.status(201).json({ success: true, activity });
  } catch (err) {
    console.error('activities create error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// PUT /api/activities/:id/approve — approve a pending activity (admin only)
app.put('/api/activities/:id/approve', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    const activities = readActivities();
    const idx = activities.findIndex(function(a) { return a.id === req.params.id; });
    if (idx === -1) return res.status(404).json({ error: 'Activity not found' });
    activities[idx].status = 'approved';
    activities[idx].approvedAt = new Date().toISOString();
    activities[idx].approvedBy = req.user.id;
    writeActivities(activities);
    return res.json({ success: true, activity: activities[idx] });
  } catch (err) {
    console.error('activities approve error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// PUT /api/activities/:id/reject — reject a pending activity (admin only)
app.put('/api/activities/:id/reject', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    const activities = readActivities();
    const idx = activities.findIndex(function(a) { return a.id === req.params.id; });
    if (idx === -1) return res.status(404).json({ error: 'Activity not found' });
    activities[idx].status = 'rejected';
    activities[idx].rejectedAt = new Date().toISOString();
    activities[idx].rejectedBy = req.user.id;
    activities[idx].rejectionReason = req.body.reason || '';
    writeActivities(activities);
    return res.json({ success: true, activity: activities[idx] });
  } catch (err) {
    console.error('activities reject error', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

const port = process.env.PORT || 5050;
app.listen(port, () => {
  console.log('JobBridge server running on http://localhost:' + port);
});

// SPA fallback: serve index.html for browser navigation (client-side routing)
// MUST be registered LAST so it doesn't intercept API routes
const distIndex = path.join(distPath, 'index.html');
if (fs.existsSync(distIndex)) {
  app.get('*', (req, res) => {
    const accept = req.headers.accept || '';
    if (accept.includes('text/html')) {
      return res.sendFile(distIndex);
    }
    res.status(404).json({ error: 'Not found' });
  });
}
