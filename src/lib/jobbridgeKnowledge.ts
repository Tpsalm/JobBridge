export interface KnowledgeSection {
  id: string;
  title: string;
  keywords: string[];
  tags: string[];
  pages: string[];
  content: string;
}

const KB: KnowledgeSection[] = [
  // ═══════════════════════════════════════════════
  // GENERAL / PLATFORM
  // ═══════════════════════════════════════════════
  {
    id: 'platform-overview',
    title: 'Platform Overview',
    tags: ['general', 'onboarding'],
    pages: ['/'],
    keywords: ['what is jobbridge', 'about', 'platform overview', 'what does jobbridge do', 'jobbridge features', 'introduction', 'about jobbridge'],
    content: `JobBridge is Nigeria's #1 professional network connecting job seekers, recruiters, and service providers. Key features: AI-powered job matching, verified employers, real-time talent search, AI resume builder, cover letter generator, recruiter dashboard with candidate scoring, service provider marketplace, business advertisements, and premium subscription plans. The platform serves three main user types: Job Seekers, Recruiters, and Service Providers. JobBridge is a Progressive Web App (PWA) accessible from any browser on desktop or mobile.`,
  },
  {
    id: 'mission',
    title: 'Company Mission & History',
    tags: ['general', 'company'],
    pages: ['/', '/ceo'],
    keywords: ['mission', 'vision', 'about company', 'founder', 'victor eniola', 'ceo', 'history', 'founded', 'backed'],
    content: `JobBridge was founded in 2021 by Mr. Victor Eniola (CEO & Founder) with a mission to democratize career opportunities. The company is backed by Y Combinator, Sequoia Capital, and Andreessen Horowitz (a16z). Vision pillars: Democratizing Opportunity, AI-First Approach, and Global Impact. The platform has grown to serve millions of users across 50+ countries. For the full founder message, visit the CEO Vision page at /ceo.`,
  },
  {
    id: 'ceo-vision',
    title: 'CEO Vision Page',
    tags: ['general', 'company'],
    pages: ['/ceo'],
    keywords: ['ceo vision', 'ceo message', 'founder message', 'victor eniola vision', 'leadership', 'jobbridge mission', '/ceo'],
    content: `The CEO Vision page at /ceo features a video message from Mr. Victor Eniola sharing his vision for JobBridge. The page includes his journey of building the platform, the challenges faced, and the future roadmap. It also includes a photo gallery of the founder's journey, company milestones, key values, and mission pillars. Users can leave encouraging messages for the CEO directly on this page.`,
  },
  {
    id: 'supported-regions',
    title: 'Supported Regions & Currencies',
    tags: ['general', 'pricing'],
    pages: ['/pricing'],
    keywords: ['regions', 'countries', 'currencies', 'ngn', 'naira', 'nigeria', 'supported countries', 'where is jobbridge available', 'location'],
    content: `JobBridge primarily serves Nigeria and West Africa. All pricing is in Nigerian Naira (NGN). Payments are processed through Paystack, which supports Nigerian cards (Visa, Mastercard, Verve) and bank transfers. The platform is accessible globally as a web application, but job listings and service providers are primarily Nigeria-focused. Currency display is NGN (₦) with symbol ₦.`,
  },
  {
    id: 'accessibility-inclusion',
    title: 'Accessibility & Inclusion',
    tags: ['general', 'values'],
    pages: ['/', '/jobs'],
    keywords: ['accessibility', 'inclusion', 'diversity', 'pwd', 'disabled', 'displaced', 'inclusion note', 'equal opportunity'],
    content: `JobBridge is committed to inclusive hiring. The job application form includes optional fields for disability status and internally displaced person status. An inclusion note on every application reads: "Inclusion is our culture. We champion all talent: women, men, displaced, and PWDs." The platform aims to reduce bias in hiring through AI-powered matching that focuses on skills and experience rather than demographic factors.`,
  },
  {
    id: 'platform-tech-stack',
    title: 'Technology Stack',
    tags: ['general', 'technical'],
    pages: [],
    keywords: ['technology', 'tech stack', 'built with', 'react', 'supabase', 'vite', 'typescript', 'openai', 'paystack', 'github pages'],
    content: `JobBridge is built on: React 18 with TypeScript for the frontend, Vite as the build tool, Supabase for authentication and database, OpenAI API for AI features (GPT-4o-mini and text-embedding-3-small), Paystack for payment processing, and deployed on GitHub Pages. The app is a single-page application (SPA) with client-side routing via React Router.`,
  },

  // ═══════════════════════════════════════════════
  // AUTH / ACCOUNT
  // ═══════════════════════════════════════════════
  {
    id: 'signup',
    title: 'Sign Up / Registration',
    tags: ['auth', 'account'],
    pages: ['/signup'],
    keywords: ['sign up', 'register', 'create account', 'join', 'registration', 'new account', 'how to sign up', 'create profile', 'get started'],
    content: `To create a JobBridge account: Go to /signup, choose your role from the three cards: Job Seeker (browse and apply to jobs), Recruiter (post jobs and hire), or Service Provider (offer services). The "Sign-up as a Job Seeker" card is shown as the primary option. Enter your full name, email, and password (minimum 6 characters). Agree to the Terms of Service and click Create Account. After successful signup, you are automatically signed in and redirected to the home page with a toast to complete your profile at /profile. There is no email verification required — you are signed in instantly.`,
  },
  {
    id: 'login',
    title: 'Sign In / Login',
    tags: ['auth', 'account'],
    pages: ['/login'],
    keywords: ['login', 'sign in', 'log in', 'signin', 'sign into account', 'how to login', 'welcome back'],
    content: `To sign in: Go to /login, enter your email and password, click Sign In. Authentication is handled by Supabase. If you have forgotten your password, click the "Forgot Password" link on the login page to receive a reset email. After successful login, you are redirected to the home page. If you stay inactive for 30 minutes, you will be automatically signed out for security.`,
  },
  {
    id: 'logout',
    title: 'Sign Out / Logout',
    tags: ['auth', 'account'],
    pages: [],
    keywords: ['logout', 'sign out', 'log out', 'how to logout', 'signout'],
    content: `To sign out: Click your profile avatar in the top-right header, then click "Sign out" at the bottom of the dropdown menu. This clears your Supabase session and redirects you to the home page.`,
  },
  {
    id: 'password-reset',
    title: 'Password Reset',
    tags: ['auth', 'account'],
    pages: ['/login'],
    keywords: ['forgot password', 'reset password', 'change password', 'password recovery', 'forgot', 'lost password', 'cannot login'],
    content: `To reset your password: On the login page at /login, click "Forgot Password". Supabase sends a password reset link to your email. Click the link and set a new password. You can also change your password while signed in from the Profile page at /profile — scroll to the Account Security section, enter your current and new password, and click Update Password.`,
  },
  {
    id: 'account-deletion',
    title: 'Account Deletion',
    tags: ['auth', 'account', 'danger'],
    pages: ['/profile'],
    keywords: ['delete account', 'close account', 'remove account', 'cancel account', 'delete my data', 'account deletion'],
    content: `To delete your JobBridge account: Go to the Profile page at /profile and scroll to the "Danger Zone" section at the bottom. Click the red "Delete Account" button. A confirmation modal explains that this action is permanent and cannot be undone — all your data, applications, and profile information will be permanently deleted. To proceed, contact jobbridgesupport@gmail.com for assistance with the deletion process.`,
  },
  {
    id: 'user-roles',
    title: 'User Roles & Permissions',
    tags: ['general', 'account'],
    pages: ['/signup'],
    keywords: ['roles', 'user types', 'job seeker', 'recruiter', 'service provider', 'admin', 'account types', 'permissions', 'what can i do'],
    content: `JobBridge has four user roles: 1) Job Seeker — browse and apply to jobs, use AI resume tools, track applications, save jobs. 2) Recruiter — post jobs, review applications, score candidates with AI, hire talent, manage job postings. 3) Service Provider — create a professional profile, offer services across categories like engineering, design, marketing, finance, legal, and consulting, receive client inquiries. 4) Admin — manage the platform, oversee users, approve or reject job and provider listings. You choose your role during signup at /signup.`,
  },
  {
    id: 'profile-page',
    title: 'Profile Page',
    tags: ['account', 'profile'],
    pages: ['/profile'],
    keywords: ['profile page', 'my profile', 'edit profile', '/profile', 'profile completeness', 'complete profile', 'update profile'],
    content: `The Profile page at /profile is where you manage all your personal and professional information. It includes: a profile completeness meter showing your percentage complete with a list of missing fields; Personal Information section (full name, email, phone, date of birth, gender, location); Professional Information section (professional headline, years of experience, function/industry, preferred work type, highest qualification, availability, salary expectation, bio); Inclusion & Diversity section (disability and displaced status, optional); and Account Security section (password change, 2FA information, connected apps). A "Danger Zone" at the bottom handles account deletion. Click "Save Profile" to persist changes to the database.`,
  },
  {
    id: 'session-management',
    title: 'Session & Auto-Logout',
    tags: ['auth', 'technical'],
    pages: [],
    keywords: ['session', 'auto logout', 'inactivity', 'timeout', 'signed out automatically', 'keep me signed in'],
    content: `JobBridge uses Supabase for session management. Sessions persist until you sign out manually or after 30 minutes of inactivity. The auto-logout timer resets on mouse clicks, key presses, touch events, scrolling, and mouse movement. On page refresh, your session is automatically restored from Supabase's stored session token.`,
  },

  // ═══════════════════════════════════════════════
  // JOB SEEKER FEATURES
  // ═══════════════════════════════════════════════
  {
    id: 'jobs-browse',
    title: 'Browsing Jobs',
    tags: ['jobs', 'job-seeker'],
    pages: ['/jobs', '/'],
    keywords: ['browse jobs', 'search jobs', 'find jobs', 'job search', 'look for jobs', 'jobs page', 'view jobs', 'job listings'],
    content: `The Jobs page at /jobs shows all active job postings in a split-panel layout. Left panel lists job cards with company, title, location, type, salary range, and benefits. Click any job to see full details in the right panel. You can search by job title, company, or keywords using the search bar at the top. Filter by location, job type (Full-time, Part-time, Contract, Internship, Freelance), and category. Save jobs with the bookmark icon (appears in your My Jobs page). Featured jobs have a pink "Featured" badge.`,
  },
  {
    id: 'jobs-apply',
    title: 'Applying to Jobs',
    tags: ['jobs', 'job-seeker'],
    pages: ['/jobs'],
    keywords: ['apply', 'application', 'apply for job', 'how to apply', 'submit application', 'job application process', 'apply now'],
    content: `To apply for a job: click "Apply Now" on any job posting to open the inline 3-step application form. Step 1: date of birth, gender, disability status, displaced status, professional headline, years of experience, and function/industry. Step 2: work type preference, highest qualification, location, availability, and monthly salary expectation (NGN). Step 3: upload your CV (PDF, DOC, DOCX, or RTF — max 10MB, stored securely in Supabase Storage) and write an optional cover letter. After submission, you'll see a success confirmation and the button changes to "Applied ✓". The recruiter will review your application and update its status.`,
  },
  {
    id: 'jobs-save',
    title: 'Saving Jobs',
    tags: ['jobs', 'job-seeker'],
    pages: ['/jobs', '/my-jobs'],
    keywords: ['save job', 'bookmark', 'saved jobs', 'unsave', 'bookmark job', 'save for later'],
    content: `You can save jobs by clicking the bookmark icon on any job card or in the job detail view. A filled blue bookmark means the job is saved. Saved jobs appear in the "Saved" tab on your My Jobs page at /my-jobs. Click the bookmark again to unsave. The saved jobs count badge appears on the bookmark icon in the header.`,
  },
  {
    id: 'my-jobs-page',
    title: 'My Jobs Dashboard',
    tags: ['jobs', 'job-seeker'],
    pages: ['/my-jobs'],
    keywords: ['my jobs', 'my jobs page', 'track applications', 'my applications', 'job tracker', '/my-jobs', 'applied jobs', 'saved jobs tab'],
    content: `The My Jobs page at /my-jobs helps you track all your job activity with four tabs: Saved (jobs you bookmarked, click to unsave), Applied (jobs you applied to showing status: Pending, Reviewed, Shortlisted, Rejected, or Hired), Interviews (upcoming interviews — coming soon), and Archived (archived jobs — coming soon). You can search within each tab. Click any job to view details. This page pulls your saved jobs from localStorage and your applications from the database.`,
  },
  {
    id: 'application-status',
    title: 'Application Status Tracking',
    tags: ['jobs', 'job-seeker'],
    pages: ['/my-jobs'],
    keywords: ['application status', 'track application', 'application pending', 'shortlisted', 'rejected', 'hired', 'reviewed', 'application update'],
    content: `After applying for a job, your application status can be: Pending (submitted, awaiting review), Reviewed (recruiter has seen it), Shortlisted (you passed initial screening), Rejected (not moving forward), or Hired (congratulations!). You can track all your application statuses on the My Jobs page at /my-jobs under the "Applied" tab. Recruiters update these statuses from their Applications Panel.`,
  },
  {
    id: 'salary-negotiation',
    title: 'Salary & Negotiation Guide',
    tags: ['jobs', 'career'],
    pages: ['/jobs'],
    keywords: ['salary', 'negotiation', 'salary negotiation', 'salary guide', 'how to negotiate', 'salary expectation', 'negotiate offer'],
    content: `When applying for jobs, you'll be asked for your monthly salary expectation (gross, in NGN). Research typical salaries for your role and experience level before applying. JobBridge displays salary ranges on job listings when provided by the recruiter, helping you make informed decisions. During interviews, be prepared to discuss your salary expectation and justify it with your skills and experience. For personalized salary advice, use the AI Assistant.`,
  },
  {
    id: 'job-search-tips',
    title: 'Job Search Tips',
    tags: ['jobs', 'career'],
    pages: ['/jobs'],
    keywords: ['job search tips', 'find job faster', 'job hunting', 'career advice', 'land a job', 'get hired', 'application tips'],
    content: `Tips for a successful job search on JobBridge: 1) Complete your profile at /profile — a 100% complete profile gets noticed more. 2) Set your professional headline clearly. 3) Save jobs you're interested in to apply later. 4) Tailor your CV and cover letter for each application. 5) Use the AI Resume Builder at /ai-resume to optimize your CV. 6) Set up your salary expectations realistically. 7) Check new job listings daily. 8) Use the AI Assistant for advice on applications and interviews.`,
  },
  {
    id: 'cover-letter-tips',
    title: 'Cover Letter Tips',
    tags: ['jobs', 'career', 'ai'],
    pages: ['/ai-resume', '/jobs'],
    keywords: ['cover letter', 'cover letter tips', 'write cover letter', 'cover letter template', 'ai cover letter', 'cover letter generator'],
    content: `A good cover letter can make your application stand out. Tips: address the recruiter by name if known, mention the specific job title, highlight 2-3 key achievements relevant to the role, explain why you want to work at that company, and keep it concise (3-4 paragraphs). You can use the AI Cover Letter Generator at /ai-resume to create a tailored cover letter by pasting the job description. The AI feature requires an active AI subscription.`,
  },
  {
    id: 'career-resources',
    title: 'Career Resources & Blog',
    tags: ['career', 'content'],
    pages: ['/blog'],
    keywords: ['blog', 'blog page', 'insights', 'articles', 'career resources', 'career advice', 'blog posts', 'jobbridge blog', 'read blog', 'blog articles', 'newsletter'],
    content: `JobBridge offers career resources through its Insights blog at /blog with articles on: Career Advice, AI & Tech in Hiring, Remote Work tips, Salary & Benefits guides, and Leadership development. You can subscribe to the blog newsletter for weekly updates. Topics include "The Future of AI in Hiring", "10 Resume Mistakes That Cost You Interviews", and "How to Ace Your Remote Interview". New articles are added regularly.`,
  },

  // ═══════════════════════════════════════════════
  // RECRUITER FEATURES
  // ═══════════════════════════════════════════════
  {
    id: 'recruiter-dashboard',
    title: 'Recruiter Dashboard',
    tags: ['recruiter'],
    pages: ['/recruiter'],
    keywords: ['recruiter', 'recruiters', 'recruiter dashboard', 'recruiter page', 'recruiter tools', 'recruiter panel', 'recruiter features', '/recruiter', 'recruiter home', 'recruiting'],
    content: `The Recruiter Dashboard at /recruiter is your command center. It shows: stats overview (Active Jobs, Total Candidates, Interviews, Offers), subscription status with remaining job credits, "Post New Job" button (requires active subscription), "AI Write Description" tool for generating optimized job descriptions, a list of your active job postings with applicant counts, AI Rank button to score candidates by match percentage, and the Applications Panel to manage all incoming applications. You can filter applications by status: All, Pending, Shortlisted, Reviewed, or Rejected.`,
  },
  {
    id: 'jobs-post',
    title: 'Posting Jobs (Recruiters)',
    tags: ['jobs', 'recruiter'],
    pages: ['/recruiter'],
    keywords: ['post job', 'create job', 'job posting', 'publish job', 'post a job', 'create job listing', 'how to post a job', 'new job'],
    content: `To post a job: Go to the Recruiter Dashboard at /recruiter and click "Post New Job". You need an active subscription with available job credits. Fill in the following fields: Job Title, Company Name, Job Description (use the AI Write Description tool to generate one), Location, Job Type (Full-time, Part-time, Contract, Freelance, Internship), Salary Range, Category, Requirements, and Benefits. After posting, the job appears on the Jobs page for applicants. You can edit or deactivate your jobs anytime from the dashboard.`,
  },
  {
    id: 'jobs-manage',
    title: 'Managing Job Postings',
    tags: ['jobs', 'recruiter'],
    pages: ['/recruiter'],
    keywords: ['manage jobs', 'edit job', 'delete job', 'deactivate job', 'job management', 'edit posting', 'close job'],
    content: `From the Recruiter Dashboard at /recruiter, you can manage all your job postings. Each posting shows the title, applicant count, status, and creation date. Click "Edit" to modify job details. Click "Deactivate" to remove a job from the listings without deleting it. Deactivated jobs can be reactivated later. Deleting a job permanently removes it and all associated applications.`,
  },
  {
    id: 'applications-panel',
    title: 'Applications Panel (Recruiters)',
    tags: ['recruiter', 'jobs'],
    pages: ['/recruiter'],
    keywords: ['applications panel', 'review applications', 'manage applications', 'shortlist', 'shortlisted', 'reject candidate', 'hire candidate', 'application status', 'candidates'],
    content: `The Applications Panel on the Recruiter Dashboard shows all applications received for your jobs. Each applicant card displays: name, professional headline, function, location, years of experience, salary expectation, and current status. Click any application to view full details including date of birth, gender, disability status, experience, function, work type, qualification, location, availability, salary, cover letter, and a link to download their CV. You can update application status: Shortlist (mark as promising), Mark Reviewed (acknowledge review), Reject (decline), or Hire (offer the position). Status updates are visible to the applicant on their My Jobs page.`,
  },
  {
    id: 'ai-ranking',
    title: 'AI Candidate Ranking',
    tags: ['recruiter', 'ai'],
    pages: ['/recruiter'],
    keywords: ['ai rank', 'candidate scoring', 'score candidates', 'ai candidate ranking', 'rank candidates', 'match score', 'ai ranking'],
    content: `The AI Rank button on the Recruiter Dashboard automatically scores your candidates against the job requirements. Candidates are ranked by match percentage with color-coded indicators: green (80%+ match — excellent fit), amber (60-79% match — potential fit), red (below 60% — needs review). This AI-powered ranking helps recruiters quickly identify the strongest applicants without manually reviewing every application. Click AI Rank anytime new applications arrive.`,
  },
  {
    id: 'ai-jd-writer',
    title: 'AI Job Description Writer',
    tags: ['ai', 'recruiter'],
    pages: ['/recruiter'],
    keywords: ['ai job description', 'jd writer', 'ai write description', 'job description generator', 'generate job description', 'ai jd', 'write jd'],
    content: `The AI Job Description Writer on the Recruiter Dashboard streamlines job posting. To use: click "AI Write Description" (requires active recruiter subscription), enter the job title and up to 3 core requirements, click Generate Description. The AI creates an optimized, bias-free job description with responsibilities, requirements, and benefits sections. Review the generated description, make any edits, then click "Publish This Job" to post it directly. This saves recruiters significant time and ensures consistent, high-quality job postings.`,
  },
  {
    id: 'recruiter-subscription',
    title: 'Recruiter Subscription Management',
    tags: ['recruiter', 'pricing'],
    pages: ['/recruiter', '/pricing'],
    keywords: ['recruiter subscription', 'job credits', 'recruiter plan', 'post job credits', 'subscription required', 'no active plan', 'buy credits'],
    content: `To post jobs as a recruiter, you need an active subscription with available job credits. Your subscription status is shown at the top of the Recruiter Dashboard. If you have no active plan, a prompt directs you to subscribe at /pricing. Plans: Basic (₦2,000 / 7 days / 1 credit), Standard (₦3,500 / 14 days / 1 credit), Premium (₦5,000 / 30 days / 3 credits). Each job post consumes one credit. Your subscription tier, credits remaining, and expiration date are displayed on the dashboard.`,
  },
  {
    id: 'hiring-best-practices',
    title: 'Hiring Best Practices',
    tags: ['recruiter', 'career'],
    pages: ['/recruiter'],
    keywords: ['hiring best practices', 'recruit effectively', 'find best candidates', 'interview tips', 'recruiting advice', 'hire right'],
    content: `Best practices for recruiting on JobBridge: 1) Write clear, detailed job descriptions with specific requirements. 2) Use the AI Job Description Writer to create bias-free postings. 3) Set a competitive salary range to attract quality candidates. 4) Review applications promptly — top candidates are snapped up quickly. 5) Use AI Ranking to identify best-fit candidates first. 6) Keep applicants updated on their status through the Applications Panel. 7) Consider candidates with transferable skills, not just exact matches. 8) Check the candidate's complete profile for a fuller picture.`,
  },

  // ═══════════════════════════════════════════════
  // AI FEATURES
  // ═══════════════════════════════════════════════
  {
    id: 'ai-assistant',
    title: 'AI Assistant Widget',
    tags: ['ai', 'support'],
    pages: [],
    keywords: ['ai assistant', 'chatbot', 'ai chat', 'help widget', 'assistant', 'ai helper', 'support chat', 'ai widget', 'ask ai', 'jobbridge ai'],
    content: `The AI Assistant is a chat widget available on every page — click the bot icon in the bottom-right corner to open it. It answers questions about JobBridge features, pricing, how-to guides, and platform navigation using a comprehensive knowledge base combined with OpenAI's GPT-4o-mini (when configured). The assistant shows phase indicators while working: "Analyzing your question", "Searching knowledge base", and "Generating response". It cites sources as badges. You can click suggested prompts, clear the conversation, or retry failed requests. The assistant remembers the last 20 messages in your conversation.`,
  },
  {
    id: 'ai-resume-studio',
    title: 'AI Resume Studio Overview',
    tags: ['ai', 'job-seeker'],
    pages: ['/ai-resume'],
    keywords: ['ai resume studio', 'ai resume page', '/ai-resume', 'resume tools', 'ai resume tools', 'resume studio'],
    content: `The AI Resume Studio at /ai-resume provides four AI-powered tools: 1) Skills Extraction — paste your resume text and AI identifies and organizes your skills. 2) AI Tailor Resume — paste a job description and AI optimizes your resume for that specific role. 3) AI Cover Letter Generator — generate job-specific cover letters by pasting the job description. 4) AI Interview Preparation — practice with industry-specific interview questions. The Skills Extraction tool is free. The Tailor Resume, Cover Letter, and Interview Prep features require an active AI subscription (₦1,500/month or ₦15,000/year). You can upload a CV file (.txt, .pdf, .doc, .docx) to populate the resume text area.`,
  },
  {
    id: 'ai-skills-extraction',
    title: 'AI Skills Extraction',
    tags: ['ai', 'job-seeker'],
    pages: ['/ai-resume'],
    keywords: ['skills extraction', 'extract skills', 'identify skills', 'resume skills', 'ai skills', 'skill analyzer'],
    content: `The Skills Extraction tool at /ai-resume analyzes your resume text and automatically identifies your skills organized by categories: Technical Skills, Soft Skills, Languages, and Certifications. To use: paste your resume text or upload a CV file, then click "Extract Skills". The AI scans your text and returns a structured list of skills you can use on applications. This feature is free and does not require an AI subscription.`,
  },
  {
    id: 'ai-tailor-resume',
    title: 'AI Tailor Resume',
    tags: ['ai', 'job-seeker'],
    pages: ['/ai-resume'],
    keywords: ['tailor resume', 'optimize resume', 'ats resume', 'resume optimization', 'ai tailor', 'match resume to job', 'customize resume'],
    content: `The AI Tailor Resume tool at /ai-resume optimizes your resume for a specific job description. To use: paste your resume text, paste the job description, and click "Tailor Resume". The AI adjusts your resume to highlight relevant experience and keywords that match the job requirements, improving your chances of passing Applicant Tracking Systems (ATS). This feature requires an active AI subscription (₦1,500/month or ₦15,000/year).`,
  },
  {
    id: 'ai-cover-letter',
    title: 'AI Cover Letter Generator',
    tags: ['ai', 'job-seeker'],
    pages: ['/ai-resume'],
    keywords: ['cover letter generator', 'ai cover letter', 'generate cover letter', 'write cover letter ai', 'cover letter ai'],
    content: `The AI Cover Letter Generator at /ai-resume creates tailored cover letters. To use: paste the job description and your resume text, then click "Generate Cover Letter". The AI produces a professional, customized cover letter highlighting your relevant experience and skills. You can copy, edit, and download the result. This feature requires an active AI subscription (₦1,500/month or ₦15,000/year).`,
  },
  {
    id: 'ai-interview-prep',
    title: 'AI Interview Preparation',
    tags: ['ai', 'job-seeker'],
    pages: ['/ai-resume'],
    keywords: ['interview prep', 'mock interview', 'practice interview', 'interview questions', 'interview preparation', 'ai interview', 'practice questions'],
    content: `AI Interview Preparation at /ai-resume helps you practice for job interviews. You can get industry-specific interview questions, practice your responses, and receive AI feedback on your answers. This is ideal for preparing for behavioral questions, technical interviews, and situational questions. This feature requires an active AI subscription (₦1,500/month or ₦15,000/year).`,
  },
  {
    id: 'ai-subscription',
    title: 'AI Tools Subscription',
    tags: ['ai', 'pricing'],
    pages: ['/pricing', '/ai-resume'],
    keywords: ['ai subscription', 'ai tools pricing', 'ai monthly', 'ai annual', 'ai resume subscription', 'unlock ai', 'ai features payment', 'ai tools cost'],
    content: `AI-powered tools (Tailor Resume, Cover Letter Generator, Interview Preparation) require an active AI subscription. Pricing: Monthly — ₦1,500/month, Annual — ₦15,000/year (save ~17%). Pay via the Pricing page at /pricing. AI subscription is separate from recruiter job posting plans. Skills Extraction is free for all users. The AI Assistant chat widget is always free to use.`,
  },
  {
    id: 'ai-job-matching',
    title: 'AI Job Matching',
    tags: ['ai', 'jobs'],
    pages: ['/jobs'],
    keywords: ['ai job matching', 'job recommendations', 'matched jobs', 'ai recommend', 'smart matching', 'personalized jobs'],
    content: `JobBridge uses AI to help match job seekers with relevant positions. While browsing, you can find jobs that align with your professional headline, experience, and function preferences. Recruiters can use AI Ranking to match candidates to their job requirements. Future updates will include personalized job recommendations based on your complete profile.`,
  },

  // ═══════════════════════════════════════════════
  // PRICING & PAYMENTS
  // ═══════════════════════════════════════════════
  {
    id: 'pricing-overview',
    title: 'Pricing Plans Overview',
    tags: ['pricing', 'subscription'],
    pages: ['/pricing'],
    keywords: ['pricing', 'plans', 'subscription', 'pricing page', 'cost', 'how much', 'fees', 'plans and pricing', 'recruiter plans', 'job posting cost'],
    content: `JobBridge pricing at /pricing offers: Recruiter Job Posting Plans — Basic (₦2,000 / 7 days / 1 job credit), Standard (₦3,500 / 14 days / 1 job credit), Premium (₦5,000 / 30 days / 3 job credits). AI Tools for Job Seekers — Monthly (₦1,500/month), Annual (₦15,000/year, save ~17%). Service Provider Plans — Monthly Listing (free, basic profile), Featured Professional (₦5,000/month, top placement with homepage spotlight). Payments are processed securely via Paystack.`,
  },
  {
    id: 'payment-flow',
    title: 'Payment & Activation',
    tags: ['pricing', 'payment'],
    pages: ['/pricing'],
    keywords: ['payment', 'pay', 'how to pay', 'paystack', 'card payment', 'bank transfer', 'payment methods', 'pay for plan', 'activate plan'],
    content: `To pay for a plan: Go to the Pricing page at /pricing, choose your plan, and click through to the Payment page at /payment. The Payment page opens Paystack's secure popup for card payments (Visa, Mastercard, Verve). After successful payment, your subscription is activated immediately. The system records the payment in the database, updates your profile with premium status, subscription tier, credits, and expiration date, then you are redirected back. Bank transfer option is also available — pay the exact amount to the provided bank details and click "I have paid" for manual verification.`,
  },
  {
    id: 'subscription-status',
    title: 'Subscription & Credits',
    tags: ['pricing', 'recruiter'],
    pages: ['/recruiter'],
    keywords: ['subscription status', 'credits', 'remaining credits', 'job credits', 'check subscription', 'active plan', 'subscription tier', 'subscription expiry'],
    content: `Your subscription status is displayed on the Recruiter Dashboard. It shows: plan tier (Basic, Standard, or Premium), remaining job credits, and expiration date. Statuses: Active (shows remaining credits and plan) or No active plan (prompts to subscribe). Credits are consumed when you post a job. The Premium plan gives 3 credits. Premium status is stored in your profile fields: is_premium, subscription_tier, subscription_expires_at, and credits. You can purchase more credits or upgrade your plan at /pricing.`,
  },
  {
    id: 'premium-features',
    title: 'Premium Features Comparison',
    tags: ['pricing', 'subscription'],
    pages: ['/pricing', '/settings'],
    keywords: ['premium features', 'free vs premium', 'premium benefits', 'premium plan', 'upgrade premium', 'what premium includes'],
    content: `Premium (paid) plans unlock additional features over Free. For recruiters: Free allows up to 5 job applications per month; Premium gives unlimited applications, AI job matching, priority support, advanced analytics, and profile highlights. Premium recruiters can also use AI-powered candidate ranking and AI job description writer. Free users can browse jobs, use the AI Assistant, extract skills, and maintain a basic profile. Check the comparison table on the Pricing page at /pricing for full details.`,
  },
  {
    id: 'payment-methods',
    title: 'Payment Methods',
    tags: ['pricing', 'payment'],
    pages: ['/payment'],
    keywords: ['payment methods', 'paystack', 'card payment', 'bank transfer', 'visa', 'mastercard', 'verve', 'how to pay', 'payment options'],
    content: `JobBridge uses Paystack for payment processing on the Payment page at /payment. Supported methods: Card Payments — Visa, Mastercard, and Verve are accepted. The Paystack popup handles the transaction securely (PCI-compliant). Bank Transfer — pay the exact amount to the provided bank account details, then click "I have paid" for manual verification by the team. All prices are in Nigerian Naira (NGN).`,
  },

  // ═══════════════════════════════════════════════
  // SERVICE PROVIDERS
  // ═══════════════════════════════════════════════
  {
    id: 'service-providers',
    title: 'Service Provider Marketplace',
    tags: ['providers', 'marketplace'],
    pages: ['/providers'],
    keywords: ['service provider', 'service providers', 'provider', 'providers', 'provider page', 'providers page', 'service provider marketplace', '/providers', 'find services', 'hire provider', 'professional services', 'marketplace'],
    content: `The Service Providers page at /providers showcases professionals offering services in: Engineering (web and mobile development), Design (UI/UX, graphic design), Marketing (digital marketing, SEO, social media), Finance (financial analysis, accounting, bookkeeping), Legal (lawyers, legal consultants), Photography (event and portrait photography), Writing (content writing, copywriting, technical writing), and Consulting (business and career consulting). You can browse providers, view their profiles, check ratings, and send inquiries.`,
  },
  {
    id: 'become-provider',
    title: 'Becoming a Service Provider',
    tags: ['providers', 'signup'],
    pages: ['/providers', '/signup'],
    keywords: ['become provider', 'become a provider', 'offer services', 'register as provider', 'provider signup', 'provider role'],
    content: `To become a service provider: 1) Sign up at /signup and select "Service Provider" as your role. 2) Complete your provider profile with business name, specialty, description, skills, hourly rate, location, phone, and email. 3) Upload service samples or portfolio. 4) Choose a plan: Monthly Listing (free, basic profile) or Featured Professional (₦5,000/month, top placement, homepage spotlight, verified badge). 5) Start receiving client inquiries. Your provider profile appears on the Providers page for potential clients to discover.`,
  },
  {
    id: 'provider-plans',
    title: 'Provider Plans & Features',
    tags: ['providers', 'pricing'],
    pages: ['/providers', '/pricing'],
    keywords: ['provider plans', 'provider pricing', 'featured professional', 'monthly listing', 'provider subscription', 'provider tiers'],
    content: `Service Provider plans: Monthly Listing (free) — basic profile, appears in category listings, standard visibility. Featured Professional (₦5,000/month) — premium placement at the top of your category, homepage spotlight carousel, verified badge, priority in search results, and featured label. Featured providers get significantly more visibility and client inquiries. You can start with the free plan and upgrade anytime.`,
  },
  {
    id: 'manage-provider-services',
    title: 'Managing Provider Services',
    tags: ['providers'],
    pages: ['/providers'],
    keywords: ['manage services', 'edit provider profile', 'update services', 'provider dashboard', 'provider settings', 'update hourly rate'],
    content: `Service providers can manage their profile from the Providers page. Update your business name, description, skills, hourly rate, location, and contact information. You can add portfolio samples and toggle your availability. Track your profile views, inquiries received, and rating. Upgrade your plan from the Settings section.`,
  },
  {
    id: 'provider-success-tips',
    title: 'Provider Success Tips',
    tags: ['providers', 'career'],
    pages: ['/providers'],
    keywords: ['provider tips', 'get clients', 'provider success', 'service provider tips', 'attract clients', 'grow business'],
    content: `Tips for success as a JobBridge service provider: 1) Complete your profile with a professional photo and detailed description. 2) List specific skills and include samples of your best work. 3) Set competitive hourly rates. 4) Upgrade to Featured Professional for maximum visibility. 5) Respond to client inquiries promptly. 6) Collect reviews from satisfied clients. 7) Keep your availability status up to date. 8) Use the AI Assistant to get tips on growing your service business.`,
  },

  // ═══════════════════════════════════════════════
  // BUSINESS ADS
  // ═══════════════════════════════════════════════
  {
    id: 'business-ads',
    title: 'Business Advertisements',
    tags: ['business', 'advertising'],
    pages: ['/business'],
    keywords: ['business', 'business page', 'business advertisement', 'advert', 'advertising', 'advertise', 'promote business', 'business ads', 'ad packages', 'create advert', '/business', 'ad campaign'],
    content: `The Business page at /business lets you create advertisements to promote your business to the JobBridge audience. Ad Packages: Weekly Ad (₦2,000 / 7 days), Monthly Ad (₦7,500 / 30 days), Featured Business (₦15,000 / 30 days with homepage spotlight carousel). Create an advert by providing: business name, title, description, category, optional image and website URL, phone, email, and location. Payments are handled via Paystack.`,
  },
  {
    id: 'create-advert',
    title: 'Creating an Advertisement',
    tags: ['business', 'advertising'],
    pages: ['/business'],
    keywords: ['create advert', 'new advert', 'post advertisement', 'create business ad', 'how to advertise', 'start campaign'],
    content: `To create an advertisement: 1) Go to /business and click "Create Advert". 2) Enter your business name, a compelling title, and a description highlighting your products or services. 3) Select a category. 4) Optionally add an image URL, website URL, phone, email, and location. 5) Choose your package (Weekly, Monthly, or Featured). 6) Complete payment via Paystack. 7) Your advert goes live immediately after payment. You can view, pause, edit, or delete your adverts from the "My Adverts" section on the same page.`,
  },
  {
    id: 'ad-management',
    title: 'Managing Advertisements',
    tags: ['business', 'advertising'],
    pages: ['/business'],
    keywords: ['manage adverts', 'edit advert', 'pause advert', 'delete advert', 'my adverts', 'ad status'],
    content: `Manage your advertisements from the "My Adverts" section on the Business page at /business. You can: View all your adverts with their status (Active, Paused, Expired), pause an active advert, resume a paused advert, edit the advert content, or delete an advert entirely. Featured adverts appear in the homepage carousel and have a "Featured" badge. Advert performance (views and clicks) is tracked in your dashboard.`,
  },

  // ═══════════════════════════════════════════════
  // SETTINGS & PREFERENCES
  // ═══════════════════════════════════════════════
  {
    id: 'settings-page',
    title: 'Settings Page Overview',
    tags: ['account', 'settings'],
    pages: ['/settings'],
    keywords: ['settings', 'settings page', '/settings', 'app settings', 'preferences', 'configure'],
    content: `The Settings page at /settings provides configuration for: Profile (personal info from your main profile), Notifications (job matches, application updates, messages, weekly digest, marketing emails, SMS alerts), Privacy (profile visibility, talent search visibility, recruiter contact, activity status), Premium (view and manage your subscription), Connected Apps (Google, LinkedIn integration info), and Danger Zone (account deletion options). Two-factor authentication (MFA) is available through Supabase — manage it from the Supabase dashboard.`,
  },
  {
    id: 'notification-preferences',
    title: 'Notification Preferences',
    tags: ['account', 'settings'],
    pages: ['/settings'],
    keywords: ['notifications', 'notification settings', 'email notifications', 'alerts', 'job alerts', 'push notifications', 'notification preferences'],
    content: `Manage your notification preferences on the Settings page at /settings under the Notifications section. Toggle each type on or off: Job Matches (when new jobs match your profile), Application Updates (status changes on your applications), Messages (new messages from employers), Weekly Digest (weekly summary of opportunities), Marketing Emails (new features and promotions), and SMS Alerts (urgent notifications via SMS). Changes save immediately.`,
  },
  {
    id: 'privacy-controls',
    title: 'Privacy Controls',
    tags: ['account', 'privacy'],
    pages: ['/settings'],
    keywords: ['privacy', 'privacy settings', 'profile visibility', 'who can see my profile', 'hide profile', 'private profile', 'recruiter contact'],
    content: `Privacy controls on the Settings page at /settings let you manage: Profile Visibility — Public (anyone can see), Connections Only (only your connections), or Private (no one). Search Visibility — toggle appearance in recruiter talent searches. Recruiter Contact — allow recruiters to reach out through the platform. Activity Status — show or hide when you're online. Changes take effect immediately. Your email and personal data are encrypted at rest and never shared without permission.`,
  },
  {
    id: 'connected-apps',
    title: 'Connected Apps & Integrations',
    tags: ['account', 'settings'],
    pages: ['/settings'],
    keywords: ['connected apps', 'google', 'linkedin', 'integrations', 'social login', 'oauth', 'connect google', 'connect linkedin'],
    content: `The Settings page at /settings shows your connected third-party app integrations. Currently integrated: Google (shows the connected email) and LinkedIn (shows the connected profile). You can disconnect apps from this page by clicking "Disconnect" on each app. Future updates will add more integration options including single sign-on (SSO) providers.`,
  },

  // ═══════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════
  {
    id: 'admin-dashboard',
    title: 'Admin Dashboard',
    tags: ['admin'],
    pages: ['/admin'],
    keywords: ['admin', 'admin dashboard', 'admin panel', 'admin page', 'manage platform', 'admin tools', '/admin'],
    content: `The Admin Dashboard at /admin provides full platform management. Overview tab shows key metrics: total users, total jobs, total applications, total revenue, and new users this week. The Users tab lets you view all users, their roles, and status. Use the action buttons to suspend or activate accounts and change user roles. The Jobs tab displays all job postings with the ability to approve or reject them. The Providers tab lists service providers for approval or rejection. The Activities tab shows a chronological platform activity log including user signups, job posts, and payments. Admin access is granted through the signup page.`,
  },
  {
    id: 'admin-user-management',
    title: 'Admin User Management',
    tags: ['admin'],
    pages: ['/admin'],
    keywords: ['admin users', 'manage users', 'suspend user', 'activate user', 'user roles', 'change role', 'admin user management'],
    content: `From the Admin Dashboard at /admin, the Users tab shows a table of all registered users with columns: name, email, role, status, and join date. Admins can suspend problematic accounts, activate suspended accounts, and change user roles (job_seeker, recruiter, provider, admin, suspended). Changes take effect immediately. Suspended users cannot sign in or use the platform.`,
  },
  {
    id: 'admin-job-moderation',
    title: 'Admin Job Moderation',
    tags: ['admin'],
    pages: ['/admin'],
    keywords: ['admin jobs', 'moderate jobs', 'approve job', 'reject job', 'job moderation', 'review job posting'],
    content: `The Admin Dashboard Jobs tab at /admin shows all job postings with details: title, company, recruiter, status, and creation date. Admins can approve legitimate job postings or reject inappropriate ones. Rejected jobs are removed from the public listings. This ensures all jobs on JobBridge meet quality standards and are not spam or fraudulent.`,
  },
  {
    id: 'admin-provider-moderation',
    title: 'Admin Provider Moderation',
    tags: ['admin'],
    pages: ['/admin'],
    keywords: ['admin providers', 'moderate providers', 'approve provider', 'reject provider', 'service provider approval'],
    content: `The Admin Dashboard Providers tab at /admin lists all service provider profiles. Admins review provider details and approve legitimate professionals while rejecting those that don't meet platform standards. Approved providers appear on the public Providers page. This maintains the quality and trustworthiness of the JobBridge service marketplace.`,
  },

  // ═══════════════════════════════════════════════
  // SUPPORT & HELP
  // ═══════════════════════════════════════════════
  {
    id: 'contact-support',
    title: 'Contact & Support',
    tags: ['support', 'contact'],
    pages: ['/support', '/contact'],
    keywords: ['contact', 'support', 'help', 'customer support', 'contact us', 'phone', 'email', 'get help', 'jobbridge support', 'customer service'],
    content: `JobBridge support options: Email — jobbridgesupport@gmail.com (response within 24 hours), Phone/WhatsApp — +234 802 442 5069, Support page at /support (includes FAQ accordion with common questions), Contact page at /contact (contact form to send a message). For immediate help with common questions, use the AI Assistant chat widget (bottom-right corner of every page) for instant answers.`,
  },
  {
    id: 'faq-job-seekers',
    title: 'FAQ — Job Seekers',
    tags: ['faq', 'job-seeker'],
    pages: ['/support'],
    keywords: ['faq', 'frequently asked questions', 'common questions', 'job seeker faq', 'job seeker help', 'questions'],
    content: `Common Job Seeker questions: Q: How do I apply for a job? A: Browse jobs at /jobs, click a job, then click "Apply Now" and fill out the 3-step form. Q: Can I save jobs? A: Yes, click the bookmark icon. Saved jobs appear at /my-jobs. Q: How do I track my applications? A: Go to /my-jobs, open the "Applied" tab to see statuses. Q: Is my CV secure? A: Yes, CVs are uploaded to Supabase Storage with restricted access. Q: How does AI help my job search? A: Use the AI Resume Studio at /ai-resume for skills extraction, resume tailoring, and cover letters.`,
  },
  {
    id: 'faq-recruiters',
    title: 'FAQ — Recruiters',
    tags: ['faq', 'recruiter'],
    pages: ['/support'],
    keywords: ['recruiter faq', 'recruiter questions', 'post job question', 'how to hire', 'recruiter help'],
    content: `Common Recruiter questions: Q: How do I post a job? A: Go to /recruiter, ensure you have an active subscription, click "Post New Job". Q: What are job credits? A: Each job post consumes one credit. Credits come with your subscription plan. Q: How do I review applications? A: Use the Applications Panel on the Recruiter Dashboard to view, shortlist, or reject candidates. Q: Can I use AI to rank candidates? A: Yes, click "AI Rank" to score candidates by match percentage. Q: How do I edit a job posting? A: Click "Edit" next to the job on your dashboard.`,
  },
  {
    id: 'faq-general',
    title: 'FAQ — General Questions',
    tags: ['faq', 'general'],
    pages: ['/support'],
    keywords: ['general faq', 'common faq', 'jobbridge faq', 'help center', 'general questions'],
    content: `Frequently asked questions: Q: Is JobBridge free? A: Browsing jobs, using the AI Assistant, and maintaining a profile are free. Posting jobs requires a paid subscription. Q: What payment methods are accepted? A: Paystack — Visa, Mastercard, Verve cards, and bank transfers. Q: How is my data protected? A: All data transmitted over HTTPS, passwords are hashed, and Supabase handles authentication securely. Q: Can I change my role? A: Contact support at jobbridgesupport@gmail.com to request a role change. Q: Is there a mobile app? A: JobBridge is a PWA — install it from your browser for an app-like experience.`,
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting Common Issues',
    tags: ['support', 'troubleshooting'],
    pages: [],
    keywords: ['troubleshooting', 'not working', 'error', 'bug', 'issue', 'problem', 'help me', 'fix', 'cannot', 'not loading', 'broken'],
    content: `Common issues and solutions: "Cannot connect" — check your internet connection; Supabase may be temporarily unavailable. "Email not received" — check spam folder, use the resend option on the login page. Can't post a job — ensure active subscription with available credits, check on the Recruiter Dashboard. File upload fails — CV must be under 10MB in PDF, DOC, or DOCX format. Application not showing — it appears in the recruiter's panel after submission; refresh the page. AI features not working — requires VITE_OPENAI_API_KEY configured; if missing, the AI assistant shows "currently unavailable". Page refresh gives 404 on GitHub Pages — use in-app navigation links instead of browser refresh for sub-pages like /jobs or /recruiter. For unresolved issues, contact jobbridgesupport@gmail.com.`,
  },
  {
    id: 'career-page',
    title: 'Career Page',
    tags: ['general', 'company'],
    pages: ['/career'],
    keywords: ['career page', 'career', 'join jobbridge', 'work at jobbridge', 'career opportunities', 'jobbridge careers', '/career', 'jobs at jobbridge', 'hiring'],
    content: `The Career page at /career is JobBridge's "Coming Soon" careers section. It invites interested professionals to get notified when the company starts hiring. Click "Get Notified When Live" to subscribe your email for updates when career opportunities at JobBridge become available. Subscriptions are stored in the blog_subscribers table.`,
  },

  // ═══════════════════════════════════════════════
  // TECHNICAL
  // ═══════════════════════════════════════════════
  {
    id: 'pwa-features',
    title: 'PWA & Mobile Installation',
    tags: ['general', 'technical'],
    pages: [],
    keywords: ['pwa', 'progressive web app', 'install app', 'mobile app', 'offline', 'install jobbridge', 'add to home screen', 'install on phone'],
    content: `JobBridge is a Progressive Web App (PWA). Install it on your device for a native app-like experience: Desktop — click the install icon in the browser address bar. Mobile (Android) — tap "Add to Home Screen" from the browser menu. iPhone (iOS) — tap the Share button, then "Add to Home Screen". Benefits: faster loading, offline access to cached content, push notifications, and full-screen mode without browser chrome.`,
  },
  {
    id: 'security-privacy',
    title: 'Security & Data Protection',
    tags: ['security', 'legal'],
    pages: ['/settings'],
    keywords: ['security', 'privacy', 'data protection', 'secure', 'encryption', 'safe', 'is jobbridge safe', 'https', 'data privacy'],
    content: `JobBridge prioritizes security: authentication handled by Supabase (industry-standard auth with bcrypt password hashing), payments processed through Paystack (PCI-compliant), all data transmitted over HTTPS with encryption in transit, profile information encrypted at rest, strict Content Security Policy (CSP) preventing XSS attacks, frame-busting JavaScript to prevent clickjacking, and users control their privacy settings (visibility, search, recruiter contact). Anti-copy measures prevent unauthorized copying of displayed content except form inputs.`,
  },
  {
    id: 'browser-support',
    title: 'Browser & Device Support',
    tags: ['technical'],
    pages: [],
    keywords: ['browser support', 'supported browsers', 'chrome', 'firefox', 'safari', 'edge', 'mobile browser', 'compatibility'],
    content: `JobBridge works on all modern browsers: Google Chrome (recommended, version 90+), Mozilla Firefox (version 90+), Apple Safari (version 15+), and Microsoft Edge (version 90+). Mobile browsers on both Android and iOS are supported. Internet Explorer is not supported. For the best experience, use the latest version of Chrome or Firefox on desktop, and install the PWA on mobile for app-like performance.`,
  },
  {
    id: 'data-export',
    title: 'Data Export & Portability',
    tags: ['account', 'technical'],
    pages: ['/profile'],
    keywords: ['data export', 'download data', 'export my data', 'data portability', 'gdpr', 'personal data'],
    content: `You can export your personal data from the Danger Zone section at the bottom of the Profile page at /profile. Click "Export Data" to download a copy of your personal information in a portable format. This includes your profile details, job applications, and saved jobs. For complete data deletion, contact jobbridgesupport@gmail.com.`,
  },
  {
    id: 'github-pages-deployment',
    title: 'GitHub Pages & SPA Routing',
    tags: ['technical'],
    pages: [],
    keywords: ['github pages', 'deployment', 'spa routing', '404 on refresh', 'page not found', 'sub-page refresh'],
    content: `JobBridge is deployed on GitHub Pages. Because it is a single-page application (SPA), refreshing the browser on sub-pages like /jobs, /recruiter, or /settings may show a 404 error. This is a known limitation of GitHub Pages. To navigate to these pages, always use the in-app links (navigation menu, buttons) rather than typing URLs directly or refreshing. Alternatively, start from the home page and navigate from there.`,
  },

  // ═══════════════════════════════════════════════
  // OTHER PAGES
  // ═══════════════════════════════════════════════
  {
    id: 'games-page',
    title: 'Games & Memory Card Game',
    tags: ['entertainment', 'general'],
    pages: ['/games'],
    keywords: ['games', 'memory game', 'card game', 'memory card', 'play game', '/games', 'fun', 'entertainment'],
    content: `The Games page at /games features a memory card matching game. Flip cards to find matching pairs. The game includes: Web Audio API sound effects for flip, match, mismatch, and win events. A streak completion popup shows "Excellent Job! You are on a Streak!" with bounce-in animation when you complete a streak. Timer tracks your performance. This is a fun break feature while you browse for jobs.`,
  },
  {
    id: 'analytics-page',
    title: 'Platform Analytics',
    tags: ['general', 'business'],
    pages: ['/analytics'],
    keywords: ['analytics', 'statistics', 'platform stats', 'data', 'insights', '/analytics', 'job market data'],
    content: `The Analytics page at /analytics provides insights into the JobBridge platform. It displays data visualizations and statistics about job market trends, popular categories, user growth, and other platform metrics. This page helps users understand the job market landscape through data-driven insights.`,
  },
  {
    id: 'about-page',
    title: 'About JobBridge',
    tags: ['general'],
    pages: ['/about'],
    keywords: ['about', 'about us', 'about jobbridge', 'company info', '/about', 'team', 'our story'],
    content: `The About page at /about shares the JobBridge story, mission, and values. It covers the platform's origin, founding by Victor Eniola in 2021, backing by Y Combinator, Sequoia Capital, and a16z, the vision of democratizing career opportunities across Africa, and key milestones. The page includes company values and the team's commitment to using AI to transform hiring in Nigeria and beyond.`,
  },
  {
    id: 'privacy-center',
    title: 'Privacy Center',
    tags: ['security', 'legal'],
    pages: ['/privacy', '/about'],
    keywords: ['privacy center', 'privacy policy', 'data policy', 'terms of service', 'legal', 'compliance', 'gdpr', 'ndpr', 'data protection'],
    content: `The Privacy Center at /privacy explains how JobBridge handles your personal data. Sections include: What Information We Collect (name, email, phone, profile details, resume, payment info through Paystack), How We Use Your Information (account creation, job matching, AI features, payments), Information Sharing (never sold to third parties, shared only with Paystack, OpenAI, Supabase, and Resend under contract), Data Storage & Security (encrypted at rest and in transit on Supabase, hashed passwords), Your Rights & Choices (view, edit, or delete your data anytime), and Cookies & Tracking (only essential cookies and local storage — no third-party tracking). For specific questions, email jobbridgesupport@gmail.com.`,
  },
  {
    id: 'messages-page',
    title: 'Messages / Inbox',
    tags: ['general', 'messaging'],
    pages: ['/messages'],
    keywords: ['messages', 'inbox', 'conversations', 'chat', 'messaging', '/messages', 'employer messages', 'recruiter messages', 'direct messages'],
    content: `The Messages page at /messages is your inbox for conversations with employers and recruiters. It shows a list of conversation threads with company names, logos, last message previews, and timestamps. Unread messages are indicated with a badge count. Opening a thread shows the full conversation history with sent and received messages. Messages time-stamped with dates and read receipts (double check marks). New conversations may be locked until a recruiter initiates contact, shown with a lock icon. The page includes a search bar to filter conversations and a mobile-friendly layout that slides the chat panel over the conversation list.`,
  },
  {
    id: 'notifications-page',
    title: 'Notifications & Alerts',
    tags: ['general', 'notifications'],
    pages: ['/notifications'],
    keywords: ['notifications', 'alerts', 'notification history', 'job alerts', 'activity feed', '/notifications', 'unread notifications', 'notification settings'],
    content: `The Notifications page at /notifications shows your full notification history and job alert subscriptions. It displays all activity updates grouped by type: Job Applications (status changes on your applications), Messages (new messages from employers), Interviews (interview invitations and schedule updates), Reviews (profile reviews and endorsements), System Notifications (account updates and security alerts), Payments (payment confirmations and subscription updates), and Advert Notifications (business ad performance). Each notification shows its type icon, title, content preview, and time. Unread notifications are highlighted. You can mark individual notifications as read or delete them. The page also has a Job Alerts section where you can create and manage keyword-based search alerts that notify you when new matching jobs are posted.`,
  },
];

export default KB;
