const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const MONGODB_URI = process.env.MONGODB_URI;
let available = false;
let db = null;
let mongoModels = null;
let cache = { users: [], jobs: [], applications: [], transactions: [], otps: [] };

// --- Mongoose Schemas ---
function defineModels() {
  const UserSchema = new mongoose.Schema({
    _id: String, email: { type: String, unique: true }, password_hash: String,
    full_name: String, role: { type: String, default: 'job_seeker' }, company: String,
    phone: String, subscription_tier: String, subscription_status: { type: String, default: 'inactive' },
    subscription_expires_at: String, job_post_credits: { type: Number, default: 0 },
    ai_subscription_tier: String, ai_subscription_status: { type: String, default: 'inactive' },
    ai_subscription_expires_at: String, provider_subscription_tier: String,
    provider_subscription_status: { type: String, default: 'inactive' },
    provider_subscription_expires_at: String, status: { type: String, default: 'active' },
    notes: String, provider_status: { type: String, default: 'pending' },
    created_at: { type: String, required: true },
  }, { _id: false });

  const JobSchema = new mongoose.Schema({
    _id: String, recruiter_id: String, title: String, company: String,
    description: String, location: String, type: String, salary_range: String,
    is_featured: Boolean, is_active: { type: Boolean, default: true },
    status: { type: String, default: 'pending' }, rejection_reason: String, expires_at: String,
    views: { type: Number, default: 0 }, applications_count: { type: Number, default: 0 },
    created_at: String, updated_at: String, benefits: String, category: String, company_logo: String,
  }, { _id: false });

  const ApplicationSchema = new mongoose.Schema({
    _id: String, job_id: String, user_id: String, date_of_birth: String, gender: String,
    is_disabled: Boolean, is_displaced: Boolean, professional_headline: String,
    years_of_experience: String, function: String, work_type: String,
    highest_qualification: String, location: String, availability: String,
    salary_expectation: Number, cv_path: String, cv_original_name: String,
    cover_letter: String, status: { type: String, default: 'pending' },
    recruiter_notes: String, created_at: String,
  }, { _id: false });

  const TransactionSchema = new mongoose.Schema({
    _id: String, user_id: String, reference: { type: String, unique: true },
    amount: Number, currency: { type: String, default: 'NGN' }, status: { type: String, default: 'pending' },
    plan: String, metadata: String, created_at: String, verified_at: String,
  }, { _id: false });

  const OtpSchema = new mongoose.Schema({
    _id: String, user_id: String, email: String, phone: String, code: String,
    channel: String, expires_at: String, used: Boolean,
  }, { _id: false });

  return {
    User: mongoose.model('User', UserSchema),
    Job: mongoose.model('Job', JobSchema),
    Application: mongoose.model('Application', ApplicationSchema),
    Transaction: mongoose.model('Transaction', TransactionSchema),
    Otp: mongoose.model('Otp', OtpSchema),
  };
}

function stamp(obj) { return obj ? { ...obj, id: obj._id || obj.id } : obj; }

async function loadCache() {
  if (!mongoModels) return;
  cache.users = (await mongoModels.User.find().lean()).map(stamp);
  cache.jobs = (await mongoModels.Job.find().sort({ created_at: -1 }).lean()).map(stamp);
  cache.applications = (await mongoModels.Application.find().sort({ created_at: -1 }).lean()).map(stamp);
  cache.transactions = (await mongoModels.Transaction.find().sort({ created_at: -1 }).lean()).map(stamp);
  cache.otps = (await mongoModels.Otp.find().lean()).map(stamp);
}

async function connectMongo() {
  await mongoose.connect(MONGODB_URI);
  mongoModels = defineModels();
  await loadCache();
  available = true;
  console.log('MongoDB connected, cache loaded');
}

// Schedule cache refresh every 30 seconds
let refreshTimer = null;
function startCacheRefresh() {
  refreshTimer = setInterval(loadCache, 30000);
}
function stopCacheRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
}

// --- MongoDB cache-based implementations ---
const mongoImpl = {
  getAllUsers: () => [...cache.users],
  getUserById: (id) => cache.users.find(u => u.id === id) || null,
  getUserByEmail: (email) => cache.users.find(u => u.email === email) || null,
  upsertUser: async (u) => {
    await mongoModels.User.findByIdAndUpdate(u.id, { ...u, _id: u.id }, { upsert: true });
    const idx = cache.users.findIndex(x => x.id === u.id);
    const stamped = stamp(u);
    if (idx >= 0) cache.users[idx] = stamped; else cache.users.push(stamped);
    return stamped;
  },
  updateSubscription: async (data) => {
    await mongoModels.User.findByIdAndUpdate(data.user_id, { subscription_tier: data.tier, subscription_status: data.status, subscription_expires_at: data.expires_at, job_post_credits: data.credits });
    const u = cache.users.find(x => x.id === data.user_id);
    if (u) { u.subscription_tier = data.tier; u.subscription_status = data.status; u.subscription_expires_at = data.expires_at; u.job_post_credits = data.credits; }
  },
  decrementCredits: async (userId) => {
    await mongoModels.User.findByIdAndUpdate(userId, { $inc: { job_post_credits: -1 } });
    const u = cache.users.find(x => x.id === userId);
    if (u && u.job_post_credits > 0) u.job_post_credits--;
  },
  getUserSubscription: (id) => {
    const u = cache.users.find(x => x.id === id);
    return u ? { subscription_tier: u.subscription_tier, subscription_status: u.subscription_status, subscription_expires_at: u.subscription_expires_at, job_post_credits: u.job_post_credits } : null;
  },
  updateAiSubscription: async (data) => {
    await mongoModels.User.findByIdAndUpdate(data.user_id, { ai_subscription_tier: data.tier, ai_subscription_status: data.status, ai_subscription_expires_at: data.expires_at });
    const u = cache.users.find(x => x.id === data.user_id);
    if (u) { u.ai_subscription_tier = data.tier; u.ai_subscription_status = data.status; u.ai_subscription_expires_at = data.expires_at; }
  },
  getUserAiSubscription: (id) => {
    const u = cache.users.find(x => x.id === id);
    return u ? { ai_subscription_tier: u.ai_subscription_tier, ai_subscription_status: u.ai_subscription_status, ai_subscription_expires_at: u.ai_subscription_expires_at } : null;
  },
  updateProviderSubscription: async (data) => {
    await mongoModels.User.findByIdAndUpdate(data.user_id, { provider_subscription_tier: data.tier, provider_subscription_status: data.status, provider_subscription_expires_at: data.expires_at });
    const u = cache.users.find(x => x.id === data.user_id);
    if (u) { u.provider_subscription_tier = data.tier; u.provider_subscription_status = data.status; u.provider_subscription_expires_at = data.expires_at; }
  },
  getAllJobs: () => [...cache.jobs],
  getJobById: (id) => cache.jobs.find(j => j.id === id) || null,
  createJob: async (job) => {
    await mongoModels.Job.create({ ...job, _id: job.id });
    cache.jobs.unshift(stamp(job));
  },
  updateJob: async (job) => {
    await mongoModels.Job.findByIdAndUpdate(job.id, { ...job, _id: job.id }, { upsert: true });
    const idx = cache.jobs.findIndex(x => x.id === job.id);
    if (idx >= 0) cache.jobs[idx] = stamp(job); else cache.jobs.unshift(stamp(job));
  },
  deleteJob: async (id) => {
    await mongoModels.Job.findByIdAndDelete(id);
    cache.jobs = cache.jobs.filter(j => j.id !== id);
  },
  createOtp: async (o) => {
    await mongoModels.Otp.create({ ...o, _id: o.id });
    cache.otps.push(stamp(o));
  },
  findOtp: (email, phone, code) => {
    return cache.otps.filter(o => !o.used && o.code === code && (o.email === email || o.phone === phone)).sort((a,b) => new Date(b.expires_at) - new Date(a.expires_at))[0] || null;
  },
  markOtpUsed: async (id) => {
    await mongoModels.Otp.findByIdAndUpdate(id, { used: true });
    const o = cache.otps.find(x => x.id === id);
    if (o) o.used = true;
  },
  createTransaction: async (t) => {
    await mongoModels.Transaction.create({ ...t, _id: t.id });
    cache.transactions.unshift(stamp(t));
  },
  getTransactionByRef: (ref) => cache.transactions.find(t => t.reference === ref) || null,
  verifyTransaction: async (data) => {
    await mongoModels.Transaction.findOneAndUpdate({ reference: data.reference }, { status: data.status, verified_at: data.verified_at });
    const t = cache.transactions.find(x => x.reference === data.reference);
    if (t) { t.status = data.status; t.verified_at = data.verified_at; }
  },
  getTransactionsByUser: (id) => cache.transactions.filter(t => t.user_id === id),
  createApplication: async (a) => {
    await mongoModels.Application.create({ ...a, _id: a.id });
    cache.applications.unshift(stamp(a));
  },
  getApplicationsByJob: (jobId) => cache.applications.filter(a => a.job_id === jobId),
  getApplicationsByUser: (userId) => cache.applications.filter(a => a.user_id === userId),
  getApplicationById: (id) => cache.applications.find(a => a.id === id) || null,
  getApplicationsByRecruiter: (userId) => {
    const recruiterJobIds = cache.jobs.filter(j => j.recruiter_id === userId).map(j => j.id);
    return cache.applications.filter(a => recruiterJobIds.includes(a.job_id));
  },
  getAllApplications: () => [...cache.applications],
  updateApplicationStatus: async (data) => {
    await mongoModels.Application.findByIdAndUpdate(data.id, { status: data.status, recruiter_notes: data.notes });
    const a = cache.applications.find(x => x.id === data.id);
    if (a) { a.status = data.status; a.recruiter_notes = data.notes; }
  },
  countApplicationsByJob: (jobId) => cache.applications.filter(a => a.job_id === jobId).length,
  getAllTransactions: () => [...cache.transactions],
  getUsersCount: () => cache.users.length,
  getApplicationsCount: () => cache.applications.length,
  getTransactionsTotal: (status) => cache.transactions.filter(t => t.status === (status || 'completed')).reduce((sum, t) => sum + (t.amount || 0), 0),
  getJobsCountByStatus: () => {
    const counts = {};
    cache.jobs.forEach(j => { counts[j.status || 'pending'] = (counts[j.status || 'pending'] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  },
  getUsersByRoleCount: () => {
    const counts = {};
    cache.users.forEach(u => { counts[u.role || 'job_seeker'] = (counts[u.role || 'job_seeker'] || 0) + 1; });
    return Object.entries(counts).map(([role, count]) => ({ role, count }));
  },
  getJobsByDateRange: (start, end) => {
    const counts = {};
    cache.jobs.filter(j => j.created_at >= start && j.created_at <= end).forEach(j => {
      const d = j.created_at.split('T')[0]; counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
  },
  getApplicationsByDateRange: (start, end) => {
    const counts = {};
    cache.applications.filter(a => a.created_at >= start && a.created_at <= end).forEach(a => {
      const d = a.created_at.split('T')[0]; counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
  },
  getRevenueByDateRange: (start, end) => {
    const totals = {};
    cache.transactions.filter(t => t.status === 'completed' && t.created_at >= start && t.created_at <= end).forEach(t => {
      const d = t.created_at.split('T')[0]; totals[d] = (totals[d] || 0) + (t.amount || 0);
    });
    return Object.entries(totals).sort((a,b) => a[0].localeCompare(b[0])).map(([date, total]) => ({ date, total }));
  },
  getPlanDistribution: (status) => {
    const counts = {};
    cache.transactions.filter(t => t.status === (status || 'completed')).forEach(t => {
      counts[t.plan || 'unknown'] = (counts[t.plan || 'unknown'] || 0) + 1;
    });
    return Object.entries(counts).map(([plan, count]) => ({ plan, count }));
  },
  getActiveSubscribersCount: () => cache.users.filter(u => u.subscription_status === 'active').length,
  getActiveAiSubscribersCount: () => cache.users.filter(u => u.ai_subscription_status === 'active').length,
  getCategoryDistribution: () => {
    const counts = {};
    cache.jobs.filter(j => j.category).forEach(j => { counts[j.category] = (counts[j.category] || 0) + 1; });
    return Object.entries(counts).map(([category, count]) => ({ category, count }));
  },
  getApplicationsByStatusCount: () => {
    const counts = {};
    cache.applications.forEach(a => { counts[a.status || 'pending'] = (counts[a.status || 'pending'] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  },
  getProviders: () => cache.users.filter(u => u.role === 'provider'),
  updateUserStatus: async (data) => {
    await mongoModels.User.findByIdAndUpdate(data.id, { status: data.status });
    const u = cache.users.find(x => x.id === data.id);
    if (u) u.status = data.status;
  },
  updateUser: async (data) => {
    await mongoModels.User.findByIdAndUpdate(data.id, { role: data.role, status: data.status, notes: data.notes, company: data.company, full_name: data.full_name, phone: data.phone });
    const u = cache.users.find(x => x.id === data.id);
    if (u) { u.role = data.role; u.status = data.status; u.notes = data.notes; u.company = data.company; u.full_name = data.full_name; u.phone = data.phone; }
  },
  deleteUser: async (id) => {
    await mongoModels.User.findByIdAndDelete(id);
    cache.users = cache.users.filter(u => u.id !== id);
  },
  migrateFromJson: async (paths) => {
    if (paths.usersPath && fs.existsSync(paths.usersPath)) {
      const raw = fs.readFileSync(paths.usersPath, 'utf-8');
      const users = JSON.parse(raw || '[]');
      for (const u of users) {
        await mongoModels.User.findByIdAndUpdate(u.id, { ...u, _id: u.id, password_hash: u.password_hash || '' }, { upsert: true });
      }
    }
    if (paths.jobsPath && fs.existsSync(paths.jobsPath)) {
      const raw = fs.readFileSync(paths.jobsPath, 'utf-8');
      const jobs = JSON.parse(raw || '[]');
      for (const j of jobs) {
        await mongoModels.Job.findByIdAndUpdate(j.id, { ...j, _id: j.id }, { upsert: true });
      }
    }
    await loadCache();
  },
};

// --- SQLite implementations (original, unchanged) ---
function initSqlite() {
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, 'jobbridge.sqlite');
  db = new Database(dbPath);
  available = true;

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,full_name TEXT,role TEXT,company TEXT,phone TEXT,subscription_tier TEXT,subscription_status TEXT DEFAULT 'inactive',subscription_expires_at TEXT,job_post_credits INTEGER DEFAULT 0,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY NOT NULL,recruiter_id TEXT NOT NULL,title TEXT NOT NULL,company TEXT NOT NULL,description TEXT,location TEXT,type TEXT,salary_range TEXT,is_featured INTEGER DEFAULT 0,is_active INTEGER DEFAULT 1,status TEXT DEFAULT 'pending',rejection_reason TEXT,expires_at TEXT,views INTEGER DEFAULT 0,applications_count INTEGER DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,benefits TEXT,category TEXT,company_logo TEXT);
    CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY NOT NULL,job_id TEXT NOT NULL,user_id TEXT NOT NULL,date_of_birth TEXT,gender TEXT,is_disabled INTEGER DEFAULT 0,is_displaced INTEGER DEFAULT 0,professional_headline TEXT NOT NULL,years_of_experience TEXT NOT NULL,function TEXT NOT NULL,work_type TEXT NOT NULL,highest_qualification TEXT NOT NULL,location TEXT NOT NULL,availability TEXT NOT NULL,salary_expectation INTEGER NOT NULL,cv_path TEXT,cv_original_name TEXT,cover_letter TEXT,status TEXT DEFAULT 'pending',recruiter_notes TEXT,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL,reference TEXT UNIQUE NOT NULL,amount INTEGER NOT NULL,currency TEXT DEFAULT 'NGN',status TEXT DEFAULT 'pending',plan TEXT,metadata TEXT,created_at TEXT NOT NULL,verified_at TEXT);
    CREATE TABLE IF NOT EXISTS otps (id TEXT PRIMARY KEY,user_id TEXT,email TEXT,phone TEXT,code TEXT,channel TEXT,expires_at TEXT,used INTEGER);
  `);

  const cols = ['subscription_tier','subscription_status','subscription_expires_at','job_post_credits','ai_subscription_tier','ai_subscription_status','ai_subscription_expires_at','provider_subscription_tier','provider_subscription_status','provider_subscription_expires_at','status','notes','provider_status','benefits','category','company_logo'];
  cols.forEach(c => { try { db.exec(`ALTER TABLE users ADD COLUMN ${c} TEXT`); } catch(e) {} });
  try { db.exec(`ALTER TABLE jobs ADD COLUMN benefits TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE jobs ADD COLUMN category TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE jobs ADD COLUMN company_logo TEXT`); } catch(e) {}

  const insertUser = db.prepare(`INSERT OR REPLACE INTO users (id,email,password_hash,full_name,role,company,phone,subscription_tier,subscription_status,subscription_expires_at,job_post_credits,created_at) VALUES (@id,@email,@password_hash,@full_name,@role,@company,@phone,@subscription_tier,@subscription_status,@subscription_expires_at,@job_post_credits,@created_at)`);
  const getAllUsersStmt = db.prepare('SELECT * FROM users');
  const getUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const getUserByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const updateSubscriptionStmt = db.prepare('UPDATE users SET subscription_tier = @tier, subscription_status = @status, subscription_expires_at = @expires_at, job_post_credits = @credits WHERE id = @user_id');
  const decrementCreditsStmt = db.prepare('UPDATE users SET job_post_credits = job_post_credits - 1 WHERE id = ? AND job_post_credits > 0');
  const getUserSubscriptionStmt = db.prepare('SELECT subscription_tier, subscription_status, subscription_expires_at, job_post_credits FROM users WHERE id = ?');
  const updateAiSubscriptionStmt = db.prepare('UPDATE users SET ai_subscription_tier = @tier, ai_subscription_status = @status, ai_subscription_expires_at = @expires_at WHERE id = @user_id');
  const getUserAiSubscriptionStmt = db.prepare('SELECT ai_subscription_tier, ai_subscription_status, ai_subscription_expires_at FROM users WHERE id = ?');
  const updateProviderSubscriptionStmt = db.prepare('UPDATE users SET provider_subscription_tier = @tier, provider_subscription_status = @status, provider_subscription_expires_at = @expires_at WHERE id = @user_id');
  const insertJob = db.prepare(`INSERT OR REPLACE INTO jobs (id,recruiter_id,title,company,description,location,type,salary_range,is_featured,is_active,status,rejection_reason,expires_at,views,applications_count,created_at,updated_at,benefits,category,company_logo) VALUES (@id,@recruiter_id,@title,@company,@description,@location,@type,@salary_range,@is_featured,@is_active,@status,@rejection_reason,@expires_at,@views,@applications_count,@created_at,@updated_at,@benefits,@category,@company_logo)`);
  const getAllJobsStmt = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC');
  const getJobByIdStmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
  const deleteJobStmt = db.prepare('DELETE FROM jobs WHERE id = ?');
  const insertOtp = db.prepare(`INSERT OR REPLACE INTO otps (id,user_id,email,phone,code,channel,expires_at,used) VALUES (@id,@user_id,@email,@phone,@code,@channel,@expires_at,@used)`);
  const findOtpStmt = db.prepare('SELECT * FROM otps WHERE (email = ? OR phone = ?) AND code = ? AND used = 0 ORDER BY expires_at DESC LIMIT 1');
  const markOtpUsedStmt = db.prepare('UPDATE otps SET used = 1 WHERE id = ?');
  const insertTransactionStmt = db.prepare(`INSERT INTO transactions (id,user_id,reference,amount,currency,status,plan,metadata,created_at) VALUES (@id,@user_id,@reference,@amount,@currency,@status,@plan,@metadata,@created_at)`);
  const getTransactionByRefStmt = db.prepare('SELECT * FROM transactions WHERE reference = ?');
  const verifyTransactionStmt = db.prepare('UPDATE transactions SET status = @status, verified_at = @verified_at WHERE reference = @reference');
  const getTransactionsByUserStmt = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC');
  const insertApplicationStmt = db.prepare(`INSERT INTO applications (id,job_id,user_id,date_of_birth,gender,is_disabled,is_displaced,professional_headline,years_of_experience,function,work_type,highest_qualification,location,availability,salary_expectation,cv_path,cv_original_name,cover_letter,status,recruiter_notes,created_at) VALUES (@id,@job_id,@user_id,@date_of_birth,@gender,@is_disabled,@is_displaced,@professional_headline,@years_of_experience,@function,@work_type,@highest_qualification,@location,@availability,@salary_expectation,@cv_path,@cv_original_name,@cover_letter,@status,@recruiter_notes,@created_at)`);
  const getApplicationsByJobStmt = db.prepare('SELECT * FROM applications WHERE job_id = ? ORDER BY created_at DESC');
  const getApplicationsByUserStmt = db.prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC');
  const getApplicationByIdStmt = db.prepare('SELECT * FROM applications WHERE id = ?');
  const getApplicationsByRecruiterStmt = db.prepare('SELECT a.* FROM applications a JOIN jobs j ON a.job_id = j.id WHERE j.recruiter_id = ? ORDER BY a.created_at DESC');
  const getAllApplicationsStmt = db.prepare('SELECT * FROM applications ORDER BY created_at DESC');
  const updateApplicationStatusStmt = db.prepare('UPDATE applications SET status = @status, recruiter_notes = @notes WHERE id = @id');
  const countApplicationsByJobStmt = db.prepare('SELECT COUNT(*) as count FROM applications WHERE job_id = ?');
  const getAllTransactionsStmt = db.prepare('SELECT * FROM transactions ORDER BY created_at DESC');
  const getUsersCountStmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const getApplicationsCountStmt = db.prepare('SELECT COUNT(*) as count FROM applications');
  const getTransactionsTotalStmt = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = ?');
  const getJobsCountByStatusStmt = db.prepare('SELECT status, COUNT(*) as count FROM jobs GROUP BY status');
  const getUsersByRoleCountStmt = db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role');
  const getJobsByDateRangeStmt = db.prepare("SELECT DATE(created_at) as date, COUNT(*) as count FROM jobs WHERE created_at >= ? AND created_at <= ? GROUP BY DATE(created_at) ORDER BY date");
  const getApplicationsByDateRangeStmt = db.prepare("SELECT DATE(created_at) as date, COUNT(*) as count FROM applications WHERE created_at >= ? AND created_at <= ? GROUP BY DATE(created_at) ORDER BY date");
  const getRevenueByDateRangeStmt = db.prepare("SELECT DATE(created_at) as date, SUM(amount) as total FROM transactions WHERE status = 'completed' AND created_at >= ? AND created_at <= ? GROUP BY DATE(created_at) ORDER BY date");
  const getPlanDistributionStmt = db.prepare("SELECT plan, COUNT(*) as count FROM transactions WHERE status = ? GROUP BY plan");
  const getActiveSubscribersCountStmt = db.prepare("SELECT COUNT(*) as count FROM users WHERE subscription_status = 'active'");
  const getActiveAiSubscribersCountStmt = db.prepare("SELECT COUNT(*) as count FROM users WHERE ai_subscription_status = 'active'");
  const getCategoryDistributionStmt = db.prepare('SELECT category, COUNT(*) as count FROM jobs WHERE category IS NOT NULL GROUP BY category');
  const getApplicationsByStatusCountStmt = db.prepare('SELECT status, COUNT(*) as count FROM applications GROUP BY status');
  const getProvidersStmt = db.prepare("SELECT * FROM users WHERE role = 'provider' ORDER BY created_at DESC");
  const updateUserStatusStmt = db.prepare('UPDATE users SET status = @status WHERE id = @id');
  const updateUserStmt = db.prepare('UPDATE users SET role = @role, status = @status, notes = @notes, company = @company, full_name = @full_name, phone = @phone WHERE id = @id');
  const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');

  return {
    getAllUsers: () => getAllUsersStmt.all(),
    getUserById: (id) => getUserByIdStmt.get(id),
    getUserByEmail: (email) => getUserByEmailStmt.get(email),
    upsertUser: (u) => insertUser.run(u),
    updateSubscription: (data) => updateSubscriptionStmt.run(data),
    decrementCredits: (userId) => decrementCreditsStmt.run(userId),
    getUserSubscription: (id) => getUserSubscriptionStmt.get(id),
    updateAiSubscription: (data) => updateAiSubscriptionStmt.run(data),
    getUserAiSubscription: (id) => getUserAiSubscriptionStmt.get(id),
    updateProviderSubscription: (data) => updateProviderSubscriptionStmt.run(data),
    getAllJobs: () => getAllJobsStmt.all(),
    getJobById: (id) => getJobByIdStmt.get(id),
    createJob: (job) => insertJob.run(job),
    updateJob: (job) => insertJob.run(job),
    deleteJob: (id) => deleteJobStmt.run(id),
    createOtp: (o) => insertOtp.run(o),
    findOtp: (email, phone, code) => findOtpStmt.get(email || null, phone || null, code),
    markOtpUsed: (id) => markOtpUsedStmt.run(id),
    createTransaction: (t) => insertTransactionStmt.run(t),
    getTransactionByRef: (ref) => getTransactionByRefStmt.get(ref),
    verifyTransaction: (data) => verifyTransactionStmt.run(data),
    getTransactionsByUser: (id) => getTransactionsByUserStmt.all(id),
    createApplication: (a) => insertApplicationStmt.run(a),
    getApplicationsByJob: (jobId) => getApplicationsByJobStmt.all(jobId),
    getApplicationsByUser: (userId) => getApplicationsByUserStmt.all(userId),
    getApplicationById: (id) => getApplicationByIdStmt.get(id),
    getApplicationsByRecruiter: (userId) => getApplicationsByRecruiterStmt.all(userId),
    getAllApplications: () => getAllApplicationsStmt.all(),
    updateApplicationStatus: (data) => updateApplicationStatusStmt.run(data),
    countApplicationsByJob: (jobId) => { const r = countApplicationsByJobStmt.get(jobId); return r ? r.count : 0; },
    getAllTransactions: () => getAllTransactionsStmt.all(),
    getUsersCount: () => { const r = getUsersCountStmt.get(); return r ? r.count : 0; },
    getApplicationsCount: () => { const r = getApplicationsCountStmt.get(); return r ? r.count : 0; },
    getTransactionsTotal: (status) => { const r = getTransactionsTotalStmt.get(status || 'completed'); return r ? r.total : 0; },
    getJobsCountByStatus: () => getJobsCountByStatusStmt.all(),
    getUsersByRoleCount: () => getUsersByRoleCountStmt.all(),
    getJobsByDateRange: (start, end) => getJobsByDateRangeStmt.all(start, end),
    getApplicationsByDateRange: (start, end) => getApplicationsByDateRangeStmt.all(start, end),
    getRevenueByDateRange: (start, end) => getRevenueByDateRangeStmt.all(start, end),
    getPlanDistribution: (status) => getPlanDistributionStmt.all(status || 'completed'),
    getActiveSubscribersCount: () => { const r = getActiveSubscribersCountStmt.get(); return r ? r.count : 0; },
    getActiveAiSubscribersCount: () => { const r = getActiveAiSubscribersCountStmt.get(); return r ? r.count : 0; },
    getCategoryDistribution: () => getCategoryDistributionStmt.all(),
    getApplicationsByStatusCount: () => getApplicationsByStatusCountStmt.all(),
    getProviders: () => getProvidersStmt.all(),
    updateUserStatus: (data) => updateUserStatusStmt.run(data),
    updateUser: (data) => updateUserStmt.run(data),
    deleteUser: (id) => deleteUserStmt.run(id),
  };
}

// --- Init ---
async function init() {
  if (MONGODB_URI) {
    try {
      await connectMongo();
      // Migrate from SQLite if it exists
      const sqlitePath = path.join(__dirname, 'jobbridge.sqlite');
      if (fs.existsSync(sqlitePath)) {
        try {
          const Database = require('better-sqlite3');
          const sqlite = new Database(sqlitePath);
          const users = sqlite.prepare('SELECT * FROM users').all();
          const jobs = sqlite.prepare('SELECT * FROM jobs').all();
          sqlite.close();
          for (const u of users) {
            await mongoModels.User.findByIdAndUpdate(u.id, { ...u, _id: u.id, password_hash: u.password_hash || '' }, { upsert: true });
          }
          for (const j of jobs) {
            await mongoModels.Job.findByIdAndUpdate(j.id, { ...j, _id: j.id }, { upsert: true });
          }
          await loadCache();
          console.log(`Migrated ${users.length} users, ${jobs.length} jobs from SQLite to MongoDB`);
        } catch(e) { console.error('Migration note (non-fatal):', e.message); }
      }
      startCacheRefresh();
      module.exports = { available: true, ...mongoImpl };
      return;
    } catch(e) {
      console.error('MongoDB connection failed, falling back to SQLite:', e.message);
    }
  }
  // Fallback to SQLite
  try {
    const impl = initSqlite();
    Object.assign(module.exports, { available: true }, impl);
  } catch(err) {
    console.warn('better-sqlite3 not available, falling back to JSON storage');
    module.exports.available = false;
  }
}

module.exports = { available: false, init };
