export interface KnowledgeSection {
  id: string;
  title: string;
  keywords: string[];
  tags: string[];
  pages: string[];
  content: string;
}

const KB: KnowledgeSection[] = [
  // ═══════════════════════════════════════════════════════════════
  //  1. PLATFORM OVERVIEW
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'platform-overview',
    title: 'Platform Overview',
    tags: ['general', 'onboarding', 'company'],
    pages: ['/', '/about'],
    keywords: ['what is jobbridge', 'about jobbridge', 'platform overview', 'what does jobbridge do', 'jobbridge features', 'introduction', 'jobbridge platform', 'professional network', 'what is this', 'jobbridge explained', 'tell me about jobbridge', 'job bridge', 'job bridge platform', 'overview', 'features of jobbridge', 'what can i do on jobbridge', 'platform capabilities', 'what jobbridge offers', 'key features'],
    content: `### What is JobBridge?
JobBridge is Nigeria's number one professional network connecting job seekers, recruiters, and service providers on one unified platform. Founded in 2021 by Victor Eniola and backed by Y Combinator, Sequoia Capital, and Andreessen Horowitz (a16z).

### Who can use JobBridge?
- **Job Seekers** — Browse and apply to jobs, use AI resume tools, track applications, save jobs
- **Recruiters** — Post jobs, review and score applicants with AI candidate ranking, manage hiring pipeline
- **Service Providers** — Create professional profiles, offer services in engineering, design, marketing, finance, legal, photography, writing, and consulting
- **Business Owners** — Create advertisements to promote products and services

### Key Features
- AI-powered job matching and candidate ranking
- Verified employers and real-time talent search
- AI Resume Builder with skills extraction, cover letter generator, and interview preparation
- Recruiter dashboard with candidate scoring
- Service provider marketplace
- Business advertisement platform
- Premium subscription plans for recruiters, AI tools, and featured listings

### Platform Accessibility
JobBridge is a Progressive Web App (PWA) accessible from any browser on desktop or mobile. It can be installed on your device for a native app-like experience. The platform is committed to inclusive hiring with optional fields for disability status and internally displaced persons, plus an inclusion note: "Inclusion is our culture. We champion all talent: women, men, displaced, and PWDs."

For more details, visit the home page at / or the About page at /about.`,
  },
  {
    id: 'company-mission',
    title: 'Company Mission & History',
    tags: ['general', 'company', 'about'],
    pages: ['/', '/about', '/ceo'],
    keywords: ['mission', 'vision', 'company history', 'founder', 'victor eniola', 'ceo', 'founded', 'history', 'backed', 'investors', 'y combinator', 'sequoia capital', 'a16z', 'andreessen horowitz', 'company story', 'founding story', 'who founded', 'who created', 'when was', 'founded in', 'company values', 'core values'],
    content: `### Founding & History
JobBridge was founded in 2021 by **Victor Eniola**, who serves as CEO and Founder. The company was created to address the challenges of finding quality career opportunities in Nigeria and across Africa.

### Investors & Backing
The platform is backed by major Silicon Valley investors:
- **Y Combinator** — prestigious startup accelerator
- **Sequoia Capital** — leading venture capital firm
- **Andreessen Horowitz (a16z)** — one of the largest VC firms globally

### Mission & Vision Pillars
- **Democratizing Opportunity** — making career tools accessible to everyone regardless of background
- **AI-First Approach** — leveraging artificial intelligence to improve hiring and career development
- **Global Impact** — expanding from Nigeria to serve users across 50+ countries

### Core Values
Innovation, inclusion, transparency, and impact guide every feature and decision.

### CEO Vision Page
Visit /ceo to watch a personal video message from Victor Eniola sharing his journey, the company roadmap, milestones, and values. You can also leave encouraging messages directly for the CEO.`,
  },
  {
    id: 'tech-stack',
    title: 'Technology Stack & Architecture',
    tags: ['general', 'technical', 'development'],
    pages: [],
    keywords: ['technology', 'tech stack', 'built with', 'react', 'supabase', 'vite', 'typescript', 'openai', 'paystack', 'github pages', 'tailwind css', 'architecture', 'how built', 'framework', 'database', 'backend', 'frontend', 'hosting', 'infrastructure', 'technical architecture'],
    content: `### Frontend
- **React 18** with TypeScript for type safety
- **Vite** as the build tool for fast development and optimized production builds
- **Tailwind CSS** for styling
- **React Router v6** for client-side routing (SPA — page transitions happen instantly without full reloads)

### Backend & Database
- **Supabase** — provides PostgreSQL database, authentication (email/password), storage for file uploads (CVs, resumes), and Row Level Security (RLS) for data protection

### AI Features
- **OpenAI GPT-4o-mini** — powers the AI Assistant chat widget
- **text-embedding-3-small** — for embeddings (retrieval)

### Payments
- **Paystack** — handles all payment processing, supporting Nigerian cards (Visa, Mastercard, Verve) and bank transfers

### Hosting & Deployment
- **GitHub Pages** — application hosting with Apache .htaccess for SPA routing
- **LiteSpeed** — web server with SSL, HSTS, Content Security Policy, and browser caching

### Emails & Notifications
- Supabase Edge Function integrating with the **Resend API**`,
  },
  {
    id: 'supported-regions',
    title: 'Supported Regions & Currencies',
    tags: ['general', 'pricing', 'regions'],
    pages: ['/pricing'],
    keywords: ['regions', 'countries', 'currencies', 'ngn', 'naira', 'nigeria', 'supported countries', 'where available', 'location', 'west africa', 'currency', 'nigerian naira', 'africa', 'available in', 'which countries', 'geographic', 'supported regions'],
    content: `### Primary Service Area
JobBridge primarily serves **Nigeria** and **West Africa**. While the platform is accessible globally as a web app and PWA, job listings and service providers are primarily Nigeria-focused.

### Currency
All pricing is in **Nigerian Naira (NGN)** with the symbol **₦**. All amounts throughout the platform are denominated in Naira.

### International Payments
Users can make payments from anywhere in the world using international cards through Paystack, but all amounts are in Nigerian Naira. Paystack supports Visa, Mastercard, Verve, and bank transfers.`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  2. AUTHENTICATION & ACCOUNT
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'signup-flow',
    title: 'Sign Up / Registration',
    tags: ['auth', 'account', 'onboarding'],
    pages: ['/signup'],
    keywords: ['sign up', 'signup', 'register', 'create account', 'join', 'registration', 'new account', 'how to sign up', 'create profile', 'get started', 'make account', 'open account', 'become member', 'enroll', 'register now', 'sign up page', '/signup page', 'signup form', 'create new account', 'how do i sign up', 'how to register', 'create jobbridge account'],
    content: `### How to Sign Up
1. Go to the **Sign Up page** at **/signup**
2. Select your desired role by clicking one of three role cards:
   - **Job Seeker** — browse and apply to jobs (recommended, marked with a badge)
   - **Recruiter** — post jobs and hire talent
   - **Service Provider** — offer professional services
3. Fill in the registration form:
   - Full name
   - Email address
   - Password (minimum 6 characters)
4. Agree to the Terms of Service by checking the checkbox
5. Click **"Create Account"** to complete registration

### After Signup
- You are automatically signed in and redirected to the home page
- A green success toast says "Account created successfully! Complete your profile."
- No email verification is required — you are signed in instantly
- You are encouraged to complete your profile at **/profile**

### Validation
The signup form includes client-side validation with error messages for invalid inputs. If you already have an account, click "Sign in" at the bottom to go to **/login**.`,
  },
  {
    id: 'login-flow',
    title: 'Sign In / Login',
    tags: ['auth', 'account'],
    pages: ['/login'],
    keywords: ['login', 'sign in', 'log in', 'signin', 'sign into account', 'how to login', 'welcome back', 'login page', '/login page', 'sign in form', 'email and password', 'login form', 'authentication', 'sign in to my account', 'how do i login', 'cant login'],
    content: `### How to Sign In
1. Go to the **Login page** at **/login**
2. Enter your registered **email address** and **password**
3. Click **"Sign In"**

### Login Features
- Password field has an eye toggle icon to show or hide your password
- Authentication is handled securely by **Supabase**
- After successful login, you are redirected to the home page

### Security & Rate Limiting
- After 5 failed login attempts within a time window, you must wait before trying again
- After 30 minutes of inactivity, you are automatically signed out for security

### Forgot Password
Click the **"Forgot Password"** link on the login page to receive a password reset email. If you don't have an account, click "Create one" to go to **/signup**.`,
  },
  {
    id: 'logout-flow',
    title: 'Sign Out / Logout',
    tags: ['auth', 'account'],
    pages: [],
    keywords: ['logout', 'sign out', 'log out', 'how to logout', 'signout', 'sign out button', 'log off', 'sign off', 'end session', 'log me out', 'how do i sign out', 'sign out of jobbridge'],
    content: `### How to Sign Out
1. Click your **profile avatar icon** in the top-right area of the header navigation bar
2. In the dropdown menu that opens, click **"Sign out"** at the bottom

### What Happens
- Your Supabase authentication session is cleared from local storage
- You are redirected to the home page
- You will need to sign in again to access protected features (your profile, applications, recruiter dashboard, etc.)`,
  },
  {
    id: 'password-reset',
    title: 'Password Reset & Change',
    tags: ['auth', 'account', 'security'],
    pages: ['/login', '/profile'],
    keywords: ['forgot password', 'reset password', 'change password', 'password recovery', 'forgot', 'lost password', 'cannot login', 'reset my password', 'forget password', 'update password', 'new password', 'change my password', 'reset link', 'password reset email', 'how to reset password', 'reset my login'],
    content: `### If You Forgot Your Password
1. Go to the **Login page** at **/login**
2. Click the **"Forgot Password"** link below the sign-in button
3. Supabase sends a password reset link to your registered email
4. Check your inbox and **spam folder** for the email
5. Click the link and follow instructions to set a new password
6. Sign in with your new password immediately

### If You Are Signed In (Change Password)
1. Go to your **Profile page** at **/profile**
2. Scroll to the **"Account Security"** section
3. Enter your **current password** and your **new password**
4. Click **"Update Password"** to save
5. Your password is updated immediately`,
  },
  {
    id: 'account-deletion',
    title: 'Account Deletion',
    tags: ['auth', 'account', 'danger', 'privacy'],
    pages: ['/profile'],
    keywords: ['delete account', 'close account', 'remove account', 'cancel account', 'delete my data', 'account deletion', 'delete profile', 'remove my account', 'erase account', 'permanently delete', 'delete my account permanently', 'how to delete', 'can i delete', 'deactivate account', 'close my account'],
    content: `### How to Delete Your Account
1. Go to your **Profile page** at **/profile**
2. Scroll to the bottom to find the **"Danger Zone"** section
3. Click the red **"Delete Account"** button
4. A confirmation modal explains this action is permanent and cannot be undone
5. **Contact jobbridgesupport@gmail.com** to request account deletion
6. A platform administrator will assist you with the deletion process

### What Gets Deleted
All your data is permanently deleted:
- Profile information
- Job applications
- Saved jobs
- Any other personal data

### Important
Once deleted, you lose access permanently and must create a new account if you want to use JobBridge again.`,
  },
  {
    id: 'user-roles',
    title: 'User Roles & Permissions',
    tags: ['auth', 'account', 'roles'],
    pages: ['/signup'],
    keywords: ['roles', 'user types', 'job seeker', 'recruiter', 'service provider', 'admin', 'account types', 'permissions', 'what can i do', 'user role', 'change role', 'switch role', 'role types', 'different roles', 'types of accounts', 'account types explained', 'difference between roles', 'which role should i choose'],
    content: `### Job Seeker
- Browse and view all job listings
- Apply to jobs using the 3-step application form
- Save and bookmark jobs for later
- Use AI resume tools (skills extraction, resume tailoring, cover letter, interview prep)
- Track application statuses on the My Jobs page
- Maintain a professional profile

### Recruiter
- Post new job openings
- Manage and edit job postings
- Review incoming applications in the Applications Panel
- Use AI-powered candidate ranking (score applicants by match percentage)
- Use the AI Job Description Writer
- Track subscription status and job credits
- Shortlist, review, reject, or hire candidates

### Service Provider
- Create a professional service profile
- Offer services in categories like engineering, design, marketing, finance, legal
- Receive client inquiries
- Upgrade to featured placement for more visibility
- Manage portfolio and availability

### Admin
- Manage the entire platform through the Admin Dashboard
- User management with suspend and activate controls
- Job moderation with approve and reject capabilities
- Service provider approval
- Platform analytics oversight

### Changing Your Role
You choose your role during signup at **/signup** by clicking one of the role cards. To change your role after signup, email **jobbridgesupport@gmail.com**.`,
  },
  {
    id: 'session-management',
    title: 'Session & Auto-Logout',
    tags: ['auth', 'technical', 'account'],
    pages: [],
    keywords: ['session', 'auto logout', 'inactivity', 'timeout', 'signed out automatically', 'keep me signed in', 'session timeout', 'auto sign out', 'logged out automatically', 'keeps logging me out', 'inactivity timeout', '30 minutes', 'session expiry', 'why am i logged out'],
    content: `### How Sessions Work
- When you sign in, a **session token** is stored in your browser's local storage
- Your session persists until you manually sign out or after **30 minutes of inactivity**
- On page refresh, your session is automatically restored from Supabase's stored session token

### When the Timer Resets
The inactivity timer resets whenever you:
- Click your mouse
- Press a key
- Touch the screen (on mobile)
- Scroll the page
- Move the mouse

### What Happens on Expiry
- You are automatically signed out
- You are redirected to the home page
- You need to sign in again

### Frequent Sign-Outs?
If you are being signed out frequently, you may be leaving the page idle for more than 30 minutes.`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  3. HOME PAGE
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'home-page',
    title: 'Home Page',
    tags: ['general', 'navigation'],
    pages: ['/'],
    keywords: ['home page', 'home', 'landing page', 'main page', 'front page', 'homepage', 'jobbridge home', 'index page', 'what is on home page', 'whats on the home page', 'home page content', 'jobbridge homepage'],
    content: `### Hero Section
The home page at **/** features a hero section with:
- Headline: **"Find Your Dream Job"**
- Sub-headline about connecting talent with opportunity across Nigeria
- **"Find Jobs"** button (links to /jobs) for job seekers
- **"Post a Job"** button (links to /pricing) for recruiters

### Stats Section
Animated counters displaying platform metrics:
- 10K+ Jobs Posted
- 5K+ Companies
- 15K+ Hired
- 50K+ Job Seekers

### How It Works
A 3-step process for job seekers:
1. **Create Profile** — Sign up and complete your profile
2. **Find Jobs** — Browse and search for matching opportunities
3. **Apply & Get Hired** — Submit applications and get hired

### Featured Jobs Carousel
Showcases highlighted job listings showing company, title, location, type, and salary. Testimonials from satisfied users like Sarah Johnson and Michael Adewale are displayed.

### Additional Sections
- **Trusted Company Badges** — partner logos
- **Newsletter Signup** — subscribe for weekly job alerts
- **CTA Banner** — encourages employers to start hiring (links to /pricing)
- **Footer** — links to all major pages, social media connections, copyright info

For authenticated users, the home page includes quick access to dashboard-relevant sections.`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  4. JOBS PAGE
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'jobs-browse',
    title: 'Browsing & Searching Jobs',
    tags: ['jobs', 'job-seeker'],
    pages: ['/jobs'],
    keywords: ['browse jobs', 'search jobs', 'find jobs', 'job search', 'look for jobs', 'jobs page', 'view jobs', 'job listings', 'search bar', 'filter jobs', 'job filters', 'find a job', 'looking for a job', 'search for job', 'browse all jobs', 'all jobs', '/jobs page', 'job search page', 'job browsing', 'how to find a job', 'find job opportunities'],
    content: `### Page Layout
The Jobs page at **/jobs** uses a split-panel layout:
- **Left panel** — scrollable list of job cards
- **Right panel** — full job details when a card is clicked

### Job Cards
Each job card shows:
- Company name
- Job title
- Location
- Job type: Full-time, Part-time, Contract, Internship, Freelance
- Salary range (when provided)
- Benefit tags
- Bookmark icon (ribbon/flag) in the top-right corner

Featured jobs display a pink **"Featured"** badge for premium listings.

### Search & Filters
- **Search bar** at the top — search by job title, company name, or keywords
- **Location filter** — filter by city or region
- **Job Type filter** — select Full-time, Part-time, Contract, Internship, or Freelance
- **Category filter** — narrow by industry or job function
- Results update in **real time** as you type or change filters
- Total number of matching jobs displayed above the results

### Job Detail Panel
When you click a job card, the right panel shows:
- Complete job description
- Requirements list
- Benefits list
- Required skills
- **"Apply Now"** button`,
  },
  {
    id: 'jobs-apply',
    title: 'Applying to Jobs (3-Step Form)',
    tags: ['jobs', 'job-seeker', 'application'],
    pages: ['/jobs'],
    keywords: ['apply', 'application', 'apply for job', 'how to apply', 'submit application', 'job application process', 'apply now', 'apply to job', 'submit application', 'job application form', 'application steps', '3 step application', 'how do i apply', 'applying for a job', 'submitting application', 'application process', 'apply for a job on jobbridge', 'how to apply for a job'],
    content: `### How to Apply
1. On the **Jobs page** at **/jobs**, click the job you want
2. Click the **"Apply Now"** button on the job detail panel
3. Complete the inline 3-step application form

### Step 1 — Personal Information
- Date of birth
- Gender: Male, Female, or Prefer not to say
- Disability status: Yes, No, or Prefer not to say
- Internally displaced person status: Yes, No, or Prefer not to say
- Professional headline
- Years of experience
- Function or industry

### Step 2 — Preferences
- Preferred work type: Remote, On-site, or Hybrid
- Highest qualification: Secondary School through Doctorate
- Current location
- Availability: Immediately, 2 weeks, 1 month, or 3 months
- Monthly salary expectation (in Nigerian Naira)

### Step 3 — Documents
- Upload your CV or resume in **PDF, DOC, DOCX, or RTF** format
- Maximum file size: **10MB**
- Files stored securely in **Supabase Storage**
- Optional cover letter in the text area

### After Submitting
- A success confirmation toast appears
- The button changes to "Applied" with a check mark
- The application is recorded in the database
- The recruiter will review your application and update its status`,
  },
  {
    id: 'jobs-save',
    title: 'Saving & Bookmarking Jobs',
    tags: ['jobs', 'job-seeker'],
    pages: ['/jobs', '/my-jobs'],
    keywords: ['save job', 'bookmark', 'saved jobs', 'unsave', 'bookmark job', 'save for later', 'save jobs', 'bookmark icon', 'saved jobs list', 'unsave job', 'remove saved job', 'bookmark this job', 'save a job', 'bookmark a job'],
    content: `### How to Save a Job
- Click the **bookmark icon** (ribbon or flag shape) in the top-right corner of any job card or detail panel
- The icon fills with **blue color** to indicate the job is saved
- Saved jobs are stored in your browser's local storage under the key **jb_saved_jobs**

### Viewing Saved Jobs
1. Go to the **My Jobs page** at **/my-jobs**
2. Open the **"Saved" tab**
3. Each saved card shows: company, title, location, type, and a filled blue bookmark icon

### Managing Saved Jobs
- Click the bookmark icon again to **unsave** (removes from saved list)
- Click any job card to **view details** and apply directly
- The header navigation shows a **badge count** of total saved jobs
- Jobs you have already applied to show an **"Applied" badge** and cannot be applied to again`,
  },
  {
    id: 'my-jobs-page',
    title: 'My Jobs Dashboard (Track Applications)',
    tags: ['jobs', 'job-seeker', 'tracking'],
    pages: ['/my-jobs'],
    keywords: ['my jobs', 'my jobs page', 'track applications', 'my applications', 'job tracker', '/my-jobs', 'applied jobs', 'saved jobs tab', 'application tracker', 'track my applications', 'where are my applications', 'application status', 'my applications page', 'how to track applications', 'application history'],
    content: `### Overview
The My Jobs page at **/my-jobs** is your personal job activity dashboard organized into **four tabs**.

### Saved Tab
- Displays all bookmarked jobs
- Unsave jobs or click to view details and apply

### Applied Tab
Shows all jobs you have applied to with status badges:
- **Pending** (yellow) — Submitted, awaiting recruiter review
- **Reviewed** (blue) — Recruiter has viewed your application
- **Shortlisted** (green) — You have been shortlisted for further consideration
- **Rejected** (red) — Recruiter decided not to move forward
- **Hired** (emerald) — You have been offered the position

### Interviews Tab
Shows upcoming interviews (feature coming soon).

### Archived Tab
For archived jobs (feature coming soon).

### Other Features
- Search within each tab using the search bar
- Click any job to view full details on the right panel
- Data pulled from local storage (saved jobs) and database (applications)`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  5. RECRUITER DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'recruiter-dashboard',
    title: 'Recruiter Dashboard',
    tags: ['recruiter', 'dashboard', 'hiring'],
    pages: ['/recruiter'],
    keywords: ['recruiter', 'recruiters', 'recruiter dashboard', 'recruiter page', 'recruiter tools', 'recruiter panel', 'recruiter features', '/recruiter', 'recruiting', 'recruiter home', 'recruiter command center', 'recruiter overview', 'recruiter page help', 'how to use recruiter dashboard'],
    content: `### Overview
The Recruiter Dashboard at **/recruiter** is the command center for all recruiting activities.

### Stats Section
- **Active Jobs** — how many jobs are currently live
- **Total Candidates** — total applicants across all jobs
- **Interviews** — interview-stage candidates
- **Offers** — candidates who have been hired

### Subscription Status
Your current plan tier (Basic, Standard, or Premium), remaining job credits, and subscription expiration date. If no active subscription, a prompt directs you to **/pricing**.

### Primary Actions
- **"Post New Job"** — opens a form to create a new listing (requires active subscription with credits)
- **"AI Write Description"** — opens AI tool to generate optimized job descriptions

### Job Postings List
Each job shows: title, applicant count, status, creation date, and actions (Edit, Deactivate).

### Applications Panel (Bottom)
Shows all incoming applications with filterable tabs: All, Pending, Shortlisted, Reviewed, Rejected.`,
  },
  {
    id: 'post-job',
    title: 'Posting a New Job',
    tags: ['jobs', 'recruiter'],
    pages: ['/recruiter'],
    keywords: ['post job', 'create job', 'job posting', 'publish job', 'post a job', 'create job listing', 'how to post a job', 'new job', 'add job', 'post new job', 'create new job', 'job post form', 'job posting form', 'job creation', 'how do i post a job', 'advertise a job'],
    content: `### Requirements
- Active subscription with available job credits
- Each job posting consumes **one credit** regardless of plan tier

### How to Post a Job
1. Go to the **Recruiter Dashboard** at **/recruiter**
2. Click **"Post New Job"**
3. Fill in the form fields:
   - **Job Title** — position name
   - **Company Name** — your company or organization
   - **Job Description** — detailed description of the role, responsibilities, and requirements
   - **Location** — where the job is based
   - **Job Type** — Full-time, Part-time, Contract, Freelance, or Internship
   - **Salary Range** — optional range (e.g., 200000-400000)
   - **Category** — industry or function
   - **Requirements** — comma-separated list of qualifications and skills
   - **Benefits** — comma-separated list of benefits offered
4. Click **"Publish Job"** to make it live

### After Posting
- The job immediately appears on the Jobs page at **/jobs**
- You can edit or deactivate the job anytime from the recruiter dashboard`,
  },
  {
    id: 'ai-jd-writer',
    title: 'AI Job Description Writer',
    tags: ['ai', 'recruiter', 'jobs'],
    pages: ['/recruiter'],
    keywords: ['ai job description', 'jd writer', 'ai write description', 'job description generator', 'generate job description', 'ai jd', 'write jd', 'ai generate description', 'job description ai', 'generate description ai', 'ai powered description', 'ai job description writer', 'generate job description ai'],
    content: `### How to Use
1. Ensure you have an **active recruiter subscription** with available credits
2. Click the **"AI Write Description"** button on the Recruiter Dashboard
3. A modal opens where you enter:
   - **Job title**
   - Up to **3 core requirements** or responsibilities
4. Click **"Generate Description"**

### What It Creates
The AI generates a complete job description with sections:
- **Job Summary**
- **Key Responsibilities**
- **Requirements and Qualifications**
- **Benefits and Perks**

The description is optimized to attract quality candidates and reduce unconscious bias.

### After Generation
- Review the generated description
- Make any edits or adjustments
- Click **"Publish This Job"** to post it directly as a new listing`,
  },
  {
    id: 'applications-panel',
    title: 'Applications Panel & Candidate Management',
    tags: ['recruiter', 'jobs', 'candidates'],
    pages: ['/recruiter'],
    keywords: ['applications panel', 'review applications', 'manage applications', 'shortlist', 'shortlisted', 'reject candidate', 'hire candidate', 'application status', 'candidates', 'applicant management', 'review applicant', 'view application', 'candidate details', 'applicant details', 'how to review applicants', 'manage candidates'],
    content: `### Viewing Applicants
Each applicant card displays:
- Candidate name
- Professional headline
- Function or industry
- Location
- Years of experience
- Salary expectation
- Application status badge

### Filtering by Status
- **All** — every application
- **Pending** — new unread applications
- **Shortlisted** — candidates marked as promising
- **Reviewed** — applications you have acknowledged
- **Rejected** — declined candidates

### Candidate Details
Click any application card to expand and view:
- Date of birth, gender, disability status
- Experience details, function, work type preference
- Highest qualification, location, availability, salary expectation
- Cover letter text
- Download link for uploaded CV/resume

### Actions
- **Shortlist** — mark for further review
- **Mark Reviewed** — acknowledge review
- **Reject** — decline the candidate
- **Hire** — offer the position

Status updates are immediately visible to the candidate on their **My Jobs page** at **/my-jobs**.`,
  },
  {
    id: 'ai-candidate-ranking',
    title: 'AI Candidate Ranking (Score Matching)',
    tags: ['ai', 'recruiter', 'candidates'],
    pages: ['/recruiter'],
    keywords: ['ai rank', 'candidate scoring', 'score candidates', 'ai candidate ranking', 'rank candidates', 'match score', 'ai ranking', 'candidate matching', 'ai score', 'candidate ranking', 'ai match', 'score applicants', 'rank applicants', 'rank candidates by ai', 'ai candidate matching'],
    content: `### How It Works
The AI Candidate Ranking feature automatically scores all your candidates against the job requirements for each posting.

### How to Use
1. Click the **"AI Rank"** button on your Recruiter Dashboard
2. The AI analyzes each candidate's profile, experience, skills, and qualifications
3. Each candidate receives a **match percentage score** from 0 to 100%

### Score Color Indicators
- **Green (80%+)**: Excellent fit — strong alignment with requirements
- **Amber (60-79%)**: Potential fit — worth reviewing further
- **Red (below 60%)**: Weak match — candidate may not fit well

### Benefits
- Candidates are sorted by score (highest first)
- Quickly identify the strongest applicants
- Click the AI Rank button anytime new applications arrive to get updated scores
- Eliminates manual review of every application`,
  },
  {
    id: 'manage-jobs',
    title: 'Managing Job Postings',
    tags: ['jobs', 'recruiter'],
    pages: ['/recruiter'],
    keywords: ['manage jobs', 'edit job', 'delete job', 'deactivate job', 'job management', 'edit posting', 'close job', 'remove job', 'hide job', 'job actions', 'edit my job', 'update job', 'modify job', 'how to edit a job', 'how to close a job'],
    content: `### Job List View
Each job in your list displays:
- Title
- Applicant count
- Current status (Active or Deactivated)
- Creation date

### Edit a Job
Click **"Edit"** to modify:
- Title, description, location, type, salary
- Requirements and benefits
- Changes saved immediately and reflected on the public Jobs page

### Deactivate a Job
Click **"Deactivate"** to temporarily remove a job from public listings without deleting it. Deactivated jobs can be **reactivated** by clicking "Activate".

### Delete a Job
Permanently removes the job and all its associated applications from the platform.

Deactivated jobs appear in your dashboard with a "Deactivated" label so you can track your full posting history.`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  6. AI FEATURES
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'ai-assistant',
    title: 'AI Assistant Chat Widget',
    tags: ['ai', 'support', 'assistant'],
    pages: [],
    keywords: ['ai assistant', 'chatbot', 'ai chat', 'help widget', 'assistant', 'ai helper', 'support chat', 'ai widget', 'ask ai', 'jobbridge ai', 'chat widget', 'ai chatbot', 'virtual assistant', 'ask a question', 'help bot', 'ai support', 'intelligent assistant', 'ask jobbridge', 'how to use ai assistant', 'jobbridge chatbot'],
    content: `### How to Access
Look for the **robot icon** or **chat icon** in the bottom-right corner of any page. Click it to open the chat panel.

### What It Can Answer
- JobBridge features and functionality
- Pricing and subscription plans
- How-to guides and step-by-step instructions
- Platform navigation help
- Troubleshooting common issues
- General platform information

### How It Works
The assistant uses a comprehensive knowledge base combined with **OpenAI's GPT-4o-mini** (when configured) for natural, conversational responses.

### Processing Indicators
While processing your question, it shows:
- **"Analyzing your question"** — interpreting what you are asking
- **"Searching knowledge base"** — finding relevant information
- **"Generating response"** — formulating the answer

### Features
- **Source badges** at the bottom of each answer show which knowledge sections were used
- **Suggested prompts** below the chat input based on your current page
- **Clear conversation** button to reset history
- Remembers the last **20 messages** for context
- **Retry button** if a response fails
- Works in **fallback mode** without an API key, using the built-in knowledge base`,
  },
  {
    id: 'ai-resume-studio',
    title: 'AI Resume Studio (4 Tools)',
    tags: ['ai', 'job-seeker', 'resume'],
    pages: ['/ai-resume'],
    keywords: ['ai resume studio', 'ai resume page', '/ai-resume', 'resume tools', 'ai resume tools', 'resume studio', 'ai powered resume', 'resume builder', 'ai resume builder', 'resume optimizer', 'resume generator', 'ai resume services', 'how to use ai resume', 'resume help', 'cv tools', 'ai cv tools'],
    content: `### Tool 1 — Skills Extraction (Free)
- Analyze your resume text or uploaded CV file
- Automatically identifies and organizes your skills into categories:
  - Technical Skills
  - Soft Skills
  - Languages
  - Certifications
- **Free for all users** — no AI subscription required

### Tool 2 — AI Tailor Resume (Requires AI Subscription)
- Paste your resume text and the job description
- The AI adjusts your resume to highlight relevant experience and keywords
- Improves your chances of passing Applicant Tracking Systems (ATS)
- **1500 Naira/month** or **15000 Naira/year**

### Tool 3 — AI Cover Letter Generator (Requires AI Subscription)
- Paste the job description and your resume
- Click "Generate Cover Letter"
- The AI produces a professional customized cover letter
- **1500 Naira/month** or **15000 Naira/year**

### Tool 4 — AI Interview Preparation (Requires AI Subscription)
- Get industry-specific interview questions
- Practice your responses
- Receive AI feedback on your answers
- **1500 Naira/month** or **15000 Naira/year**

### File Upload
Upload CV files in **TXT, PDF, DOC, or DOCX** format to populate the resume text area for any tool.`,
  },
  {
    id: 'ai-subscription',
    title: 'AI Tools Subscription Plans',
    tags: ['ai', 'pricing', 'subscription'],
    pages: ['/pricing', '/ai-resume'],
    keywords: ['ai subscription', 'ai tools pricing', 'ai monthly', 'ai annual', 'ai resume subscription', 'unlock ai', 'ai features payment', 'ai tools cost', 'ai plan', 'buy ai subscription', 'activate ai tools', 'ai tools price', 'how much for ai', 'ai resume cost', 'ai tools payment', 'ai subscription plans', 'ai career tools'],
    content: `### What Needs a Subscription
- AI Tailor Resume
- AI Cover Letter Generator
- AI Interview Preparation

### What Is Free
- **Skills Extraction** — completely free
- **AI Assistant chat widget** — always free for all users

### Subscription Options
- **Monthly**: 1500 Naira per month (30 days access)
- **Annual**: 15000 Naira per year (365 days — saves ~17% vs monthly)

### How to Purchase
1. Go to the **Pricing page** at **/pricing**
2. Select **"AI Career Tools Monthly"** or **"AI Career Tools Annual"**
3. Complete payment through Paystack
4. Access is activated immediately after successful payment

### Check Your Status
Your AI subscription status is shown on the **Settings page** at **/settings** under the Premium section.`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  7. PRICING & PAYMENTS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'pricing-overview',
    title: 'Pricing Plans Overview',
    tags: ['pricing', 'subscription', 'plans'],
    pages: ['/pricing'],
    keywords: ['pricing', 'plans', 'subscription', 'pricing page', 'cost', 'how much', 'fees', 'plans and pricing', 'plan prices', 'pricing plans', 'all plans', 'plan comparison', 'compare plans', 'what plans are available', 'pricing options', 'plan prices in naira', 'jobbridge pricing', 'how much does it cost', 'subscription cost'],
    content: `### Recruiter Job Posting Plans
| Plan | Price | Duration | Credits |
|------|-------|----------|---------|
| Basic | 2000 Naira | 7 days | 1 job credit |
| Standard | 3500 Naira | 14 days | 1 job credit |
| Premium | 5000 Naira | 30 days | 3 job credits |

### AI Career Tools (Job Seekers)
- **Monthly**: 1500 Naira per month — AI Tailor Resume, Cover Letter Generator, Interview Prep
- **Annual**: 15000 Naira per year — saves ~17% compared to monthly

### Service Provider Plans
- **Monthly Listing**: Free — basic profile with standard visibility
- **Featured Professional**: 5000 Naira/month — premium placement, homepage spotlight, verified badge, priority search, featured label

### Business Advertisement Packages
- **Weekly Ad**: 2000 Naira for 7 days
- **Monthly Ad**: 7500 Naira for 30 days
- **Featured Business**: 15000 Naira for 30 days with homepage spotlight carousel

All prices are in **Nigerian Naira (₦)**. Payments processed securely through **Paystack**.`,
  },
  {
    id: 'payment-flow',
    title: 'Payment Process & Activation',
    tags: ['pricing', 'payment', 'paystack'],
    pages: ['/payment'],
    keywords: ['payment', 'pay', 'how to pay', 'paystack', 'card payment', 'bank transfer', 'payment methods', 'pay for plan', 'activate plan', 'make payment', 'payment page', '/payment', 'payment process', 'complete payment', 'purchase plan', 'how to make payment', 'payment options', 'pay for subscription'],
    content: `### How to Start
1. Go to the **Pricing page** at **/pricing**
2. Click **"Get Started"** or **"Subscribe"** on your chosen plan
3. You are redirected to **/payment?plan=planKey**

### Card Payment
1. Select the **Card** option
2. Click **"Pay NGN [amount]"**
3. Paystack's secure payment popup opens
4. Enter your card details: Visa, Mastercard, or Verve number, expiry date, CVV, cardholder name
5. Paystack handles the transaction with PCI-compliant encryption
6. After successful payment, the popup closes and your subscription activates immediately

### Bank Transfer
1. Select the **Transfer** option
2. View the bank details:
   - **Bank**: Moniepoint MFB
   - **Account Name**: JobBridge Connect Africa
   - **Account Number**: 9136171354
3. Transfer the exact amount from your bank account
4. Use the **"Copy"** button to copy the account number
5. Select your bank from the dropdown (all Nigerian commercial banks and microfinance banks)
6. Enter the payment reference or teller ID
7. Click **"Submit transfer details"**

### After Payment
- **Card**: Subscription activated immediately, confirmation email sent
- **Bank Transfer**: Recorded as pending, verified within **24 hours** by an administrator, confirmation email sent once activated`,
  },
  {
    id: 'subscription-status',
    title: 'Subscription Status & Job Credits',
    tags: ['pricing', 'recruiter', 'subscription'],
    pages: ['/recruiter', '/settings'],
    keywords: ['subscription status', 'credits', 'remaining credits', 'job credits', 'check subscription', 'active plan', 'subscription tier', 'subscription expiry', 'subscription expiration', 'how many credits', 'credits remaining', 'my plan', 'current plan', 'subscription details', 'check my subscription'],
    content: `### Where to Check
Your subscription status is displayed at the top of the **Recruiter Dashboard** at **/recruiter**. You can also check AI subscription status on the **Settings page** at **/settings** under the Premium section.

### What It Shows
- **Plan tier**: Basic, Standard, or Premium
- **Remaining job credits**: how many jobs you can still post
- **Subscription expiration date**

### How Credits Work
- Each job posting consumes **one credit** regardless of plan
- Basic and Standard: **1 credit** each
- Premium: **3 credits**

### Subscription Statuses
- **Active**: shows remaining credits and plan details
- **No active plan**: prompt to subscribe

### Purchase More or Upgrade
You can purchase more credits or upgrade your plan anytime from the **Pricing page** at **/pricing**.`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  8. SERVICE PROVIDERS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'service-provider-marketplace',
    title: 'Service Provider Marketplace',
    tags: ['providers', 'marketplace', 'services'],
    pages: ['/providers'],
    keywords: ['service provider', 'service providers', 'provider', 'providers page', 'service provider marketplace', '/providers', 'find services', 'hire provider', 'professional services', 'marketplace', 'service marketplace', 'find a provider', 'service listing', 'provider directory', 'browse providers', 'find professionals', 'hire a professional'],
    content: `### Overview
The Service Providers page at **/providers** is a marketplace to discover and connect with verified professionals.

### Service Categories
- **Engineering**: web development, mobile app development, software engineering
- **Design**: UI/UX design, graphic design, visual design
- **Marketing**: digital marketing, SEO, social media management
- **Finance**: financial analysis, accounting, bookkeeping
- **Legal**: lawyers, legal consultants
- **Photography**: event photography, portrait photography
- **Writing**: content writing, copywriting, technical writing
- **Consulting**: business consulting, career consulting

### Features
- Search by name or specialty using the search bar
- Filter by category using category buttons
- View each provider's detailed profile

### Provider Cards
Each card shows: provider name, specialty, hourly rate, location, rating stars, short description, and a **"View Profile"** button.

### Provider Profiles
Include: full description, skills list, portfolio samples, availability status, and contact options. Send an inquiry directly from their profile. Featured providers have a **"Featured"** badge and appear at the top.`,
  },
  {
    id: 'become-service-provider',
    title: 'Becoming a Service Provider',
    tags: ['providers', 'signup', 'registration'],
    pages: ['/providers', '/signup'],
    keywords: ['become provider', 'become a provider', 'offer services', 'register as provider', 'provider signup', 'provider role', 'sign up as provider', 'start as provider', 'provider registration', 'how to become provider', 'register as service provider', 'start offering services'],
    content: `### Signing Up
1. Go to **/signup** and select **"Service Provider"** as your role
2. If you already have an account with a different role, email **jobbridgesupport@gmail.com** to request a role change

### Completing Your Profile
Provide:
- Business name
- Specialty or service category
- Detailed description of your services
- Skills and expertise areas
- Hourly rate or pricing
- Location, phone number, email address
- Upload samples of your work or portfolio items

### Plans
- **Monthly Listing**: Free — basic profile with standard visibility in category listings
- **Featured Professional**: 5000 Naira/month — premium placement, homepage spotlight, verified badge, priority search, featured label

### After Approval
Your profile appears on the Providers page for potential clients to discover. Track your profile views, inquiries, and rating from your provider dashboard.`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  9. BUSINESS ADS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'business-ads',
    title: 'Business Advertisements Page',
    tags: ['business', 'advertising', 'ads'],
    pages: ['/business'],
    keywords: ['business', 'business page', 'business advertisement', 'advert', 'advertising', 'advertise', 'promote business', 'business ads', 'ad packages', 'create advert', '/business', 'ad campaign', 'business promotion', 'advertise your business', 'promote your company', 'business listing', 'how to advertise', 'promote my business'],
    content: `### Advertisement Packages
- **Weekly Ad**: 2000 Naira for 7 days
- **Monthly Ad**: 7500 Naira for 30 days
- **Featured Business**: 15000 Naira for 30 days with homepage spotlight carousel placement

### How to Create an Ad
1. Click **"Create Advert"** on the Business page at **/business**
2. Fill in the form:
   - Business name
   - Attention-grabbing title
   - Detailed description of products or services
   - Category
   - Optional: image URL, website URL, phone number, email, location
3. Select your preferred package
4. Complete payment via Paystack
5. Your ad goes live immediately

### Managing Your Ads
The **"My Adverts"** section shows all your ads with statuses:
- **Active** — currently running
- **Paused** — temporarily stopped
- **Expired** — duration completed

### Ad Actions
- Pause an active advert
- Resume a paused advert
- Edit advert content
- Delete an advert entirely

Featured adverts appear in the homepage carousel with a **"Featured"** badge.`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  10. PROFILE & SETTINGS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'profile-page',
    title: 'Profile Page (Complete Guide)',
    tags: ['account', 'profile', 'settings'],
    pages: ['/profile'],
    keywords: ['profile page', 'my profile', 'edit profile', '/profile', 'profile completeness', 'complete profile', 'update profile', 'profile settings', 'personal information', 'professional information', 'edit my profile', 'view profile', 'my account', 'account info', 'profile details', 'how to update profile', 'edit personal info'],
    content: `### Profile Completeness Meter
At the top of the page, a circular progress indicator shows your profile completion percentage. A checklist below shows what is missing to help you reach 100%.

### Personal Information
- Full name
- Email address (read-only)
- Phone number
- Date of birth
- Gender: Male, Female, or Prefer not to say
- Location or city

### Professional Information
- Professional headline (e.g., "Senior Software Engineer")
- Years of experience
- Function or industry
- Preferred work type: Remote, On-site, or Hybrid
- Highest qualification: Secondary School through Doctorate
- Availability: Immediately, 2 weeks, 1 month, or 3 months
- Monthly salary expectation (in Nigerian Naira)
- Bio or professional summary

### Inclusion & Diversity (Optional)
- Disability status
- Internally displaced person status

### Account Security
- Change password: enter current password + new password
- Two-factor authentication info
- Connected apps info

### Danger Zone
Red **"Delete Account"** button at the bottom — requires contacting support to complete.

Click **"Save Profile"** to persist changes. A success toast confirms the update.`,
  },
  {
    id: 'settings-page',
    title: 'Settings Page (All Sections)',
    tags: ['account', 'settings', 'preferences'],
    pages: ['/settings'],
    keywords: ['settings', 'settings page', '/settings', 'app settings', 'preferences', 'configure', 'settings menu', 'account settings', 'notification settings', 'privacy settings', 'premium settings', 'connected apps', 'notification preferences', 'manage notifications', 'settings help'],
    content: `### Profile Section
Shows your personal information from your main profile with options to edit: name, email, phone, location.

### Notifications Section
Toggle each notification type on or off:
- **Job Matches** — new jobs matching your profile
- **Application Updates** — application status changes
- **Messages** — new messages from employers
- **Weekly Digest** — weekly opportunity summary
- **Marketing Emails** — new features and promotions
- **SMS Alerts** — urgent notifications via SMS

Changes save immediately.

### Privacy Section
- **Profile Visibility**: Public, Connections Only, or Private
- **Search Visibility**: appear or hide from recruiter talent searches
- **Recruiter Contact**: allow or block recruiters from reaching out
- **Activity Status**: show or hide when you are online

### Premium Section
Shows your current subscription status for job posting plans and AI tools: plan tier, remaining benefits, expiration date, with option to manage or upgrade.

### Connected Apps
- Google integration — shows connected email
- LinkedIn integration — shows connected profile
- Options to disconnect each`,
  },
  {
    id: 'privacy-controls',
    title: 'Privacy Controls & Data Protection',
    tags: ['account', 'privacy', 'security'],
    pages: ['/settings'],
    keywords: ['privacy', 'privacy settings', 'profile visibility', 'who can see my profile', 'hide profile', 'private profile', 'recruiter contact', 'search visibility', 'data privacy', 'privacy options', 'profile privacy', 'make profile private', 'control who sees my profile', 'who can view my profile'],
    content: `### Profile Visibility
- **Public**: Anyone visiting JobBridge can view your profile
- **Connections Only**: Only people you have connected with
- **Private**: Hidden from everyone

### Search Visibility
Toggle whether your profile appears in recruiter talent search results.

### Recruiter Contact
Allow or block recruiters from initiating contact through the platform.

### Activity Status
Show or hide your online presence indicator from other users.

### Data Protection
- Email address and personal data encrypted at rest in Supabase database
- Never shared with third parties without explicit permission
- HTTPS encryption for all data in transit
- Passwords are hashed (bcrypt)
- Strict Content Security Policy prevents data breaches
- Data export available from the Danger Zone on your Profile page at **/profile**`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  11. SUPPORT & CONTACT
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'support-page',
    title: 'Support & Help Center',
    tags: ['support', 'help', 'faq'],
    pages: ['/support'],
    keywords: ['support', 'help', 'support page', 'help center', 'faq', 'frequently asked questions', '/support', 'customer support', 'get help', 'support center', 'common questions', 'questions and answers', 'how to get help', 'need help', 'customer service'],
    content: `### FAQ Accordion
The Support page at **/support** organizes FAQs by category:
- **Job Seekers FAQ**: how to apply, saving jobs, tracking applications, CV security, using AI features
- **Recruiters FAQ**: how to post jobs, job credits, reviewing applications, AI ranking, editing postings
- **General FAQ**: free usage, payment methods, data protection, changing roles, mobile app, PWA

Click any question to expand and read the answer.

### Direct Contact
- **Email**: jobbridgesupport@gmail.com (response within 24 hours)
- **Phone / WhatsApp**: +234 802 442 5069

### Immediate Help
For instant answers, use the **AI Assistant chat widget** available in the bottom-right corner of every page.

The **Contact page** at **/contact** provides a contact form to send a direct message.`,
  },
  {
    id: 'contact-page',
    title: 'Contact Page',
    tags: ['support', 'contact'],
    pages: ['/contact'],
    keywords: ['contact', 'contact page', 'contact us', '/contact', 'contact form', 'send message', 'get in touch', 'reach us', 'contact jobbridge', 'message us', 'support contact', 'send a message', 'contact support'],
    content: `### Contact Form
Fill in the form on the Contact page at **/contact**:
- Your full name
- Email address
- Subject
- Message
- Click **"Send Message"** to submit

Your message is sent via the platform's email system.

### Direct Contact
- **Email**: jobbridgesupport@gmail.com (typical response time: 24 hours)
- **Phone / WhatsApp**: +234 802 442 5069

### Instant Help
For immediate answers to common questions, use the **AI Assistant chat widget** in the bottom-right corner of every page.`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  12. OTHER PAGES
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'about-page',
    title: 'About JobBridge',
    tags: ['general', 'company', 'about'],
    pages: ['/about'],
    keywords: ['about', 'about us', 'about jobbridge', 'company info', '/about', 'team', 'our story', 'company story', 'who we are', 'what we do', 'about the platform', 'about jobbridge page'],
    content: `### Company Story
The About page at **/about** covers:
- **Origin**: Founded in 2021 by Victor Eniola to address career opportunity challenges in Nigeria
- **Backing**: Y Combinator, Sequoia Capital, Andreessen Horowitz (a16z)
- **Vision**: Democratizing career opportunities across Africa
- **Milestones**: Key moments in the company's journey

### Core Values
Innovation, inclusion, transparency, and impact.

### Team
The founding team is committed to using artificial intelligence to transform hiring in Nigeria and beyond. The page emphasizes the mission to build **Africa's most trusted professional network**.`,
  },
  {
    id: 'ceo-vision-page',
    title: 'CEO Vision Page',
    tags: ['general', 'company', 'ceo'],
    pages: ['/ceo'],
    keywords: ['ceo vision', 'ceo message', 'founder message', 'victor eniola vision', 'leadership', 'jobbridge mission', '/ceo', 'ceo page', 'founder', 'ceo video', 'ceo message', 'founder story', 'ceo vision message', 'victor eniola'],
    content: `### What You Will Find
The CEO Vision page at **/ceo** features:
- **Video message** from Victor Eniola, founder and CEO
- His personal journey building JobBridge from the ground up
- Challenges faced along the way
- The company's roadmap for the future

### Additional Content
- **Photo gallery** documenting the founder's journey
- **Timeline** of company milestones and achievements
- **Key values** that guide the platform
- **Mission pillars** explanation

### Interactive Feature
An interactive section allows users to **leave encouraging messages** directly for the CEO, which are displayed on the page.`,
  },
  {
    id: 'messages-page',
    title: 'Messages / Inbox',
    tags: ['general', 'messaging', 'communication'],
    pages: ['/messages'],
    keywords: ['messages', 'inbox', 'conversations', 'chat', 'messaging', '/messages', 'employer messages', 'recruiter messages', 'direct messages', 'message center', 'my messages', 'inbox page', 'conversation threads', 'how to message', 'messages page'],
    content: `### Conversation Threads
The Messages page at **/messages** shows a list of conversation threads on the left side. Each thread shows:
- Company name or sender
- Company logo or avatar
- Last message preview text
- Timestamp of the last message
- Unread conversations are highlighted with a badge count

### Chat Panel
Clicking a conversation opens the full chat panel on the right side:
- Complete conversation history
- Sent and received messages with timestamps
- **Read receipts** — double check mark icons next to sent messages
- Some conversations show a **lock icon** (locked until the recruiter initiates contact)

### Features
- **Search bar** at the top to filter conversations by name or keywords
- **Mobile-friendly** layout — chat panel slides over the conversation list on smaller screens
- Smooth messaging experience`,
  },
  {
    id: 'notifications-page',
    title: 'Notifications & Alerts',
    tags: ['general', 'notifications', 'alerts'],
    pages: ['/notifications'],
    keywords: ['notifications', 'alerts', 'notification history', 'job alerts', 'activity feed', '/notifications', 'unread notifications', 'notification settings', 'my notifications', 'notification page', 'alert history', 'notification center', 'notification types'],
    content: `### Notification Types
The Notifications page at **/notifications** organizes notifications by type:
- **Job Application** — application status changes (Reviewed, Shortlisted, Rejected, Hired)
- **Message** — new messages from employers or recruiters
- **Interview** — interview invitations and schedule updates
- **Review** — profile reviews or endorsements
- **System** — account updates, security alerts, platform announcements
- **Payment** — payment receipts, subscription activation or expiration
- **Advert** — business advertisement performance

### Feed Display
Each notification shows: type icon, title, content preview, and relative time ("2 hours ago", "Yesterday"). Unread notifications have a different background.

### Actions
- Click the **check mark** button to mark as read
- Click the **X** button to delete

### Job Alerts
Create keyword-based search alerts that automatically notify you when new matching jobs are posted. Manage which notification types you receive from the **Settings page** at **/settings**.`,
  },
  {
    id: 'games-page',
    title: 'Games & Memory Card Game',
    tags: ['entertainment', 'games', 'fun'],
    pages: ['/games'],
    keywords: ['games', 'memory game', 'card game', 'memory card', 'play game', '/games', 'fun', 'entertainment', 'mini game', 'memory matching', 'flip cards', 'game page', 'game zone', 'play memory game', 'jobbridge games'],
    content: `### Memory Card Matching Game
The Games page at **/games** features a fun memory card matching game:
- Flip cards to find matching pairs
- Multiple stages with increasing difficulty
- Sound effects using the Web Audio API (card flip, match, mismatch, win events)
- Timer tracking how quickly you complete each round
- Streak completion popup with bounce-in animation: "Excellent Job! You are on a Streak!"

### Job Quiz Stage
Tests your knowledge about:
- Job searching
- Careers
- Professional development

### Scoring
- Progressive pass thresholds
- Penalty scoring for incorrect matches
- Audio settings panel to control sound effects independently

A fun and engaging break activity while browsing and applying for jobs.`,
  },
  {
    id: 'blog-page',
    title: 'Blog & Career Insights',
    tags: ['blog', 'career', 'content'],
    pages: ['/blog'],
    keywords: ['blog', 'blog page', 'insights', 'articles', 'career resources', 'career advice', 'blog posts', 'jobbridge blog', 'read blog', 'blog articles', 'newsletter', 'blog categories', 'career insights', 'blog posts jobbridge'],
    content: `### Categories
The Blog page at **/blog** organizes articles by category tags:
- **Career Advice** — job search strategies, professional growth
- **AI and Tech in Hiring** — how AI is transforming recruitment
- **Remote Work** — tips for working from home and distributed teams
- **Salary and Benefits** — compensation guides
- **Leadership** — management and professional development

### Articles
Each article displays: title, brief excerpt, category tag, and publication date. Click any article to read the full content at **/blog/article-id**.

### Sample Topics
- "The Future of AI in Hiring"
- "10 Resume Mistakes That Cost You Interviews"
- "How to Ace Your Remote Interview"

### Newsletter
Subscribe by entering your email to receive weekly updates with new articles delivered to your inbox. New articles are added regularly.`,
  },
  {
    id: 'career-page',
    title: 'Career Page (Join JobBridge)',
    tags: ['general', 'company', 'careers'],
    pages: ['/career'],
    keywords: ['career page', 'career', 'join jobbridge', 'work at jobbridge', 'career opportunities', 'jobbridge careers', '/career', 'jobs at jobbridge', 'hiring', 'join the team', 'work with us', 'careers at jobbridge'],
    content: `### Status
The Career page at **/career** is currently a **"Coming Soon"** page for those interested in working at JobBridge itself (not for browsing jobs on the platform).

### How to Get Notified
Click **"Get Notified When Live"** to enter your email address and subscribe for updates. Your subscription is stored in the **blog_subscribers** database table.

When career opportunities at JobBridge become available, subscribed users will be notified.`,
  },
  {
    id: 'privacy-center',
    title: 'Privacy Center & Data Policy',
    tags: ['privacy', 'legal', 'security'],
    pages: ['/privacy'],
    keywords: ['privacy center', 'privacy policy', 'data policy', 'terms of service', 'legal', 'compliance', 'gdpr', 'ndpr', 'data protection', 'privacy page', '/privacy', 'privacy information', 'data collection', 'what data is collected', 'how data is used', 'data sharing', 'cookies'],
    content: `### Information Collected
- Name, email address, phone number
- Profile details and professional information
- Resume and CV documents
- Payment information (handled directly by Paystack, never stored on JobBridge servers)
- Usage data to improve the platform

### How Information Is Used
- Account creation and management
- Job matching and recommendations
- AI feature functionality
- Payment processing through Paystack
- Communication about platform updates

### Information Sharing
Your data is **never sold to third parties**. It is only shared with contracted service providers:
- **Paystack** — payment processing
- **OpenAI** — AI features
- **Supabase** — database and authentication
- **Resend** — email delivery

All under strict data processing agreements.

### Data Storage & Security
- Data encrypted at rest and in transit on Supabase infrastructure
- Passwords are hashed, never stored in plain text
- HTTPS encryption throughout

### Your Rights
- View, edit, or delete your personal data anytime from Profile and Settings pages
- For specific questions: **jobbridgesupport@gmail.com**

### Cookies & Tracking
Only essential cookies and local storage for authentication and functionality. **No third-party tracking cookies or analytics.**`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  13. TECHNICAL
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'pwa-installation',
    title: 'PWA Installation & Mobile Access',
    tags: ['technical', 'mobile', 'pwa'],
    pages: [],
    keywords: ['pwa', 'progressive web app', 'install app', 'mobile app', 'offline', 'install jobbridge', 'add to home screen', 'install on phone', 'android install', 'ios install', 'desktop install', 'app installation', 'browser install', 'install pwa', 'how to install', 'install on my phone', 'download jobbridge'],
    content: `### What Is the PWA?
JobBridge is a **Progressive Web App (PWA)** — installable on your device for a native app-like experience without going through an app store.

### Desktop Installation (Chrome, Edge, Chromium-based)
1. Click the install icon in the browser address bar (monitor with a down arrow)
2. Or look for **"Install JobBridge"** in the browser menu

### Android Installation (Chrome)
1. Tap the three-dot menu
2. Select **"Add to Home Screen"**

### iPhone/iPad Installation (Safari)
1. Tap the **Share** button at the bottom of the screen
2. Scroll down and select **"Add to Home Screen"**
3. Tap **"Add"** in the top-right corner

### Benefits
- Opens in its own window without browser chrome
- Loads faster with cached content
- Provides offline access to previously visited pages
- Can send push notifications (when supported)
- Takes up less storage space than a native app
- Also accessible from any browser without installation`,
  },
  {
    id: 'security-features',
    title: 'Security & Platform Protection',
    tags: ['security', 'technical', 'privacy'],
    pages: [],
    keywords: ['security', 'secure', 'encryption', 'safe', 'is jobbridge safe', 'https', 'data protection', 'platform security', 'how secure', 'privacy protection', 'security features', 'cybersecurity', 'protected', 'is jobbridge secure', 'safety', 'safe platform'],
    content: `### Authentication & Sessions
- Supabase authentication with **bcrypt password hashing**
- Secure session management with 30-minute inactivity timeout

### Data in Transit
- HTTPS with **TLS 1.3 encryption** for all browser-platform communication
- Prevents interception by third parties

### Payment Security
- All payments through **Paystack** (PCI-DSS compliant)
- Paystack handles payment data directly — never exposed to JobBridge servers

### Platform Protection
- **Content Security Policy** — prevents XSS attacks and data injection
- **Frame-busting JavaScript** — prevents clickjacking in iframes
- **CSRF protection** — through Supabase's built-in measures
- **Data at rest encryption** — in Supabase PostgreSQL database
- **Anti-copy protections** — prevent unauthorized copying of displayed content

### User Controls
- Profile visibility, search appearance, and recruiter contact preferences
- Session expiry after 30 minutes of inactivity

### Hosting Security
- GitHub Pages with additional security headers (.htaccess):
  - HSTS (HTTP Strict Transport Security)
  - X-Content-Type-Options (nosniff)
  - X-Frame-Options (DENY)
  - Referrer-Policy`,
  },
  {
    id: 'browser-support',
    title: 'Browser & Device Compatibility',
    tags: ['technical', 'compatibility'],
    pages: [],
    keywords: ['browser support', 'supported browsers', 'chrome', 'firefox', 'safari', 'edge', 'mobile browser', 'compatibility', 'which browser', 'best browser', 'browser requirements', 'supported devices', 'what browsers', 'browser compatibility', 'internet explorer', 'supported browsers list'],
    content: `### Supported Browsers
- **Google Chrome** v90+ — recommended for best experience
- **Mozilla Firefox** v90+ — fully supported
- **Apple Safari** v15+ — supported on desktop and iOS
- **Microsoft Edge** v90+ — fully supported
- **Mobile browsers** — both Android and iOS are supported

### Not Supported
- **Internet Explorer** — will not display the platform correctly

### Best Experience
Use the latest version of **Google Chrome** on desktop and install the **PWA** on your mobile device for app-like performance with faster loading times and offline access to cached content. The platform is designed responsively for all screen sizes.`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  14. TROUBLESHOOTING
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'troubleshooting',
    title: 'Troubleshooting Common Issues',
    tags: ['support', 'troubleshooting', 'errors'],
    pages: [],
    keywords: ['troubleshooting', 'not working', 'error', 'bug', 'issue', 'problem', 'help me', 'fix', 'cannot', 'not loading', 'broken', 'something wrong', 'not working properly', 'having trouble', 'common errors', 'solutions', 'how to fix', 'fix error', 'blank screen', 'not receiving emails'],
    content: `### Page Not Loading / Blank Screen
1. Check your internet connection
2. Refresh the page
3. Clear your browser cache and cookies
4. Try opening JobBridge in an **incognito or private browsing** window

### Not Receiving Emails
1. Check your **spam or junk folder**
2. Add **jobbridgesupport@gmail.com** to your contacts
3. Verify you entered the correct email address
4. Use the **resend option** on the login page for password reset emails

### Cannot Post a Job
1. Ensure you selected the **Recruiter** role during signup (or contact support to change)
2. Check you have an **active subscription** with available job credits on the Recruiter Dashboard
3. Verify all required fields are filled in the job posting form

### CV/Resume Upload Fails
1. Ensure the file is in **PDF, DOC, DOCX, or RTF** format
2. File size must be under **10 megabytes**
3. Try renaming the file to remove special characters or spaces

### Application Not Showing
- Applications appear in the recruiter's panel after successful submission
- Refresh the **My Jobs page** to see your application status
- Check the **Applied tab** on your My Jobs page

### AI Features Not Working
- **Skills Extraction** — free for all users
- **AI Tailor Resume, Cover Letter, Interview Prep** — require active AI subscription (1500 Naira/month or 15000 Naira/year)
- **AI Assistant chat widget** — works without API key using built-in knowledge base

### 404 Error on Page Refresh (GitHub Pages)
This is a known limitation of single-page applications on GitHub Pages. Use **in-app navigation links** instead of browser refresh for subpages, or start from the home page at **/** and navigate from there.

For any unresolved issues, email **jobbridgesupport@gmail.com** with details about what you were doing and any error messages you saw.`,
  },

  // ═══════════════════════════════════════════════════════════════
  //  15. NAVIGATION & HEADER
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'site-navigation',
    title: 'Site Navigation & Header',
    tags: ['general', 'navigation', 'layout'],
    pages: [],
    keywords: ['navigation', 'header', 'menu', 'navbar', 'top bar', 'site navigation', 'how to navigate', 'header menu', 'navigation links', 'main menu', 'site menu', 'bottom nav', 'header bar', 'navigate around', 'how to get around'],
    content: `### Desktop Header
Every page has a consistent header at the top:
- **Left**: JobBridge logo (blue and white gradient icon with "JobBridge" text)
- **Center**: Navigation links — Jobs, Recruiters, Providers, Pricing, Blog
- **Search icon** — for quick searches
- **Right side**:
  - Bookmark icon — shows badge count of saved jobs
  - Notification bell — shows unread notification count
  - Profile avatar — click to open dropdown

### Profile Dropdown Menu
Links to: Profile (/profile), Settings (/settings), My Jobs (/my-jobs), Messages (/messages), Notifications (/notifications), Premium subscription options. At the bottom: **"Sign out"** button.

### Mobile Navigation
A **bottom navigation bar** appears on mobile with icons for: Home, Jobs, Messages, Notifications, Profile — easy one-handed navigation.

### Responsive Design
The header adapts to different screen sizes. If not signed in, the header shows **Sign In** and **Get Started** buttons instead of the profile menu.`,
  },
];

export default KB;
