// Comprehensive JobBridge knowledge base for the AI Assistant
// Every feature, flow, pricing plan, role, and page is documented here.
// The RAG engine uses this as its primary source of truth.

export interface KnowledgeSection {
  id: string;
  title: string;
  keywords: string[];
  content: string;
}

const KB: KnowledgeSection[] = [
  // ─── PLATFORM OVERVIEW ─────────────────────────────────────────────────
  {
    id: 'platform-overview',
    title: 'Platform Overview',
    keywords: ['what is jobbridge', 'about', 'platform overview', 'what does jobbridge do', 'jobbridge features'],
    content: `JobBridge is Nigeria's #1 professional network connecting job seekers, recruiters, and service providers. 
Key features: AI-powered job matching, verified employers, real-time talent search, AI resume builder, cover letter generator, recruiter dashboard with candidate scoring, service provider marketplace, business advertisements, and premium subscription plans. 
The platform serves three main user types: Job Seekers, Recruiters, and Service Providers.`,
  },
  {
    id: 'mission',
    title: 'Company Mission',
    keywords: ['mission', 'vision', 'about company', 'founder', 'victor eniola', 'ceo'],
    content: `JobBridge was founded in 2021 by Mr. Victor Eniola (CEO & Founder) with a mission to democratize career opportunities. 
The company is backed by Y Combinator, Sequoia Capital, and Andreessen Horowitz (a16z). 
Vision pillars: Democratizing Opportunity, AI-First Approach, and Global Impact. 
The platform has grown to serve millions of users across 50+ countries.`,
  },
  // ─── AUTHENTICATION ────────────────────────────────────────────────────
  {
    id: 'signup',
    title: 'Sign Up / Registration',
    keywords: ['sign up', 'register', 'create account', 'join', 'registration', 'new account', 'how to sign up'],
    content: `To create a JobBridge account: Go to /signup, choose your role (Job Seeker, Recruiter, or Service Provider), enter your full name, email, and password (minimum 6 characters), agree to the Terms of Service, and click Create Account. 
Supabase sends a confirmation email — click the link to verify your email. 
After verification, you can sign in and start using the platform. 
Admin accounts can also be created from the signup page by clicking "Admin access".`,
  },
  {
    id: 'login',
    title: 'Sign In / Login',
    keywords: ['login', 'sign in', 'log in', 'signin', 'sign into account', 'how to login'],
    content: `To sign in: Go to /login, enter your email and password, click Sign In. 
Authentication is handled by Supabase. If you have two-factor authentication (MFA) enabled via Supabase, you will be prompted for a code from your authenticator app. 
After successful login, you are redirected to the home page.`,
  },
  {
    id: 'logout',
    title: 'Sign Out / Logout',
    keywords: ['logout', 'sign out', 'log out', 'how to logout'],
    content: `To sign out: Click the sign out button in your profile menu. This clears your Supabase session and redirects you to the home page.`,
  },
  {
    id: 'password-reset',
    title: 'Password Reset',
    keywords: ['forgot password', 'reset password', 'change password', 'password recovery', 'forgot'],
    content: `To reset your password: On the login page, click "Forgot Password". Supabase sends a password reset link to your email. Click the link and set a new password.`,
  },
  // ─── ROLES ─────────────────────────────────────────────────────────────
  {
    id: 'roles-overview',
    title: 'User Roles',
    keywords: ['roles', 'user types', 'job seeker', 'recruiter', 'service provider', 'admin', 'account types'],
    content: `JobBridge has four user roles: 
1. Job Seeker — browse and apply to jobs, use AI resume tools, track applications. 
2. Recruiter — post jobs, review applications, score candidates with AI, hire talent. 
3. Service Provider — create a professional profile, offer services, receive client inquiries. 
4. Admin — manage the platform, approve/reject jobs, manage users and providers. 
You choose your role during signup.`,
  },
  // ─── JOBS ──────────────────────────────────────────────────────────────
  {
    id: 'jobs-browse',
    title: 'Browsing Jobs',
    keywords: ['browse jobs', 'search jobs', 'find jobs', 'job search', 'look for jobs', 'jobs page'],
    content: `The Jobs page (/jobs) shows all active job postings. You can: 
• Search by job title, company, or keywords 
• Filter by location, job type (Full-time, Part-time, Contract, Internship, Freelance), and category 
• Click any job to see full details including description, pay, benefits, and requirements 
• Save jobs with the bookmark icon 
• Apply directly from the job detail view`,
  },
  {
    id: 'jobs-apply',
    title: 'Applying to Jobs',
    keywords: ['apply', 'application', 'apply for job', 'how to apply', 'submit application', 'job application process'],
    content: `To apply for a job: Click "Apply Now" on any job posting. Fill out the application form including: 
• Personal info (date of birth, gender) 
• Disability and displacement status (optional) 
• Professional headline 
• Years of experience and function 
• Work type preference (remote/on-site/hybrid) 
• Highest qualification 
• Location and availability 
• Salary expectation 
• CV/resume file (PDF, DOC, DOCX — max 10MB, uploaded to Supabase Storage) 
• Cover letter 
After submission, you will see "Applied" on the job and the recruiter will review your application.`,
  },
  {
    id: 'jobs-post',
    title: 'Posting Jobs (Recruiters)',
    keywords: ['post job', 'create job', 'job posting', 'publish job', 'post a job', 'create job listing', 'how to post a job'],
    content: `To post a job: Go to the Recruiter Dashboard (/recruiter) and click "Post New Job". 
You need an active subscription with job credits. Fill in: title, company, description, location, job type, salary range, category, requirements, and benefits. 
You can also use the AI Write Description tool to generate an optimized job description first. 
After posting, the job appears on the Jobs page for applicants. 
You can edit or deactivate your jobs from the recruiter dashboard.`,
  },
  {
    id: 'jobs-manage',
    title: 'Managing Job Postings',
    keywords: ['manage jobs', 'edit job', 'delete job', 'deactivate job', 'my jobs', 'job management'],
    content: `Recruiters can manage their jobs from the Recruiter Dashboard (/recruiter). 
Features: view active job postings, see applicant counts, AI-rank candidates, edit job details, and deactivate listings. 
Job seekers can track their saved and applied jobs on the My Jobs page (/my-jobs) with tabs for Saved, Applied, Interviews, and Archived.`,
  },
  // ─── RECRUITER DASHBOARD ───────────────────────────────────────────────
  {
    id: 'recruiter-dashboard',
    title: 'Recruiter Dashboard',
    keywords: ['recruiter dashboard', 'recruiter page', 'recruiter tools', 'recruiter panel', 'recruiter features'],
    content: `The Recruiter Dashboard (/recruiter) provides: 
• Stats overview: Active Jobs, Candidates, Interviews, Offers 
• Subscription status with remaining job credits 
• Post New Job button (requires active subscription) 
• AI Write Description tool for generating optimized job descriptions 
• Active Job Postings with applicant counts 
• AI Rank button to score candidates by match percentage 
• Applications Panel to review, shortlist, reject, or hire candidates 
• Filters by experience, job type, and location`,
  },
  {
    id: 'applications-panel',
    title: 'Applications Panel (Recruiters)',
    keywords: ['applications panel', 'review applications', 'manage applications', 'shortlist', 'shortlisted', 'reject candidate', 'hire candidate', 'application status'],
    content: `The Applications Panel on the Recruiter Dashboard shows all applications for your jobs. 
Each application shows: applicant name, professional headline, function, location, years of experience, salary expectation, and status. 
Click any application to see full details: DOB, gender, disability status, experience, function, work type, qualification, location, availability, salary, cover letter, and CV download. 
You can update the status: Shortlist, Mark Reviewed, Reject, or Hire. 
Filter applications by status: All, Pending, Shortlisted, Reviewed, Rejected.`,
  },
  {
    id: 'ai-ranking',
    title: 'AI Candidate Ranking',
    keywords: ['ai rank', 'candidate scoring', 'score candidates', 'ai candidate ranking', 'rank candidates', 'match score'],
    content: `The AI Rank button on the Recruiter Dashboard scores your candidates against job requirements. 
Candidates are ranked by match percentage with color codes: green (80%+ match), amber (60-79%), red (below 60%). 
This helps recruiters quickly identify the best applicants.`,
  },
  // ─── SUBSCRIPTIONS & PRICING ───────────────────────────────────────────
  {
    id: 'pricing-overview',
    title: 'Pricing Plans Overview',
    keywords: ['pricing', 'plans', 'subscription', 'pricing page', 'cost', 'how much', 'fees', 'plans and pricing'],
    content: `JobBridge offers several subscription plans on the Pricing page (/pricing): 
Recruiter Job Posting Plans: 
• Basic — ₦2,000 / 7 days / 1 job credit 
• Standard — ₦3,500 / 14 days / 1 job credit 
• Premium — ₦5,000 / 30 days / 3 job credits 

AI Tools for Job Seekers: 
• Monthly — ₦1,500/month for AI resume tools 
• Annual — ₦15,000/year (save ~17%) 

Service Provider Plans: 
• Monthly Listing — Free (basic profile) 
• Featured Professional — ₦5,000/month (top placement, homepage spotlight) 

Payments are processed securely via Paystack (cards accepted: Visa, Mastercard, Verve). Bank transfer option available.`,
  },
  {
    id: 'payment-flow',
    title: 'Payment & Activation',
    keywords: ['payment', 'pay', 'how to pay', 'paystack', 'card payment', 'bank transfer', 'payment methods', 'pay for plan'],
    content: `To pay for a plan: Go to the Pricing page, choose your plan, and click through to the Payment page (/payment). 
Select payment method: Card (via Paystack — instant activation) or Bank Transfer (manual verification). 
Card payments are processed securely by Paystack. After successful payment, your subscription is activated immediately with the appropriate credits and duration. 
For transfers, pay the exact amount to the provided bank details and click "I have paid" to activate.`,
  },
  {
    id: 'subscription-status',
    title: 'Subscription & Credits',
    keywords: ['subscription status', 'credits', 'remaining credits', 'job credits', 'check subscription', 'active plan', 'subscription tier'],
    content: `Your subscription status and remaining job credits are shown on the Recruiter Dashboard. 
Statuses: Active (shows remaining credits and plan tier) or No active plan (prompts to subscribe). 
Credits are consumed when you post a job. Premium plan gives 3 credits. 
Premium subscriptions are stored in your profile: is_premium, subscription_tier, subscription_expires_at, and credits fields.`,
  },
  // ─── AI FEATURES ───────────────────────────────────────────────────────
  {
    id: 'ai-resume',
    title: 'AI Resume Builder',
    keywords: ['ai resume', 'resume builder', 'build resume', 'cv builder', 'ai resume studio', 'ai resume page', 'resume tool', 'ai resume builder', 'ai resume subscription'],
    content: `The AI Resume Builder at /ai-resume helps you create professional, ATS-optimized resumes. 
Features: 
• Skills Extraction — Paste your resume text and AI identifies your skills 
• AI Tailor Resume — Paste a job description and AI optimizes your resume for that role 
• AI Cover Letter Generator — Generate job-specific cover letters 

The "Tailor Resume" and "Cover Letter" features require an active AI subscription (₦1,500/month or ₦15,000/year). 
Set VITE_OPENAI_API_KEY in your environment to enable AI features. Without the key, the AI provides placeholder outputs.`,
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant Widget',
    keywords: ['ai assistant', 'chatbot', 'ai chat', 'help widget', 'assistant', 'ai helper', 'support chat', 'ai widget'],
    content: `The AI Assistant is a chat widget available on all pages (bottom-right corner). 
It answers questions about JobBridge features, pricing, how-to guides, and platform navigation. 
The assistant uses a knowledge base of JobBridge documentation combined with OpenAI (if VITE_OPENAI_API_KEY is set) to provide accurate, natural-language answers. 
Click the bot icon to open, type your question, and get instant answers about any JobBridge feature.`,
  },
  {
    id: 'ai-jd-writer',
    title: 'AI Job Description Writer',
    keywords: ['ai job description', 'jd writer', 'ai write description', 'job description generator', 'generate job description', 'ai jd'],
    content: `The AI Job Description Writer on the Recruiter Dashboard: 
1. Click "AI Write Description" (requires active recruiter subscription) 
2. Enter the job title and up to 3 core requirements 
3. Click Generate Description 
4. AI creates an optimized, bias-free job description with responsibilities, requirements, and benefits 
5. Click "Publish This Job" to post directly`,
  },
  // ─── SERVICE PROVIDERS ─────────────────────────────────────────────────
  {
    id: 'service-providers',
    title: 'Service Provider Marketplace',
    keywords: ['service provider', 'become a provider', 'offer services', 'provider page', 'service provider marketplace', 'providers page', 'provider categories'],
    content: `The Service Providers page at /providers showcases professionals offering services in: 
Engineering (web & mobile development), Design (UI/UX, graphic design), Marketing (digital marketing), 
Finance (financial analysis, accounting), Legal (lawyers, legal consultants), Photography (event & portrait), 
Writing (content, copywriting, technical), Consulting (business & career). 

To become a provider: Sign up with the Service Provider role, complete your profile with service categories, 
descriptions, hourly rate, and samples. Choose a plan: Monthly Listing (free) or Featured Professional (₦5,000/month).`,
  },
  // ─── BUSINESS ADVERTISEMENTS ────────────────────────────────────────────
  {
    id: 'business-ads',
    title: 'Business Advertisements',
    keywords: ['business advertisement', 'advert', 'advertising', 'promote business', 'business ads', 'ad packages', 'create advert'],
    content: `The Business page at /business lets you create advertisements to promote your business. 
Ad Packages: 
• Weekly Ad — ₦2,000 / 7 days 
• Monthly Ad — ₦7,500 / 30 days 
• Featured Business — ₦15,000 / 30 days (includes homepage spotlight) 

Create an advert with: business name, title, description, category, and package. 
You can pause, edit, or delete your adverts from the My Adverts section.`,
  },
  // ─── SETTINGS ──────────────────────────────────────────────────────────
  {
    id: 'settings',
    title: 'Settings Page',
    keywords: ['settings', 'account settings', 'profile settings', 'edit profile', 'change settings', 'preferences'],
    content: `The Settings page (/settings) lets you manage: 
• Profile — name, email, phone, title, location, bio 
• Notifications — job matches, application updates, messages, weekly digest, marketing emails, SMS alerts 
• Privacy — profile visibility, search visibility, recruiter contact, activity status 
• Connected Apps — Google, LinkedIn 
• Premium — view your subscription status 
• Danger Zone — account deletion options 

Two-factor authentication (MFA) is available through Supabase settings.`,
  },
  // ─── ADMIN ──────────────────────────────────────────────────────────────
  {
    id: 'admin-dashboard',
    title: 'Admin Dashboard',
    keywords: ['admin', 'admin dashboard', 'admin panel', 'admin page', 'manage platform', 'admin tools'],
    content: `The Admin Dashboard (/admin) provides platform management: 
• Overview — total users, jobs, applications, revenue, new users this week 
• Jobs tab — approve or reject job postings 
• Providers tab — approve or reject service providers 
• Users tab — view all users, suspend or activate accounts 
• Activities tab — platform activity log 

Admin access is granted through the signup page by selecting "Admin access".`,
  },
  // ─── CONTACT & SUPPORT ─────────────────────────────────────────────────
  {
    id: 'contact',
    title: 'Contact & Support',
    keywords: ['contact', 'support', 'help', 'customer support', 'contact us', 'phone', 'email', 'get help', 'jobbridge support'],
    content: `JobBridge Contact Information: 
• Email: jobbridgesupport@gmail.com 
• Phone/WhatsApp: +234 802 442 5069 
• Support page: /support 
• Contact page: /contact 

The platform typically responds within 24 hours. For common questions, use the AI Assistant widget (bottom-right corner) or check the FAQ on the Support page.`,
  },
  // ─── BLOG ───────────────────────────────────────────────────────────────
  {
    id: 'blog',
    title: 'Blog & Insights',
    keywords: ['blog', 'insights', 'articles', 'career advice', 'blog posts', 'jobbridge insights'],
    content: `JobBridge Insights blog at /blog features articles on: Career Advice, AI & Tech, Hiring, Remote Work, 
Salary & Benefits, and Leadership. You can subscribe to the blog newsletter for weekly updates. 
Featured posts include topics like "The Future of AI in Hiring" and "10 Resume Mistakes That Cost You Interviews".`,
  },
  // ─── SECURITY ──────────────────────────────────────────────────────────
  {
    id: 'security',
    title: 'Security & Privacy',
    keywords: ['security', 'privacy', 'data protection', 'secure', 'encryption', 'safe', 'is jobbridge safe'],
    content: `JobBridge prioritizes security: 
• Authentication handled by Supabase (industry-standard auth) 
• Payments processed through Paystack (PCI-compliant) 
• All data transmitted over HTTPS 
• User passwords are hashed and never stored in plaintext 
• Two-factor authentication (MFA) available through Supabase 
• Profile information is encrypted at rest 
• Users control their privacy settings (visibility, search, recruiter contact)`,
  },
  // ─── TROUBLESHOOTING ──────────────────────────────────────────────────
  {
    id: 'troubleshooting',
    title: 'Troubleshooting Common Issues',
    keywords: ['troubleshooting', 'not working', 'error', 'bug', 'issue', 'problem', 'help me', 'fix'],
    content: `Common JobBridge issues and solutions: 

• "Cannot connect to server" — Check your internet connection. If you see this, the Supabase service may be temporarily unavailable. 
• "Email not received" — Check your spam folder. Use the resend option on the login page. 
• Can't post a job — Ensure you have an active subscription with available credits. Check your subscription status on the Recruiter Dashboard. 
• File upload fails — Ensure your CV is under 10MB and in PDF, DOC, or DOCX format. 
• Application not showing — Applications appear in the recruiter's panel after submission. 
• AI features not working — Requires VITE_OPENAI_API_KEY to be configured. Without the key, placeholder responses are shown. 

For unresolved issues, contact jobbridgesupport@gmail.com.`,
  },
  // ─── MY JOBS PAGE ─────────────────────────────────────────────────────
  {
    id: 'my-jobs',
    title: 'My Jobs Page',
    keywords: ['my jobs', 'saved jobs', 'applied jobs', 'track applications', 'my applications', 'job tracker'],
    content: `The My Jobs page (/my-jobs) helps you track your job activity with four tabs: 
• Saved — Jobs you bookmarked. Unsaved by clicking the bookmark icon. 
• Applied — Jobs you applied to, showing application status (Pending, Reviewed, Shortlisted, Rejected, Hired). 
• Interviews — Upcoming interviews (feature placeholder). 
• Archived — Archived jobs (feature placeholder). 

You can search within each tab and browse jobs directly.`,
  },
  // ─── AI RESUME PAGE ───────────────────────────────────────────────────
  {
    id: 'ai-resume-page-detail',
    title: 'AI Resume Studio Page',
    keywords: ['ai resume page', 'resume studio', 'ai resume studio', 'how to use ai resume', 'ai tools page'],
    content: `The AI Resume Studio page (/ai-resume) provides: 
1. Skills Extraction — Paste your resume text, click "Extract Skills", and AI identifies your technical and professional skills. 
2. Tailor Resume (requires AI subscription) — Enter a job title and description, click "Tailor Resume", and AI rewrites your resume to match the role. 
3. Cover Letter Generator (requires AI subscription) — Enter job title, company, and description, click "Generate Cover Letter", and AI writes a tailored cover letter. 
The AI subscription costs ₦1,500/month or ₦15,000/year and also includes interview preparation and career assessment tools.`,
  },
  // ─── SUPPORT PAGE ─────────────────────────────────────────────────────
  {
    id: 'support-page',
    title: 'Support / FAQ Page',
    keywords: ['support page', 'faq', 'frequently asked questions', '/support', 'help center', 'knowledge base'],
    content: `The Support page at /support contains frequently asked questions about JobBridge. 
Topics include: account management, job searching, application process, recruiter tools, subscription plans, payments, AI features, and troubleshooting. 
If you can't find your answer, use the AI Assistant widget (bottom-right) or contact jobbridgesupport@gmail.com.`,
  },
  // ─── VIDEO PLAYER ──────────────────────────────────────────────────────
  {
    id: 'video-demo',
    title: 'Video Demos & Tutorials',
    keywords: ['video', 'demo', 'tutorial', 'how to video', 'walkthrough', 'guide video', 'recruiter demo'],
    content: `The Recruiter Dashboard includes a demo video showing how to use the platform for hiring. 
Various pages feature video content and carousel images to guide users through the platform's features.`,
  },
];

export default KB;
