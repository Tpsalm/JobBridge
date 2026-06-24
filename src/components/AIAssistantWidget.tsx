import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, ChevronUp, Sparkles, FileText, MessageCircle, TrendingUp } from 'lucide-react';
import { LOCAL_API_URL } from '../lib/supabase';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const suggestedPrompts = [
  'What is JobBridge?',
  'How to find a job?',
  'AI Resume Builder',
  'Recruiter plans',
  'How to apply?',
  'Contact support',
];

const knowledgeBase: { keywords: string[]; answer: string }[] = [
  {
    keywords: ['what is jobbridge', 'about jobbridge', 'what does jobbridge do', 'tell me about jobbridge', 'what is job bridge', 'jobbridge overview', 'jobbridge platform', 'jobbridge meaning'],
    answer: '**JobBridge** is a career platform that connects job seekers with employers. We offer:\n\n• **Job listings** across multiple industries\n• **AI-powered resume builder & cover letter generator**\n• **Career coaching & interview preparation**\n• **Service provider marketplace** (photographers, designers, developers, etc.)\n• **Salary insights & negotiation tools**\n\nFounded in 2021 by Victor Eniola, JobBridge is on a mission to bridge the gap between talent and opportunity.\n\n🌐 Visit us at: **https://jobbridge.com**',
  },
  {
    keywords: ['jobbridge website', 'jobbridge link', 'find jobbridge', 'jobbridge url', 'jobbridge site', 'jobbridge platform', 'visit jobbridge', 'go to jobbridge', 'jobbridge home', 'jobbridge homepage', 'jobbridge com', 'jobbridge dot com'],
    answer: 'You can visit JobBridge directly at: **https://jobbridge.com**\n\nFrom the homepage you can:\n• Browse **Jobs** — find your next opportunity\n• Use **AI Resume Builder** — create professional resumes\n• Explore **Service Providers** — hire designers, developers, and more\n• Read our **Blog** — career advice and industry insights\n• View **Pricing** — choose a plan that works for you',
  },
  {
    keywords: ['jobbridge mission', 'jobbridge vision', 'jobbridge values', 'jobbridge core values', 'transparency innovation inclusion', 'jobbridge pillars'],
    answer: 'JobBridge\'s core pillars are:\n\n**🔹 Transparency** — Clear, honest, and open about career opportunities\n**🔹 Innovation** — Using AI and technology to make hiring smarter\n**🔹 Inclusion** — Creating opportunities for everyone, including PWDs and internally displaced persons\n\nOur mission is to bridge the gap between talent and opportunity, making career opportunities easier to discover and more transparent.',
  },
  {
    keywords: ['jobbridge founder', 'who created jobbridge', 'victor eniola', 'ceo jobbridge', 'founder jobbridge', 'who started jobbridge'],
    answer: 'JobBridge was founded in **2021** by **Mr. Victor Eniola**. Victor is the CEO of JobBridge and his vision was to create a people-first career marketplace that combines AI, data, and human expertise to connect talent with employers. You can read his full letter on the **CEO** page.',
  },
  {
    keywords: ['jobbridge milestones', 'jobbridge history', 'jobbridge timeline', '2021', '2022', '2023', '2024', '2025', '2026', 'when was jobbridge founded'],
    answer: 'JobBridge milestones:\n\n• **2021** — Founded by Victor Eniola\n• **2022** — Market research and platform design\n• **2023** — Vision & roadmap finalised; platform development begins\n• **2024** — Development continues; AI features planned\n• **2025** — AI Launch — AI-powered tools go live\n• **2026** — Full platform with jobs, AI resume, providers, games, and more\n\nVisit the **CEO** page for the full story!',
  },
  {
    keywords: ['home page', 'homepage', 'landing page', 'jobbridge home', 'what is on the home page'],
    answer: 'The JobBridge **Home** page features:\n\n• **Hero Carousel** — rotating highlights with 3D animations\n• **Action buttons** — "Find Jobs", "Hire Talent" (→ /providers), "AI Resume" (→ /ai-resume)\n• **Stats** — platform metrics and success numbers\n• **Featured Jobs** — latest opportunities\n• **Service Providers** — top professionals\n• **Blog preview** — latest career articles\n• **Why JobBridge** section with key benefits\n\n🌐 Visit: **https://jobbridge.com**',
  },
  {
    keywords: ['find a job', 'search jobs', 'how to apply', 'apply for job', 'get a job', 'looking for work', 'find work', 'job search', 'browse jobs', 'view jobs'],
    answer: 'To find and apply for jobs on JobBridge:\n\n1️⃣ Go to the **Jobs** page and browse or search by title, category, or location\n2️⃣ Use filters: **Job Type** (Full-time, Part-time, Contract, Internship), **Experience Level**, **Location**\n3️⃣ Click on any job to view full details\n4️⃣ Click **Apply Now** and fill in the application form\n5️⃣ Track your applications in your dashboard\n\n💡 **Tip:** Use our AI Resume Builder to optimize your CV before applying!',
  },
  {
    keywords: ['job types', 'full time', 'part time', 'contract', 'internship', 'job type filter', 'employment type'],
    answer: 'On the **Jobs** page, you can filter by these job types:\n\n• **Full-time** — Standard 40-hour work week positions\n• **Part-time** — Reduced hours, flexible schedules\n• **Contract** — Fixed-term project-based roles\n• **Internship** — Entry-level positions for students and graduates\n\nYou can also filter by **Experience Level** (Internship, Junior, Mid, Senior) and **Location** (Remote, On-site, Hybrid).',
  },
  {
    keywords: ['experience level', 'junior', 'senior', 'mid level', 'entry level', 'experience filter'],
    answer: 'On the **Jobs** page, you can filter by experience level:\n\n• **Internship** — 0-1 year experience (students, fresh graduates)\n• **Junior** — 1-3 years experience\n• **Mid** — 3-5 years experience\n• **Senior** — 5+ years experience\n\nUse these filters together with **Job Type** and **Location** to find the perfect role!',
  },
  {
    keywords: ['location filter', 'remote', 'on site', 'hybrid', 'work location', 'remote jobs', 'onsite jobs'],
    answer: 'On the **Jobs** page, you can filter by work location:\n\n• **Remote** — Work from anywhere\n• **On-site** — Work at the employer\'s physical location\n• **Hybrid** — Mix of remote and on-site work\n\nYou can also search by specific city or region using the location search bar.',
  },
  {
    keywords: ['how to apply for job', 'application process', 'job application', 'apply now', 'submit application', 'application form'],
    answer: 'When you click **Apply Now** on a job, you\'ll need to provide:\n\n📋 **Personal info:** Date of birth, gender\n♿ **Disability & displacement status** (optional)\n🎯 **Professional headline**\n💼 **Years of experience** and **function**\n🏢 **Work type** (remote/on-site/hybrid)\n🎓 **Highest qualification**\n📍 **Location** and **availability**\n💰 **Salary expectation**\n📄 **CV file** (PDF, DOC, DOCX — max 10MB)\n✉️ **Cover letter**\n\nMake sure your CV is up to date before applying!',
  },
  {
    keywords: ['cv upload', 'upload cv', 'upload resume', 'cv format', 'cv file', 'resume file', 'pdf cv', 'document upload'],
    answer: 'When applying for jobs on JobBridge, you can upload your CV/resume in these formats: **PDF, DOC, DOCX, RTF**. Maximum file size is **10MB**.\n\n💡 **Tip:** Use the **AI Resume Builder** to create an ATS-optimized CV before uploading!',
  },
  {
    keywords: ['ai resume', 'resume builder', 'build resume', 'cv builder', 'create cv', 'ai cv', 'tailor resume', 'ai resume builder', 'resume page', 'ai resume page', 'ai resume subscription', 'resume tool'],
    answer: 'The **AI Resume Builder** at **/ai-resume** helps you create professional, ATS-optimized resumes:\n\n**✨ AI Tailor Resume** — Paste a job description and we optimize your resume for it\n**📝 AI Cover Letter Generator** — Generate job-specific cover letters in seconds\n**📄 Multiple templates** to choose from\n**💾 Export to PDF**\n\n⚡ This feature requires an **AI subscription** (₦1,500/month or ₦15,000/year). "Tailor Resume" and "Cover Letter" buttons will redirect you to **Pricing** if you\'re not subscribed.',
  },
  {
    keywords: ['cover letter', 'cover letter generator', 'write cover letter', 'ai cover letter'],
    answer: 'The **AI Cover Letter Generator** on the **AI Resume** page creates job-specific cover letters in seconds. Just enter the job details and our AI writes a professional, tailored cover letter for you.\n\n⚡ Requires an **AI subscription** (₦1,500/month). Subscribe on the **Pricing** page!',
  },
  {
    keywords: ['ai subscription', 'ai tools subscription', 'subscribe ai', 'ai monthly', 'ai annual', 'ai pricing', 'ai cost', 'ai plan', 'ai fees'],
    answer: '**AI Tools Subscription** on JobBridge:\n\n**📅 Monthly** — ₦1,500/month\n**📅 Annual** — ₦15,000/year (save ~17%)\n\nThis gives you access to:\n• **AI Resume/CV Builder** with Tailor Resume\n• **AI Cover Letter Generator**\n• **AI Interview Preparation**\n• **AI Career Assessment**\n• **Salary Insights**\n\nSubscribe on the **Pricing** page!',
  },
  {
    keywords: ['recruiter page', 'recruiter dashboard', 'recruiter tools', 'recruiter features', 'recruiter panel'],
    answer: 'The **Recruiter Dashboard** at **/recruiter** gives you:\n\n• **Post New Job** — Create and publish job listings\n• **AI Write Description** — AI-powered job description writer\n• **Active Job Postings** — Manage your listings\n• **Applications Panel** — Review, shortlist, reject, or hire candidates\n• **AI Rank** — Score candidates by match percentage\n• **Quick Filters** — Filter by experience, job type, location\n\n📊 Track stats: active jobs, candidates, interviews, offers.',
  },
  {
    keywords: ['post job', 'post a job', 'create job', 'job posting', 'submit job', 'publish job'],
    answer: 'To post a job on JobBridge:\n\n1️⃣ Go to the **Recruiter Dashboard** at **/recruiter**\n2️⃣ Click **Post New Job** (requires active subscription)\n3️⃣ Fill in: title, company, location, job type, salary, description\n4️⃣ Submit — your job will be **pending** and visible after **admin approval**\n\n💡 You can also use the **AI Write Description** tool to generate an optimized job description first!',
  },
  {
    keywords: ['recruiter subscription', 'recruiter plan', 'recruiter pricing', 'job posting plan', 'job posting credits', 'recruiter cost', 'recruiter fee', 'post job price', 'subscribe to post'],
    answer: '**Recruiter Subscription Plans:**\n\n**🥇 Basic** — ₦2,000 • 7 days • 1 job credit\n**🥈 Standard** — ₦3,500 • 14 days • 1 job credit\n**🥉 Premium** — ₦5,000 • 30 days • 3 job credits\n\nWith an active subscription you can:\n• **Post jobs** using your credits\n• **AI Write Description** — generate optimized job descriptions\n• **Review applications** from candidates\n\nChoose a plan on the **Pricing** page!',
  },
  {
    keywords: ['ai job description', 'ai write description', 'jd writer', 'job description generator', 'ai jd', 'generate job description'],
    answer: 'The **AI Job Description Writer** on the Recruiter page:\n\n1️⃣ Click **AI Write Description** (requires active recruiter subscription)\n2️⃣ Enter the job title and up to 3 core requirements\n3️⃣ Click **Generate Description**\n4️⃣ AI creates optimized, bias-free job description with responsibilities, requirements, and benefits\n5️⃣ Click **Publish This Job** to post it directly!\n\nSaves time and ensures consistent, high-quality listings.',
  },
  {
    keywords: ['ai candidate scoring', 'ai rank', 'score candidates', 'rank candidates', 'ai match', 'candidate matching'],
    answer: 'The **AI Candidate Scoring** tool on the Recruiter page:\n\n• Click **AI Rank** next to any active job\n• The system analyzes candidate resumes against job requirements\n• Returns ranked candidates with **match scores** (e.g., 96% match)\n• Color-coded: green (80%+), amber (60-79%), red (below 60%)\n\nHelps you quickly identify the best applicants!',
  },
  {
    keywords: ['applications panel', 'review applications', 'manage applications', 'shortlist', 'shortlisted', 'reject candidate', 'hire candidate', 'application status'],
    answer: 'From the **Applications Panel** on the Recruiter page:\n\n• View all applications with applicant details\n• Click any application to see full info: headline, DOB, gender, experience, function, work type, qualification, location, salary expectation, CV, and cover letter\n• **Shortlist** — Mark promising candidates\n• **Mark Reviewed** — Track your review progress\n• **Reject** — Decline unsuitable applicants\n• **Hire** — Mark selected candidates as hired\n\nFilter by status: All, Pending, Shortlisted, Reviewed, Rejected.',
  },
  {
    keywords: ['service provider', 'become a provider', 'offer services', 'provider plan', 'provider pricing', 'provider page', 'service provider marketplace', 'providers page'],
    answer: 'The **Service Providers** page at **/providers** showcases professionals offering services:\n\n**Categories:** Engineering, Design, Marketing (Grace Media), Finance (Kenny Finance), Legal, Photography, Writing, Consulting, and more\n\n**To become a provider:**\n1️⃣ Sign up and select **Service Provider** role\n2️⃣ Complete your profile with service categories, descriptions, hourly rate, and samples\n3️⃣ Choose a plan:\n   • **Monthly Listing** — Free (basic profile & inquiries)\n   • **Featured Professional** — ₦5,000/month (top placement, homepage spotlight)\n\nYou can offer services in: Design, Development, Marketing, Finance, Legal, Photography, Consulting, and more!',
  },
  {
    keywords: ['provider categories', 'provider specialties', 'marketing provider', 'finance provider', 'design provider', 'development provider', 'grace media', 'kenny finance'],
    answer: '**Service Provider Categories:**\n\n• **Engineering** — Web & mobile developers, software engineers\n• **Design** — UI/UX designers, graphic designers, brand identity\n• **Marketing** — Digital marketers (e.g., Grace Media)\n• **Finance** — Financial analysts, accountants (e.g., Kenny Finance)\n• **Legal** — Lawyers, legal consultants\n• **Photography** — Event & portrait photographers\n• **Writing** — Content writers, copywriters, technical writers\n• **Consulting** — Business & career consultants\n\nVisit the **Providers** page to browse all professionals!',
  },
  {
    keywords: ['pricing page', 'view pricing', 'plans and pricing', 'all plans', 'pricing plans', 'subscription plans'],
    answer: 'The **Pricing** page at **/pricing** has all JobBridge plans:\n\n**🔹 Job Posting (Recruiters)**\n• Basic — ₦2,000 / 7 days / 1 credit\n• Standard — ₦3,500 / 14 days / 1 credit\n• Premium — ₦5,000 / 30 days / 3 credits\n\n**🔹 AI Tools (Job Seekers)**\n• Monthly — ₦1,500/month\n• Annual — ₦15,000/year\n\n**🔹 Service Providers**\n• Monthly Listing — Free\n• Featured Professional — ₦5,000/month\n\n**🔹 Training Courses** — Coming Soon!\n\nClick any plan to proceed to payment.',
  },
  {
    keywords: ['payment page', 'how to pay', 'make payment', 'pay for plan', 'payment methods', 'pay online'],
    answer: 'The **Payment** page at **/payment** handles all subscriptions:\n\n1️⃣ Select your plan (job posting, AI, or provider)\n2️⃣ Choose payment method:\n   • **Card** — Pay with debit/credit card via Paystack (instant)\n   • **Transfer** — Bank transfer (manual verification)\n3️⃣ Complete payment\n4️⃣ Your subscription is activated instantly (card) or after verification (transfer)\n\n💳 Powered by **Paystack** for secure payments.',
  },
  {
    keywords: ['paystack', 'card payment', 'debit card', 'credit card', 'pay with card', 'online payment'],
    answer: 'JobBridge uses **Paystack** for secure card payments:\n\n• **Card payments** are processed instantly via Paystack\'s secure checkout\n• We accept **Visa**, **Mastercard**, **Verve**, and other major cards\n• After successful payment, your subscription is activated immediately\n• **Dev mode** auto-verifies payments for testing\n\n💳 No Paystack account needed — just your card!',
  },
  {
    keywords: ['bank transfer', 'transfer payment', 'pay via transfer', 'manual payment'],
    answer: 'To pay via **Bank Transfer**:\n• Select "Transfer" on the Payment page\n• You\'ll receive bank account details to send the exact amount\n• After transfer, your payment is verified manually\n• Subscription activates once confirmation is received\n\n💡 **Card payment** is faster and activates instantly.',
  },
  {
    keywords: ['sign up', 'register', 'create account', 'signup', 'join jobbridge', 'new account', 'create profile'],
    answer: 'Creating an account on JobBridge is free and easy:\n\n1️⃣ Go to the **Sign Up** page at **/signup**\n2️⃣ Choose your role: **Job Seeker**, **Recruiter**, or **Service Provider**\n3️⃣ Enter your **full name**, **email**, and **password**\n4️⃣ Click **Create Account**\n5️⃣ Check your email for the **OTP code** and enter it on the **Verify OTP** page\n6️⃣ Welcome! You\'ll receive a welcome email with tips for your role.\n\nAlready have an account? Just **Sign In** at **/login**.',
  },
  {
    keywords: ['login', 'sign in', 'signin', 'log in', 'login page', 'sign into account'],
    answer: 'To sign in to your JobBridge account:\n\n1️⃣ Go to **Sign In** at **/login**\n2️⃣ Enter your **email** and **password**\n3️⃣ Click **Sign In**\n\nDon\'t have an account? **Sign Up** — it\'s free!',
  },
  {
    keywords: ['otp', 'verify', 'verification', 'code', 'confirm email', 'verify otp', 'otp code', 'email verification', 'one time password'],
    answer: 'After signing up, JobBridge sends a **one-time password (OTP)** to your email for verification.\n\n• Check your inbox (and spam folder) for the code\n• Enter the code on the **Verify OTP** page at **/verify-otp**\n• The code expires after **10 minutes**\n• If you didn\'t receive it, you can request a new one\n• After verification, you\'ll get a **Welcome email** with role-specific tips\n\nNeed help? Contact **jobbridgesupport@gmail.com**',
  },
  {
    keywords: ['welcome email', 'welcome message', 'after signup', 'post verification'],
    answer: 'After you verify your email with OTP, JobBridge automatically sends you a **Welcome email** with:\n\n• A **hero image** from Pexels\n• **Role-specific bullet points** (job seeker, recruiter, or provider)\n• A **"Get Started Now"** button to begin using the platform\n• **Support contact** info\n\nIf you didn\'t receive it, check your spam folder.',
  },
  {
    keywords: ['subscription confirmation email', 'payment confirmation', 'receipt', 'payment email'],
    answer: 'After successfully subscribing to a plan, JobBridge sends a **Subscription Confirmation** email with:\n\n• **Gradient header** with JobBridge branding\n• **Plan summary card** (plan name, amount, duration)\n• **"Go to Dashboard"** button\n• **Support contact** information\n\nEmails use the JobBridge blue color scheme (#1e40af).',
  },
  {
    keywords: ['contact', 'support', 'help', 'customer service', 'reach out', 'email support', 'call support', 'contact us', 'customer support'],
    answer: 'Need help? Here\'s how to reach us:\n\n📞 **Call/WhatsApp/Live Chat:** 09136171354\n📧 **Email:** jobbridgesupport@gmail.com\n🏢 **Office:** No 4, Phenol Crystal Street, Koomi Rd, Saki, Oyo State\n\nWe typically respond within **24 hours**. You can also use the **Contact** page at **/contact** or the **Support** page at **/support** to send us a message directly!',
  },
  {
    keywords: ['office address', 'location', 'physical address', 'saki', 'oyo state', 'phenol crystal street', 'koomi road'],
    answer: '**JobBridge Office:**\n\n🏢 No 4, Phenol Crystal Street, Koomi Rd, Saki, Oyo State, Nigeria\n\nYou can also reach us:\n📞 09136171354\n📧 jobbridgesupport@gmail.com',
  },
  {
    keywords: ['social media', 'instagram', 'facebook', 'x twitter', 'jobbridge social', 'follow jobbridge'],
    answer: 'Follow JobBridge on social media:\n\n📸 **Instagram:** https://www.instagram.com/jobbridge__\n📘 **Facebook:** https://www.facebook.com/share/1DhVVgkF6P/\n🐦 **X (Twitter):** https://x.com/jobbridge_com\n\nFollow us for the latest job opportunities and career tips!',
  },
  {
    keywords: ['blog page', 'blog articles', 'career advice', 'read articles', 'jobbridge blog', 'blog posts'],
    answer: 'Our **Blog** at **/blog** features expert articles on:\n\n• **Career Advice** — resume tips, interview strategies, job search guides\n• **AI & Tech** — the future of AI in hiring and recruitment\n• **Remote Work** — best practices for hybrid and remote teams\n• **Salary & Benefits** — negotiation strategies and compensation insights\n• **Hiring** — best practices for employers and recruiters\n• **Leadership** — career growth and management advice\n\nClick any article to read it **on-site** without leaving JobBridge!\n\n💌 **Subscribe** to the newsletter at the bottom of the Blog page for updates.',
  },
  {
    keywords: ['blog subscribe', 'newsletter', 'email subscribe', 'blog newsletter', 'subscribe blog', 'get updates'],
    answer: 'You can subscribe to the **JobBridge Newsletter** at the bottom of the **Blog** page:\n\n1️⃣ Enter your email address in the input field\n2️⃣ Click **Subscribe**\n3️⃣ You\'ll receive a **confirmation email** with our blue-branded template\n\nGet the latest career advice, job opportunities, and platform updates delivered to your inbox!',
  },
  {
    keywords: ['salary blog', 'salary negotiation', 'negotiate salary', 'how to negotiate salary', 'salary article', 'salary tips'],
    answer: 'Our blog has a detailed guide: **"How to Negotiate a 20% Higher Salary"** by Michael Torres (6 min read). Tips include:\n\n1️⃣ **Research the market** — use JobBridge, Glassdoor, LinkedIn Salary\n2️⃣ **Know your value** — document achievements, quantify impact\n3️⃣ **Time it right** — negotiate after receiving offer, before accepting\n4️⃣ **Use anchoring** — be first to mention a specific number\n5️⃣ **Consider total comp** — bonuses, equity, benefits, flexibility\n\nRead it on the **Blog** page!',
  },
  {
    keywords: ['games', 'career match', 'memory game', 'streak', 'play games', 'games page', 'jobbridge games'],
    answer: '🎮 JobBridge has a **Career Match** memory game on the **Games** page at **/games**!\n\n• **How to play:** Flip cards to match career-themed pairs (8 pairs = 16 cards)\n• **Timer** tracks how fast you complete\n• **Moves counter** — fewer moves = better\n• **Streak system** — consecutive game wins tracked in localStorage\n• **Streak milestones:** 3 🔥, 5 🏆, 10 👑, 20 💎, 50 🌟\n• **Bell notification** shows streak updates\n\nA fun way to take a break while keeping career goals in mind!',
  },
  {
    keywords: ['about page', 'about jobbridge', 'about us', 'about company'],
    answer: 'The **About** page at **/about** covers:\n\n• **Our Story** — how JobBridge was founded and our mission\n• **Our Values** — transparency, innovation, inclusion\n• **Why JobBridge** — what makes us different\n• **View Open Positions** link to the Jobs page\n\nJobBridge is a career platform connecting talent with opportunity through AI-powered tools and a people-first approach.',
  },
  {
    keywords: ['ceo page', 'ceo letter', 'letter from victor', 'victor letter', 'ceo message'],
    answer: 'The **CEO** page at **/ceo** features:\n\n**"Letter from Victor"** — a personal message from our founder Victor Eniola with 9 paragraphs covering:\n• The founding vision and journey since 2021\n• The JobBridge difference — transparency, innovation, inclusion\n• AI\'s role in democratizing career opportunities\n• Gratitude to the community\n\nPlus **Milestones 2021–2026**: Founded, Market Research, Vision & Roadmap, Platform Design, Development, AI Launch.',
  },
  {
    keywords: ['support page', 'help page', 'get help', 'faq page'],
    answer: 'The **Support** page at **/support** provides:\n\n• **Live Chat/Call** — 09136171354\n• **Email** — jobbridgesupport@gmail.com\n• **Office Address** — No 4, Phenol Crystal Street, Koomi Rd, Saki, Oyo State\n• **FAQ** — frequently asked questions\n• Quick access to all contact methods',
  },
  {
    keywords: ['contact page', 'contact us', 'send message', 'contact form'],
    answer: 'The **Contact** page at **/contact** has:\n\n• **Contact form** — send us a message directly\n• **Phone** — 09136171354\n• **Email** — jobbridgesupport@gmail.com\n• **Address** — No 4, Phenol Crystal Street, Koomi Rd, Saki, Oyo State\n• **Social media links** — Instagram, Facebook, X (Twitter)\n\nWe typically respond within 24 hours!',
  },
  {
    keywords: ['my jobs', 'my jobs page', 'my applications', 'track applications', 'applied jobs', 'my job list'],
    answer: 'The **My Jobs** page at **/my-jobs** shows:\n\n• All jobs you\'ve applied to\n• **Application status** for each job\n• **Date applied**\n• **Company** and **position** details\n\nTrack all your applications in one place!',
  },
  {
    keywords: ['messages page', 'messages', 'inbox', 'direct messages'],
    answer: 'The **Messages** page at **/messages** is your inbox on JobBridge. You can:\n\n• Send and receive messages from recruiters and employers\n• Get notified when someone reaches out\n• Communicate directly about job opportunities\n\nCheck your messages regularly so you don\'t miss opportunities!',
  },
  {
    keywords: ['notifications page', 'notifications', 'alerts', 'bell icon'],
    answer: 'The **Notifications** page at **/notifications** shows:\n\n• **Application updates** — status changes on jobs you applied for\n• **Messages** — new messages from recruiters\n• **Streak updates** — game streak milestones 🏆\n• **System announcements** — platform updates and news\n\nThe bell icon in the header shows your **unread count**.',
  },
  {
    keywords: ['settings page', 'account settings', 'profile settings', 'update profile', 'change password'],
    answer: 'The **Settings** page at **/settings** lets you:\n\n• Update your **profile information**\n• Change your **password**\n• Manage your **email preferences**\n• View your **account details**\n\nKeep your profile up to date for the best experience!',
  },
  {
    keywords: ['analytics page', 'analytics', 'statistics', 'stats', 'dashboard analytics'],
    answer: 'The **Analytics** page at **/analytics** provides:\n\n• **Job market insights** and trends\n• Platform statistics and data\n• Career analytics to guide your job search\n\nUse data to make informed career decisions!',
  },
  {
    keywords: ['business page', 'business', 'business solutions', 'employers', 'business page jobbridge'],
    answer: 'The **Business** page at **/business** is for employers and businesses looking to:\n\n• **Hire talent** through JobBridge\'s platform\n• **Post jobs** and reach qualified candidates\n• **Use AI tools** for smarter recruitment\n• **Partner with us** for enterprise solutions\n\nVisit the **Business** page to learn more!',
  },
  {
    keywords: ['provider subscription', 'provider plan', 'featured professional', 'monthly listing', 'provider subscribe', 'provider cost'],
    answer: '**Service Provider Subscription:**\n\n**📋 Monthly Listing** — Free\n• Basic profile listing\n• Receive inquiries from clients\n\n**⭐ Featured Professional** — ₦5,000/month\n• Top placement in category searches\n• Homepage spotlight feature\n• Priority in search results\n• Badge indicator\n\nSubscribe on the **Pricing** page after signing up as a Service Provider!',
  },
  {
    keywords: ['admin dashboard', 'admin page', 'admin panel', 'admin console'],
    answer: 'The **Admin Dashboard** at **/admin** is for platform administrators only. It includes:\n\n• **Overview** — stats, role distribution, activity summary\n• **Jobs** — approve/reject/flag job listings\n• **Providers** — approve/reject provider profiles\n• **Users** — manage user accounts (suspend, activate, revoke)\n• **Activities** — staff activity tracking\n\n🚫 Non-admin users see a **404 page** for security.',
  },
  {
    keywords: ['admin approval', 'job approval', 'pending jobs', 'admin approve jobs', 'why is my job pending'],
    answer: 'When a recruiter posts a job, it\'s created with **status: pending**.\n\n• The job is **not visible** on the Jobs page until an admin approves it\n• An admin must go to the Admin Dashboard → Jobs tab → click **Approve**\n• Once approved, the job appears publicly on the Jobs page\n\nThis ensures all listings meet quality standards before going live.',
  },
  {
    keywords: ['training courses', 'courses', 'training', 'learn', 'coming soon training'],
    answer: 'JobBridge has **Training Courses** coming soon! Currently 4 courses are listed with a **"Coming Soon"** badge:\n\n• **Web Development Bootcamp**\n• **UI/UX Design Masterclass**\n• **Data Science Fundamentals**\n• **Digital Marketing Strategy**\n\nThese will be available on the **Pricing** page. Stay tuned!',
  },
  {
    keywords: ['ai assistant widget', 'chatbot', 'ai widget', 'ai chat', 'career assistant', 'ai assistant', 'ask ai'],
    answer: 'You\'re talking to the **JobBridge AI Assistant** right now! 🤖\n\nI can help you with:\n• **Finding jobs** — browse or search on the Jobs page\n• **Building your resume** — try our AI Resume Builder\n• **Our plans & pricing** — check the Pricing page\n• **Service providers** — visit the Providers page\n• **Contacting support** — email jobbridgesupport@gmail.com or call 09136171354\n• **Games, blog, and more** — just ask!\n\n🌐 **JobBridge:** https://jobbridge.com\n\nWhat would you like to know?',
  },
  {
    keywords: ['3d animation', 'animations', 'animated section', 'card tilt', '3d effect', 'page hero'],
    answer: 'JobBridge uses **3D animations** across the platform:\n\n• **Hero Carousel** — 3D slide effect with perspective transforms\n• **PageHero** — 3D carousel on every page\n• **AnimatedSection** — elements pop up with entrance animations on scroll\n• **Card3D** — cards tilt on hover with glare effect\n• **Stagger children** — sequential animation of multiple elements\n\nApplied on: Home, Jobs, Pricing, Blog, About, Support, Recruiter, AI Resume, Payment, Contact.',
  },
  {
    keywords: ['video demo', 'demo video', 'recruiter video', 'platform demo', 'how it works video'],
    answer: 'JobBridge includes demo videos on the platform:\n\n• **Recruiter page** — "Hire smarter with JobBridge" demo video\n• Videos use **autoPlay/muted** for instant playback\n• Hosted on **pixabay.com** CDN\n\nThese show you how to use the platform effectively!',
  },
  {
    keywords: ['internship', 'intern', 'graduate trainee', 'entry level', 'internship jobs', 'internship opportunities'],
    answer: 'Yes! JobBridge supports **Internship** positions:\n\n• Internships are listed as both a **job type** and **experience level**\n• Filter jobs by "Internship" on the **Jobs** page to see all available internships\n• Many employers post entry-level and graduate trainee roles\n• Whether you\'re a student or recent graduate, there are opportunities for you!\n\nStart your career journey with JobBridge!',
  },
  {
    keywords: ['salary', 'negotiate', 'salary negotiation', 'pay', 'compensation', 'salary expectation'],
    answer: 'For salary negotiation tips:\n\n1️⃣ **Research the market** — use JobBridge, Glassdoor, and LinkedIn Salary\n2️⃣ **Know your value** — document your achievements and quantify your impact\n3️⃣ **Time it right** — negotiate after receiving an offer but before accepting\n4️⃣ **Use anchoring** — be the first to mention a specific number\n5️⃣ **Consider total comp** — bonuses, equity, benefits, remote work flexibility\n\nRead our **Salary & Benefits** blog articles for in-depth guides!',
  },
  {
    keywords: ['disability', 'pwd', 'disabled', 'displaced', 'internally displaced', 'inclusion', 'inclusive hiring'],
    answer: 'JobBridge is committed to **inclusion**:\n\n• The job application form includes optional fields for **disability status** and **displacement status**\n• We support **Persons With Disabilities (PWD)**\n• **Internally Displaced Persons (IDPs)** are also supported\n• Our mission includes creating opportunities for everyone\n\nInclusion is one of JobBridge\'s three core pillars!',
  },
  {
    keywords: ['recruiter filters', 'quick filters recruiter', 'filter applicants', 'filter by experience', 'filter by job type', 'filter by location'],
    answer: 'The **Quick Filters** on the Recruiter Dashboard let you narrow down jobs and applications:\n\n**Experience Level:** Internship, Junior, Mid, Senior\n**Job Type:** Full-time, Part-time, Contract, Internship\n**Location:** Remote, On-site, Hybrid\n\nFilters apply to both **Active Job Postings** and **Applications** sections. Click **Clear all** in the sidebar to reset.',
  },
  {
    keywords: ['footer', 'bottom of page', 'site map', 'footer links'],
    answer: 'The **Footer** on every JobBridge page includes:\n\n• **JobBridge logo** and tagline\n• **Quick links** — Home, Jobs, About, Blog, Support\n• **Social media** — Instagram, Facebook, X (Twitter) with icon buttons\n• **Contact** — 09136171354, jobbridgesupport@gmail.com\n• **Address** — No 4, Phenol Crystal Street, Koomi Rd, Saki, Oyo State\n• **Copyright** notice',
  },
  {
    keywords: ['bottom nav', 'mobile navigation', 'bottom bar', 'nav bar mobile'],
    answer: 'On mobile, JobBridge shows a **Bottom Navigation Bar** with quick access to:\n\n• **Home** 🏠\n• **Jobs** 💼\n• **Games** 🎮\n• **Profile** 👤\n\nThis makes navigation easy on smaller screens!',
  },
  {
    keywords: ['hire talent', 'hire link', 'hire page', 'hire talent button', 'find talent'],
    answer: 'The **"Hire Talent"** button on the Home page links to **/providers** — the Service Providers page where you can browse and hire professionals in design, development, marketing, finance, and more.',
  },
  {
    keywords: ['ai resume link', 'ai resume button', 'go to ai resume'],
    answer: 'The **"AI Resume"** button on the Home page links to **/ai-resume** — the AI Resume Builder page where you can create professional, ATS-optimized resumes and cover letters.',
  },
  {
    keywords: ['featured professional badge', 'provider badge', 'top provider', 'spotlight provider'],
    answer: 'The **Featured Professional** badge is for Service Providers on the **Featured Professional** plan (₦5,000/month). Benefits:\n\n• **Top placement** in category search results\n• **Homepage spotlight** feature\n• **Priority** in client inquiries\n• **Special badge** on your profile\n\nStand out from the crowd!',
  },
  {
    keywords: ['subscription credits', 'job credits', 'how credits work', 'credit system', 'post credits'],
    answer: '**Job Posting Credits:**\n\n• **Basic** — ₦2,000 for 7 days = **1 credit** (post 1 job)\n• **Standard** — ₦3,500 for 14 days = **1 credit** (post 1 job)\n• **Premium** — ₦5,000 for 30 days = **3 credits** (post up to 3 jobs)\n\nEach credit lets you post **one job listing**. Credits are consumed when you post a job. The Recruiter Dashboard shows your remaining credits.',
  },
  {
    keywords: ['subscription expired', 'subscription inactive', 'no active plan', 'renew subscription', 'expired plan'],
    answer: 'If your subscription is **expired** or **inactive**:\n\n• You\'ll see an **amber warning** banner on the Recruiter Dashboard\n• The **"Subscribe to Post"** and **"Subscribe to AI Write"** buttons will appear\n• Click **"View Plans"** or any locked button to go to the **Pricing** page\n• Choose a new plan to reactivate your subscription',
  },
  {
    keywords: ['what can i ask', 'what do you know', 'what can you help with', 'help me', 'i need help'],
    answer: 'I can help you with anything about JobBridge! Try asking:\n\n• "How do I find a job?"\n• "Tell me about the Pricing page"\n• "How does the AI Resume work?"\n• "What are the recruiter plans?"\n• "How do I contact support?"\n• "Tell me about the Business page"\n• "How do I apply for a job?"\n• "What are the game streaks?"\n• "How do I become a provider?"\n• "Tell me about the CEO"\n\nJust type your question naturally!',
  },
  {
    keywords: ['thank', 'thanks', 'thank you', 'thanks bot', 'appreciate'],
    answer: 'You\'re welcome! 😊 I\'m glad I could help. If you have more questions about JobBridge — jobs, resume, pricing, providers, or anything else — just ask!\n\n🌐 **JobBridge:** https://jobbridge.com',
  },
  {
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy'],
    answer: 'Hello! 👋 Welcome to JobBridge! I\'m your AI career assistant. I can help you find jobs, build your resume, explain our plans, and more. What would you like to know?\n\n🌐 **JobBridge:** https://jobbridge.com',
  },
  {
    keywords: ['bye', 'goodbye', 'see you', 'talk later', 'exit'],
    answer: 'Goodbye! 👋 Thanks for chatting with the JobBridge AI assistant. Remember:\n\n🌐 **Visit JobBridge:** https://jobbridge.com\n📞 **Support:** 09136171354\n📧 **Email:** jobbridgesupport@gmail.com\n\nBest of luck with your career journey!',
  },
];

const SYNONYMS: Record<string, string[]> = {
  'job': ['work', 'position', 'role', 'career', 'employment', 'opening', 'vacancy', 'opportunity'],
  'find': ['search', 'look', 'browse', 'discover', 'locate', 'get'],
  'apply': ['submit', 'send', 'application', 'apply for', 'applying'],
  'resume': ['cv', 'curriculum vitae', 'curriculum', 'vitae'],
  'price': ['cost', 'fee', 'pricing', 'plan', 'plans', 'subscription', 'subscribe', 'payment', 'pay'],
  'help': ['support', 'assist', 'contact', 'reach', 'question', 'query'],
  'jobbridge': ['jobbridge com', 'jobbridge website', 'jobbridge site', 'jobbridge platform', 'jb'],
  'recruiter': ['employer', 'hirer', 'hiring', 'recruitment', 'recruit'],
  'provider': ['service provider', 'freelancer', 'professional', 'vendor'],
  'signup': ['register', 'create account', 'sign up', 'join', 'registration'],
  'login': ['sign in', 'signin', 'log in', 'login', 'authenticate'],
  'ai': ['artificial intelligence', 'artificial', 'intelligence'],
  'game': ['play', 'memory', 'career match', 'streak', 'fun'],
  'blog': ['article', 'articles', 'post', 'posts', 'newsletter', 'news'],
  'about': ['about us', 'story', 'mission', 'overview', 'info', 'information'],
  'ceo': ['founder', 'victor', 'eniola', 'owner'],
  'salary': ['compensation', 'pay', 'income', 'wage', 'earnings'],
  'otp': ['verification', 'verify', 'code', 'one time password', 'email verify'],
  'contact': ['support', 'help', 'phone', 'call', 'email', 'address', 'location', 'office'],
  'payment': ['pay', 'checkout', 'paystack', 'card', 'transfer', 'bank'],
  'internship': ['intern', 'entry level', 'graduate', 'trainee', 'fresh graduate'],
  'admin': ['administrator', 'approve', 'approval', 'pending'],
  'dashboard': ['panel', 'overview', 'stats', 'statistics'],
  'filter': ['filter', 'sort', 'narrow', 'refine', 'category', 'type'],
  'remote': ['work from home', 'wfh', 'wfa', 'telecommute', 'distributed'],
  'disability': ['pwd', 'disabled', 'inclusion', 'accessible', 'accessibility'],
  'notification': ['alert', 'bell', 'notif', 'notify', 'alerts'],
  'messages': ['inbox', 'dm', 'direct message', 'chat', 'mail'],
  'training': ['course', 'courses', 'learn', 'class', 'bootcamp', 'masterclass'],
  'feature': ['function', 'capability', 'capabilities', 'tool', 'tools'],
  'settings': ['profile', 'account', 'password', 'preferences'],
};

function cleanAndTokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);
}

function generateNgrams(words: string[], n: number): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    grams.add(words.slice(i, i + n).join(' '));
  }
  return grams;
}

function expandWithSynonyms(words: string[]): Set<string> {
  const expanded = new Set(words);
  for (const w of words) {
    if (SYNONYMS[w]) {
      for (const s of SYNONYMS[w]) {
        expanded.add(s);
        s.split(' ').forEach(part => { if (part.length > 1) expanded.add(part); });
      }
    }
    for (const [key, vals] of Object.entries(SYNONYMS)) {
      if (vals.includes(w)) expanded.add(key);
    }
  }
  return expanded;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = new Set([...a, ...b]);
  return intersection / union.size;
}

function findBestAnswer(query: string): string | null {
  if (!query) return null;
  const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const queryWords = cleanAndTokenize(query);
  const queryBigrams = generateNgrams(queryWords, 2);
  const queryTrigrams = generateNgrams(queryWords, 3);
  const queryExpanded = expandWithSynonyms(queryWords);

  let best: { answer: string; score: number } | null = null;

  for (const entry of knowledgeBase) {
    let maxScore = 0;

    for (const kw of entry.keywords) {
      const kwLower = kw.toLowerCase();
      const kwWords = cleanAndTokenize(kw);
      const kwBigrams = generateNgrams(kwWords, 2);
      const kwTrigrams = generateNgrams(kwWords, 3);
      const kwExpanded = expandWithSynonyms(kwWords);

      let score = 0;

      if (q.includes(kwLower)) {
        score = Math.max(score, 0.9);
      }

      const wordMatches = kwWords.filter(w => queryWords.includes(w)).length;
      const wordRatio = wordMatches / Math.max(kwWords.length, 1);
      score = Math.max(score, wordRatio * 0.7);

      const biSim = jaccardSimilarity(queryBigrams, kwBigrams);
      score = Math.max(score, biSim * 0.85);

      const triSim = jaccardSimilarity(queryTrigrams, kwTrigrams);
      score = Math.max(score, triSim * 0.95);

      const expSim = jaccardSimilarity(queryExpanded, kwExpanded);
      score = Math.max(score, expSim * 0.6);

      const allWordsPresent = kwWords.every(w => queryWords.includes(w));
      if (allWordsPresent) {
        score = Math.max(score, 0.8);
      }

      maxScore = Math.max(maxScore, score);
    }

    if (maxScore > 0.3 && (!best || maxScore > best.score)) {
      best = { answer: entry.answer, score: maxScore };
    }
  }

  return best ? best.answer : null;
}

function findFaqAnswer(query: string, faq: any[]): string | null {
  if (!query || !faq.length) return null;
  const q = query.toLowerCase().trim();
  const queryWords = cleanAndTokenize(query);
  const queryBigrams = generateNgrams(queryWords, 2);
  const queryExpanded = expandWithSynonyms(queryWords);

  let best: { answer: string; score: number } | null = null;

  for (const f of faq) {
    if (!f.keywords || !f.answer) continue;
    const kws = Array.isArray(f.keywords) ? f.keywords : [f.keywords];

    for (const kw of kws) {
      const kwLower = String(kw).toLowerCase();
      const kwWords = cleanAndTokenize(String(kw));
      const kwBigrams = generateNgrams(kwWords, 2);
      const kwExpanded = expandWithSynonyms(kwWords);

      let score = 0;

      if (q.includes(kwLower)) {
        score = Math.max(score, 0.85);
      }

      const wordMatches = kwWords.filter(w => queryWords.includes(w)).length;
      score = Math.max(score, (wordMatches / Math.max(kwWords.length, 1)) * 0.6);

      const biSim = jaccardSimilarity(queryBigrams, kwBigrams);
      score = Math.max(score, biSim * 0.75);

      const expSim = jaccardSimilarity(queryExpanded, kwExpanded);
      score = Math.max(score, expSim * 0.5);

      if (score > 0.35 && (!best || score > best.score)) {
        best = { answer: String(f.answer), score };
      }
    }
  }

  return best ? best.answer : null;
}

export default function AIAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "👋 Hello! I'm your JobBridge AI assistant. I can help you find jobs, build your resume, explain our plans, and more. What would you like to know?\n\n🌐 Visit us: **https://jobbridge.com**",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [faq, setFaq] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetch('/data/faq.json')
      .then((r) => r.json())
      .then((j) => setFaq(j.items || []))
      .catch(() => setFaq([]));
  }, []);

  const addBotMessage = (text: string) => {
    setMessages((prev) => [...prev, {
      id: prev.length + 1,
      text,
      sender: 'bot',
      timestamp: new Date(),
    }]);
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    setMessages((prev) => [...prev, {
      id: prev.length + 1,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    }]);
    setInput('');

    setTimeout(async () => {
      const faqAns = findFaqAnswer(messageText, faq);
      if (faqAns) {
        addBotMessage(faqAns);
        return;
      }

      const kbAns = findBestAnswer(messageText);
      if (kbAns) {
        addBotMessage(kbAns);

        try {
          const resp = await fetch(`${LOCAL_API_URL}/api/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: messageText }),
          });
          if (resp.ok) {
            const j = await resp.json();
            if (j.ok && j.answer) {
              addBotMessage(j.answer);
            }
          }
        } catch {}
        return;
      }

      try {
        const resp = await fetch(`${LOCAL_API_URL}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: messageText }),
        });
        if (resp.ok) {
          const j = await resp.json();
          if (j.ok && j.answer) {
            addBotMessage(j.answer);
            return;
          }
        }
      } catch {}

      const fallbacks: { keywords: string[]; answer: string }[] = [
        {
          keywords: ['provider', 'service'],
          answer: 'To become a Service Provider on JobBridge: Sign up as "Service Provider", complete your profile, and start offering services. Visit the **Providers** page to learn more!',
        },
        {
          keywords: ['price', 'cost', 'pay', 'payment', 'how much'],
          answer: 'Visit our **Pricing** page for full details on job posting plans, AI tools, and service provider packages. We have options for every budget!',
        },
        {
          keywords: ['login', 'sign in', 'signin'],
          answer: 'Go to **Sign In** and enter your email and password. If you don\'t have an account yet, click **Sign Up** to create one — it\'s free!',
        },
        {
          keywords: ['thank', 'thanks'],
          answer: 'You\'re welcome! 😊 If you have more questions, feel free to ask. I\'m here to help you make the most of JobBridge!',
        },
      ];

      const q = messageText.toLowerCase();
      for (const f of fallbacks) {
        for (const kw of f.keywords) {
          if (q.includes(kw)) {
            addBotMessage(f.answer);
            return;
          }
        }
      }

      addBotMessage(
        "That's a great question! I can help you with:\n\n• **Finding jobs** — browse or search on the Jobs page\n• **Building your resume** — try our AI Resume Builder\n• **Our plans & pricing** — check the Pricing page\n• **Service providers** — visit the Providers page\n• **Contacting support** — email jobbridgesupport@gmail.com or call 09136171354\n\n🌐 Visit JobBridge: **https://jobbridge.com**\n\nWhat would you like to know more about?"
      );
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <button
        onClick={() => setShowIntro(true)}
        className={`fixed bottom-20 right-4 md:bottom-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <div className="relative">
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
        </div>
      </button>

      {showIntro && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowIntro(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-on-surface mb-3">Say hello to your AI Career Assistant!</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">We've just launched an innovative tool to help you boost your career chances, whether you're just starting out or aiming for your next leadership role.</p>
            <p className="text-sm text-gray-700 font-semibold mb-2">Now you can easily:</p>
            <ul className="list-disc list-inside text-sm text-gray-700 mb-4 space-y-1">
              <li>Build a standout CV from scratch or improve your current one</li>
              <li>Generate job-specific cover letters in minutes</li>
              <li>Practice mock interviews tailored to your role or industry</li>
              <li>Negotiate job offers confidently with AI-generated counteroffers</li>
            </ul>
            <p className="text-sm text-gray-700 mb-4">And the best part? It's affordable.</p>
            <p className="text-sm text-gray-700 mb-4">Run out of time? Don't worry, our packages are still available and very affordable for you.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowIntro(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowIntro(false);
                  setIsOpen(true);
                }}
                className="px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800"
              >
                Try it now
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`fixed z-50 transition-all duration-300 ${
          isOpen
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{
          bottom: '80px',
          right: '16px',
          width: 'calc(100vw - 32px)',
          maxWidth: '380px',
          maxHeight: 'calc(100vh - 120px)',
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">JobBridge AI</h3>
                <p className="text-xs text-blue-100">Your career assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><ChevronUp className="w-4 h-4 text-white" /></button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"><X className="w-4 h-4 text-white" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[350px] bg-gray-50">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  message.sender === 'user'
                    ? 'bg-blue-700 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                }`}>
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 py-2 bg-white border-t border-gray-100">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="shrink-0 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-xs text-gray-700 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 bg-white border-t border-gray-100">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button type="submit" disabled={!input.trim()} className="p-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="px-3 pb-3 bg-white">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { icon: FileText, label: 'Resume' },
                { icon: MessageCircle, label: 'Interview' },
                { icon: TrendingUp, label: 'Salary' },
                { icon: Sparkles, label: 'Plans' },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => handleSend(`Tell me about ${label.toLowerCase()}`)}
                  className="flex flex-col items-center gap-1 p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Icon className="w-4 h-4 text-blue-700" />
                  <span className="text-[10px] text-gray-600">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
