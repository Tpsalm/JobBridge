const path = require('path');
const fs = require('fs');
let available = false;
let db = null;

try {
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, 'jobbridge.sqlite');
  db = new Database(dbPath);
  available = true;

  // Initialize tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      role TEXT,
      company TEXT,
      phone TEXT,
      subscription_tier TEXT,
      subscription_status TEXT DEFAULT 'inactive',
      subscription_expires_at TEXT,
      job_post_credits INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY NOT NULL,
      recruiter_id TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      description TEXT,
      location TEXT,
      type TEXT,
      salary_range TEXT,
      is_featured INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      rejection_reason TEXT,
      expires_at TEXT,
      views INTEGER DEFAULT 0,
      applications_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      benefits TEXT,
      category TEXT,
      company_logo TEXT
    );
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY NOT NULL,
      job_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      date_of_birth TEXT,
      gender TEXT,
      is_disabled INTEGER DEFAULT 0,
      is_displaced INTEGER DEFAULT 0,
      professional_headline TEXT NOT NULL,
      years_of_experience TEXT NOT NULL,
      function TEXT NOT NULL,
      work_type TEXT NOT NULL,
      highest_qualification TEXT NOT NULL,
      location TEXT NOT NULL,
      availability TEXT NOT NULL,
      salary_expectation INTEGER NOT NULL,
      cv_path TEXT,
      cv_original_name TEXT,
      cover_letter TEXT,
      status TEXT DEFAULT 'pending',
      recruiter_notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      reference TEXT UNIQUE NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'NGN',
      status TEXT DEFAULT 'pending',
      plan TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      verified_at TEXT
    );
    CREATE TABLE IF NOT EXISTS otps (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      email TEXT,
      phone TEXT,
      code TEXT,
      channel TEXT,
      expires_at TEXT,
      used INTEGER
    );
  `);

  // Prepared statements
  const insertUser = db.prepare(`INSERT OR REPLACE INTO users (id,email,password_hash,full_name,role,company,phone,subscription_tier,subscription_status,subscription_expires_at,job_post_credits,ai_subscription_tier,ai_subscription_status,ai_subscription_expires_at,provider_subscription_tier,provider_subscription_status,provider_subscription_expires_at,created_at) VALUES (@id,@email,@password_hash,@full_name,@role,@company,@phone,@subscription_tier,@subscription_status,@subscription_expires_at,@job_post_credits,@ai_subscription_tier,@ai_subscription_status,@ai_subscription_expires_at,@provider_subscription_tier,@provider_subscription_status,@provider_subscription_expires_at,@created_at)`);
  const getAllUsersStmt = db.prepare('SELECT * FROM users');
  const getUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const getUserByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const updateSubscriptionStmt = db.prepare('UPDATE users SET subscription_tier = @tier, subscription_status = @status, subscription_expires_at = @expires_at, job_post_credits = @credits WHERE id = @user_id');
  const decrementCreditsStmt = db.prepare('UPDATE users SET job_post_credits = job_post_credits - 1 WHERE id = ? AND job_post_credits > 0');
  const getUserSubscriptionStmt = db.prepare('SELECT subscription_tier, subscription_status, subscription_expires_at, job_post_credits FROM users WHERE id = ?');
  const updateAiSubscriptionStmt = db.prepare('UPDATE users SET ai_subscription_tier = @tier, ai_subscription_status = @status, ai_subscription_expires_at = @expires_at WHERE id = @user_id');
  const getUserAiSubscriptionStmt = db.prepare('SELECT ai_subscription_tier, ai_subscription_status, ai_subscription_expires_at FROM users WHERE id = ?');
  const updateProviderSubscriptionStmt = db.prepare('UPDATE users SET provider_subscription_tier = @tier, provider_subscription_status = @status, provider_subscription_expires_at = @expires_at WHERE id = @user_id');

  // Add new columns if they don't exist (for existing DBs)
  try { db.exec(`ALTER TABLE users ADD COLUMN subscription_tier TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'inactive'`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN subscription_expires_at TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN job_post_credits INTEGER DEFAULT 0`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN ai_subscription_tier TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN ai_subscription_status TEXT DEFAULT 'inactive'`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN ai_subscription_expires_at TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN provider_subscription_tier TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN provider_subscription_status TEXT DEFAULT 'inactive'`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN provider_subscription_expires_at TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN notes TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE users ADD COLUMN provider_status TEXT DEFAULT 'pending'`); } catch(e) {}
  try { db.exec(`ALTER TABLE jobs ADD COLUMN benefits TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE jobs ADD COLUMN category TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE jobs ADD COLUMN company_logo TEXT`); } catch(e) {}

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
  const getPlanDistributionStmt = db.prepare('SELECT plan, COUNT(*) as count FROM transactions WHERE status = ? GROUP BY plan');
  const getActiveSubscribersCountStmt = db.prepare("SELECT COUNT(*) as count FROM users WHERE subscription_status = 'active'");
  const getActiveAiSubscribersCountStmt = db.prepare("SELECT COUNT(*) as count FROM users WHERE ai_subscription_status = 'active'");
  const getCategoryDistributionStmt = db.prepare('SELECT category, COUNT(*) as count FROM jobs WHERE category IS NOT NULL GROUP BY category');
  const getApplicationsByStatusCountStmt = db.prepare('SELECT status, COUNT(*) as count FROM applications GROUP BY status');
  const getProvidersStmt = db.prepare("SELECT * FROM users WHERE role = 'provider' ORDER BY created_at DESC");
  const updateUserStatusStmt = db.prepare('UPDATE users SET status = @status WHERE id = @id');
  const updateUserStmt = db.prepare('UPDATE users SET role = @role, status = @status, notes = @notes, company = @company, full_name = @full_name, phone = @phone WHERE id = @id');
  const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');

  module.exports = {
    available: true,
    getAllUsers: () => getAllUsersStmt.all(),
    getUserById: (id) => getUserByIdStmt.get(id),
    getUserByEmail: (email) => getUserByEmailStmt.get(email),
    upsertUser: (u) => {
      // ensure all named params are present with defaults
      const safe = {
        ...u,
        subscription_tier: u.subscription_tier ?? null,
        subscription_status: u.subscription_status ?? 'inactive',
        subscription_expires_at: u.subscription_expires_at ?? null,
        job_post_credits: u.job_post_credits ?? 0,
        ai_subscription_tier: u.ai_subscription_tier ?? null,
        ai_subscription_status: u.ai_subscription_status ?? 'inactive',
        ai_subscription_expires_at: u.ai_subscription_expires_at ?? null,
        provider_subscription_tier: u.provider_subscription_tier ?? null,
        provider_subscription_status: u.provider_subscription_status ?? 'inactive',
        provider_subscription_expires_at: u.provider_subscription_expires_at ?? null,
      };
      insertUser.run(safe);
    },
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
    migrateFromJson: (paths) => {
      try {
        if (paths.usersPath && fs.existsSync(paths.usersPath)) {
          const raw = fs.readFileSync(paths.usersPath, 'utf-8');
          const users = JSON.parse(raw || '[]');
          const insert = db.transaction((arr) => {
            for (const u of arr) {
              insertUser.run({
                id: u.id,
                email: u.email,
                password_hash: u.password_hash || '',
                full_name: u.full_name || null,
                role: u.role || 'job_seeker',
                company: u.company || null,
                phone: u.phone || null,
                subscription_tier: u.subscription_tier || null,
                subscription_status: u.subscription_status || 'inactive',
                subscription_expires_at: u.subscription_expires_at || null,
                job_post_credits: u.job_post_credits || 0,
                created_at: u.created_at || new Date().toISOString()
              });
            }
          });
          insert(users);
        }
        if (paths.jobsPath && fs.existsSync(paths.jobsPath)) {
          const raw = fs.readFileSync(paths.jobsPath, 'utf-8');
          const jobs = JSON.parse(raw || '[]');
          const insert = db.transaction((arr) => {
            for (const j of arr) {
              insertJob.run({
                id: j.id,
                recruiter_id: j.recruiter_id,
                title: j.title,
                company: j.company,
                description: j.description || '',
                location: j.location || 'Remote',
                type: j.type || 'Full-time',
                salary_range: j.salary_range || null,
                is_featured: j.is_featured ? 1 : 0,
                is_active: j.is_active !== undefined ? (j.is_active ? 1 : 0) : 1,
                status: j.status || 'approved',
                rejection_reason: j.rejection_reason || null,
                expires_at: j.expires_at || null,
                views: j.views || 0,
                applications_count: j.applications_count || 0,
                created_at: j.created_at || new Date().toISOString(),
                updated_at: j.updated_at || new Date().toISOString(),
                benefits: j.benefits || null,
                category: j.category || null,
                company_logo: j.company_logo || null
              });
            }
          });
          insert(jobs);
        }
      } catch (e) {
        console.error('DB migration error', e);
      }
    }
  };
} catch (err) {
  console.warn('better-sqlite3 not available, falling back to JSON storage');
  module.exports = { available: false };
}
