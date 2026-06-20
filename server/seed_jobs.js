const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const fs = require('fs');
const path = require('path');

let actualRecruiterId = uuidv4();

const jobs = [
  {
    title: "Senior Software Engineer",
    company: "Flutterwave",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦8,000,000 – ₦14,000,000/year",
    category: "Technology",
    benefits: JSON.stringify(["Health Insurance", "Pension Plan", "Remote Work", "Paid Time Off", "Learning Budget", "Stock Options"]),
    description: `About Flutterwave:\nFlutterwave is Africa's leading payment technology company, building the financial infrastructure that enables businesses and individuals across the continent to make and receive payments seamlessly.\n\nRole Overview:\nWe're looking for a Senior Software Engineer to join our Core Payments team. You'll design, build, and maintain the systems that process millions of transactions daily across multiple payment channels.\n\nResponsibilities:\n• Design and implement scalable microservices handling high-volume payment processing\n• Write clean, testable code with comprehensive test coverage\n• Lead code reviews and mentor junior engineers\n• Collaborate with product managers to define technical solutions\n• Participate in on-call rotations and incident response\n• Contribute to architecture decisions and technical documentation\n\nRequirements:\n• 5+ years of software engineering experience\n• Strong proficiency in Go, Java, or Python\n• Experience with distributed systems and message queues (Kafka, RabbitMQ)\n• Solid understanding of database design (PostgreSQL, MongoDB)\n• Experience with cloud platforms (AWS, GCP)\n• Strong problem-solving and communication skills`,
    is_featured: true,
    views: 342,
    applications_count: 48
  },
  {
    title: "Product Manager",
    company: "Paystack",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦7,000,000 – ₦12,000,000/year",
    category: "Product",
    benefits: JSON.stringify(["Health Insurance", "Pension Plan", "Flexible Hours", "Paid Time Off", "Gym Membership", "Team Events"]),
    description: `About Paystack:\nPaystack (now part of Stripe) provides modern payment infrastructure for businesses in Africa. We help companies of all sizes accept payments and grow their revenue.\n\nRole Overview:\nWe're seeking a Product Manager to own the merchant experience — from onboarding to daily operations. You'll work closely with engineering, design, and business teams to build features that delight our merchants.\n\nResponsibilities:\n• Define product roadmap and prioritize features based on impact\n• Conduct user research and analyze merchant feedback\n• Write detailed product specs and user stories\n• Work with engineering to ship features on time\n• Track metrics and iterate on launched features\n• Collaborate with growth team on merchant acquisition strategies\n\nRequirements:\n• 4+ years of product management experience in fintech or SaaS\n• Strong analytical skills with experience in SQL or analytics tools\n• Excellent written and verbal communication\n• Experience with agile methodologies and tools like Jira or Linear\n• Deep empathy for users and passion for solving merchant pain points`,
    is_featured: true,
    views: 528,
    applications_count: 76
  },
  {
    title: "UI/UX Designer",
    company: "Andela",
    location: "Remote",
    type: "Full-time",
    salary_range: "₦5,000,000 – ₦9,000,000/year",
    category: "Design",
    benefits: JSON.stringify(["Health Insurance", "Remote Work", "Learning Budget", "Paid Time Off", "Home Office Setup", "Wellness Allowance"]),
    description: `About Andela:\nAndela is a global talent marketplace connecting world-class engineers with top companies. We're redesigning how the world hires.\n\nRole Overview:\nAs a UI/UX Designer, you'll shape the experience for both our marketplace platform and internal tools. You'll work in a fast-paced, cross-functional environment where design has a direct impact on business outcomes.\n\nResponsibilities:\n• Create wireframes, prototypes, and high-fidelity mockups\n• Conduct user research, usability testing, and heuristic evaluations\n• Maintain and evolve our design system\n• Collaborate with engineers to ensure pixel-perfect implementation\n• Present design decisions to stakeholders with clear rationale\n• Analyze user behavior data to identify improvement opportunities\n\nRequirements:\n• 3+ years of UI/UX design experience\n• Proficiency in Figma, Sketch, or Adobe XD\n• Strong portfolio demonstrating user-centered design process\n• Experience with design systems and component libraries\n• Understanding of front-end technologies (HTML, CSS, JS basics)\n• Excellent communication and presentation skills`,
    is_featured: false,
    views: 412,
    applications_count: 63
  },
  {
    title: "Data Scientist",
    company: "MTN Nigeria",
    location: "Abuja, Nigeria",
    type: "Full-time",
    salary_range: "₦6,000,000 – ₦11,000,000/year",
    category: "Data Science",
    benefits: JSON.stringify(["Health Insurance", "Pension Plan", "Housing Allowance", "Transport Allowance", "Paid Time Off", "Performance Bonus"]),
    description: `About MTN Nigeria:\nMTN is Africa's largest mobile network operator, serving over 70 million subscribers in Nigeria. We're transforming from a telco to a techco, leveraging data to drive innovation.\n\nRole Overview:\nJoin our Data Science team to build predictive models that drive business decisions — from churn prediction to revenue optimization and customer segmentation.\n\nResponsibilities:\n• Build and deploy machine learning models for customer analytics\n• Analyze large datasets to uncover actionable business insights\n• Develop A/B testing frameworks for product experiments\n• Create dashboards and automated reporting systems\n• Collaborate with engineering to productionize ML models\n• Present findings to senior leadership\n\nRequirements:\n• Master's degree in Data Science, Statistics, or related field\n• 3+ years of data science experience\n• Strong Python skills (pandas, scikit-learn, TensorFlow/PyTorch)\n• Experience with SQL and big data tools (Spark, Hadoop)\n• Knowledge of statistical modeling and hypothesis testing\n• Excellent storytelling with data skills`,
    is_featured: true,
    views: 289,
    applications_count: 41
  },
  {
    title: "DevOps Engineer",
    company: "Kuda Bank",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦7,500,000 – ₦13,000,000/year",
    category: "Technology",
    benefits: JSON.stringify(["Health Insurance", "Stock Options", "Remote Work", "Learning Budget", "Paid Time Off", "Pension Plan"]),
    description: `About Kuda Bank:\nKuda is Africa's leading digital bank, serving over 5 million customers. We're on a mission to make financial services accessible and affordable for every African.\n\nRole Overview:\nWe need a DevOps Engineer to own our cloud infrastructure and CI/CD pipelines. You'll ensure our systems are reliable, scalable, and secure — supporting millions of daily transactions.\n\nResponsibilities:\n• Design and manage AWS/GCP cloud infrastructure\n• Build and maintain CI/CD pipelines with GitHub Actions and ArgoCD\n• Implement monitoring, alerting, and logging solutions\n• Manage Kubernetes clusters and container orchestration\n• Ensure security compliance and disaster recovery readiness\n• Automate infrastructure provisioning with Terraform/Ansible\n\nRequirements:\n• 4+ years DevOps/SRE experience\n• Strong experience with AWS or GCP\n• Proficiency with Docker, Kubernetes, and Helm\n• Experience with IaC tools (Terraform, Pulumi, CloudFormation)\n• Knowledge of networking, DNS, and load balancing\n• On-call rotation experience preferred`,
    is_featured: true,
    views: 367,
    applications_count: 52
  },
  {
    title: "Marketing Manager",
    company: "Jumia",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦5,500,000 – ₦9,000,000/year",
    category: "Marketing",
    benefits: JSON.stringify(["Health Insurance", "Pension Plan", "Shopping Discounts", "Paid Time Off", "Performance Bonus", "Team Events"]),
    description: `About Jumia:\nJumia is Africa's leading e-commerce platform, connecting consumers with brands and sellers across the continent.\n\nRole Overview:\nLead our performance marketing team to drive customer acquisition, retention, and brand awareness across all Jumia markets.\n\nResponsibilities:\n• Develop and execute multi-channel marketing strategies\n• Manage digital advertising budgets (Google Ads, Meta, TikTok)\n• Analyze campaign performance and optimize for ROI\n• Coordinate with creative teams on campaign assets\n• Run seasonal promotions and growth campaigns\n• Report on KPIs to executive leadership\n\nRequirements:\n• 5+ years of marketing experience, 2+ in digital/performance marketing\n• Experience managing budgets of $50K+/month\n• Strong analytical skills with Google Analytics, Mixpanel, or similar\n• Experience with marketing automation tools\n• Excellent project management and stakeholder communication\n• E-commerce or marketplace experience preferred`,
    is_featured: false,
    views: 234,
    applications_count: 38
  },
  {
    title: "Frontend Developer (React)",
    company: "Interswitch",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦4,500,000 – ₦8,500,000/year",
    category: "Technology",
    benefits: JSON.stringify(["Health Insurance", "Pension Plan", "Learning Budget", "Paid Time Off", "Flexible Hours"]),
    description: `About Interswitch:\nInterswitch is one of Africa's leading integrated payments and digital commerce companies, powering financial transactions across the continent.\n\nRole Overview:\nJoin our Frontend Engineering team to build beautiful, performant user interfaces for our payment platforms used by millions of Nigerians daily.\n\nResponsibilities:\n• Build responsive web applications using React and TypeScript\n• Implement pixel-perfect designs from Figma mockups\n• Optimize web performance and Core Web Vitals\n• Write unit and integration tests with Jest and React Testing Library\n• Participate in code reviews and knowledge sharing\n• Collaborate with backend engineers on API contracts\n\nRequirements:\n• 3+ years of frontend development experience\n• Strong React, TypeScript, and modern JavaScript skills\n• Experience with state management (Redux, Zustand, or Context API)\n• Knowledge of CSS-in-JS, Tailwind, or Styled Components\n• Understanding of web accessibility standards\n• Experience with Git and agile workflows`,
    is_featured: false,
    views: 456,
    applications_count: 89
  },
  {
    title: "Human Resources Manager",
    company: "Dangote Group",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦6,000,000 – ₦10,000,000/year",
    category: "Human Resources",
    benefits: JSON.stringify(["Health Insurance", "Pension Plan", "Housing Allowance", "Transport Allowance", "Paid Time Off", "Staff Loan Scheme"]),
    description: `About Dangote Group:\nDangote Group is Africa's largest conglomerate with interests in cement, sugar, flour, and other industries. We employ over 30,000 people across Africa.\n\nRole Overview:\nWe're looking for an HR Manager to oversee talent management, employee relations, and organizational development for our Lagos headquarters.\n\nResponsibilities:\n• Develop and implement HR strategies aligned with business goals\n• Manage recruitment, onboarding, and talent development programs\n• Handle employee relations, grievances, and disciplinary procedures\n• Oversee payroll, benefits administration, and compliance\n• Drive diversity, equity, and inclusion initiatives\n• Conduct workforce planning and succession management\n\nRequirements:\n• Bachelor's degree in HR, Business Administration, or related field\n• 7+ years of HR experience, 3+ in a managerial role\n• CIPM or SHRM certification preferred\n• Strong knowledge of Nigerian labor law\n• Experience with HRIS systems (SAP SuccessFactors, BambooHR)\n• Excellent interpersonal and conflict resolution skills`,
    is_featured: false,
    views: 198,
    applications_count: 34
  },
  {
    title: "Mobile App Developer (Flutter)",
    company: "Opay",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦6,000,000 – ₦11,000,000/year",
    category: "Technology",
    benefits: JSON.stringify(["Health Insurance", "Stock Options", "Remote Work", "Learning Budget", "Paid Time Off", "Lunch Allowance"]),
    description: `About OPay:\nOPay is a leading mobile payment platform in Nigeria, serving over 30 million users with fast, reliable financial services.\n\nRole Overview:\nBuild and maintain our Flutter-based mobile applications used by millions of Nigerians for daily financial transactions.\n\nResponsibilities:\n• Develop new features and screens in Flutter/Dart\n• Optimize app performance and reduce crash rates\n• Implement secure payment flows and biometric authentication\n• Write unit and widget tests for reliability\n• Collaborate with designers on UX improvements\n• Integrate with backend APIs and third-party services\n\nRequirements:\n• 3+ years of Flutter development experience\n• Published apps on Google Play and/or Apple App Store\n• Strong understanding of Dart, state management (Bloc/Riverpod)\n• Experience with REST APIs, GraphQL, and WebSocket\n• Knowledge of mobile security best practices\n• Experience with CI/CD for mobile (Fastlane, Codemagic)`,
    is_featured: true,
    views: 534,
    applications_count: 72
  },
  {
    title: "Financial Analyst",
    company: "Access Bank",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦4,000,000 – ₦7,500,000/year",
    category: "Finance",
    benefits: JSON.stringify(["Health Insurance", "Pension Plan", "Housing Allowance", "Staff Loan Scheme", "Paid Time Off", "Performance Bonus"]),
    description: `About Access Bank:\nAccess Bank is one of Nigeria's largest financial institutions, serving over 40 million customers with a full range of banking services.\n\nRole Overview:\nJoin our Corporate Finance team to support strategic decision-making through financial modeling, forecasting, and business analysis.\n\nResponsibilities:\n• Build financial models for investment decisions and valuations\n• Prepare monthly management reports and variance analysis\n• Support budgeting and forecasting processes\n• Analyze business performance and identify growth opportunities\n• Assist with M&A due diligence and deal analysis\n• Present insights to senior management\n\nRequirements:\n• Bachelor's degree in Finance, Accounting, or Economics\n• 3+ years of financial analysis experience (banking preferred)\n• Advanced Excel and financial modeling skills\n• Experience with ERP systems (SAP, Oracle)\n• ACA or CFA certification is a plus\n• Strong attention to detail and analytical thinking`,
    is_featured: false,
    views: 267,
    applications_count: 45
  },
  {
    title: "Content Writer & Strategist",
    company: "PiggyVest",
    location: "Remote",
    type: "Full-time",
    salary_range: "₦3,500,000 – ₦6,000,000/year",
    category: "Marketing",
    benefits: JSON.stringify(["Health Insurance", "Remote Work", "Flexible Hours", "Paid Time Off", "Learning Budget"]),
    description: `About PiggyVest:\nPiggyVest is Nigeria's leading savings and investment platform, helping over 4 million Nigerians build wealth through automated savings and smart investments.\n\nRole Overview:\nWe need a talented Content Writer & Strategist to own our content marketing — from blog posts and social media to email campaigns and thought leadership.\n\nResponsibilities:\n• Write engaging blog posts, social media content, and email newsletters\n• Develop content strategy aligned with growth objectives\n• Conduct keyword research and optimize content for SEO\n• Create financial literacy content for our user community\n• Manage editorial calendar and content pipeline\n• Track content performance metrics and iterate\n\nRequirements:\n• 3+ years of content writing experience\n• Excellent written English and storytelling skills\n• Experience with SEO tools (Ahrefs, SEMrush)\n• Understanding of content marketing funnels\n• Experience with CMS platforms and email marketing tools\n• Interest in personal finance and fintech`,
    is_featured: false,
    views: 378,
    applications_count: 91
  },
  {
    title: "Backend Engineer (Node.js)",
    company: "Cowrywise",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦5,000,000 – ₦9,500,000/year",
    category: "Technology",
    benefits: JSON.stringify(["Health Insurance", "Stock Options", "Remote Work", "Learning Budget", "Paid Time Off", "Wellness Allowance"]),
    description: `About Cowrywise:\nCowrywise helps Nigerians save and invest with ease. We're making wealth-building accessible through technology.\n\nRole Overview:\nJoin our backend engineering team to build robust, secure APIs that power our savings and investment platform used by over 2 million Nigerians.\n\nResponsibilities:\n• Design and build RESTful APIs and microservices in Node.js\n• Implement secure payment integrations and third-party APIs\n• Optimize database queries and system performance\n• Write comprehensive tests and maintain code quality\n• Manage deployments and monitor system health\n• Participate in architecture decisions\n\nRequirements:\n• 3+ years of backend development with Node.js\n• Strong experience with PostgreSQL and Redis\n• Knowledge of authentication (JWT, OAuth) and security best practices\n• Experience with message queues (RabbitMQ, Bull)\n• Understanding of CI/CD pipelines\n• Familiarity with AWS or GCP`,
    is_featured: false,
    views: 312,
    applications_count: 57
  },
  {
    title: "Customer Success Manager",
    company: "Termii",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦3,500,000 – ₦6,500,000/year",
    category: "Customer Success",
    benefits: JSON.stringify(["Health Insurance", "Remote Work", "Flexible Hours", "Paid Time Off", "Team Events"]),
    description: `About Termii:\nTermii is a messaging platform that helps businesses across Africa communicate with customers via SMS, email, and WhatsApp.\n\nRole Overview:\nAs a Customer Success Manager, you'll be the primary point of contact for our enterprise clients — ensuring they get maximum value from our platform and driving retention and expansion.\n\nResponsibilities:\n• Onboard new enterprise clients and drive product adoption\n• Conduct regular business reviews with key accounts\n• Identify upsell and cross-sell opportunities\n• Resolve customer issues and escalate when needed\n• Track NPS, CSAT, and other health metrics\n• Collaborate with product team on customer feedback\n\nRequirements:\n• 3+ years in customer success, account management, or related role\n• Experience in SaaS or tech company\n• Excellent communication and relationship-building skills\n• Analytical mindset with experience using CRM tools\n• Ability to manage multiple accounts simultaneously\n• Problem-solving orientation and proactive attitude`,
    is_featured: false,
    views: 189,
    applications_count: 28
  },
  {
    title: "Cybersecurity Analyst",
    company: "Zenith Bank",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦6,000,000 – ₦10,500,000/year",
    category: "Technology",
    benefits: JSON.stringify(["Health Insurance", "Pension Plan", "Housing Allowance", "Staff Loan Scheme", "Paid Time Off", "Performance Bonus"]),
    description: `About Zenith Bank:\nZenith Bank is one of Nigeria's most profitable banks, known for its strong technology infrastructure and commitment to digital banking innovation.\n\nRole Overview:\nJoin our Information Security team to protect our banking systems, customer data, and digital assets from cyber threats.\n\nResponsibilities:\n• Monitor security systems and respond to alerts\n• Conduct vulnerability assessments and penetration testing\n• Develop and enforce security policies and procedures\n• Perform incident response and forensic analysis\n• Manage firewall, SIEM, and endpoint security solutions\n• Stay current on emerging threats and security trends\n\nRequirements:\n• Bachelor's degree in Computer Science or related field\n• 3+ years of cybersecurity experience (banking/finance preferred)\n• CISSP, CEH, or CompTIA Security+ certification\n• Experience with SIEM tools (Splunk, QRadar)\n• Knowledge of network security and cryptography\n• Understanding of PCI-DSS and regulatory compliance`,
    is_featured: false,
    views: 245,
    applications_count: 31
  },
  {
    title: "Graphic Designer",
    company: "Bolt Nigeria",
    location: "Lagos, Nigeria",
    type: "Contract",
    salary_range: "₦3,000,000 – ₦5,500,000/year",
    category: "Design",
    benefits: JSON.stringify(["Remote Work", "Flexible Hours", "Learning Budget"]),
    description: `About Bolt:\nBolt is a European mobility platform operating ride-hailing, food delivery, and scooter services across Africa and Europe.\n\nRole Overview:\nWe need a creative Graphic Designer to produce compelling visual assets for our marketing campaigns, social media, and in-app experiences across the Nigerian market.\n\nResponsibilities:\n• Create visual assets for digital marketing campaigns\n• Design social media graphics, banners, and email templates\n• Produce in-app illustrations and UI assets\n• Maintain brand consistency across all touchpoints\n• Collaborate with marketing and product teams\n• Create motion graphics and short video content\n\nRequirements:\n• 2+ years of graphic design experience\n• Proficiency in Adobe Creative Suite (Photoshop, Illustrator, InDesign)\n• Experience with Figma for UI/UX collaboration\n• Strong portfolio with digital marketing examples\n• Understanding of brand guidelines and visual identity\n• Motion graphics skills (After Effects) are a plus`,
    is_featured: false,
    views: 423,
    applications_count: 97
  },
  {
    title: "Sales Executive",
    company: "Moniepoint",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦3,000,000 – ₦6,000,000/year + Commission",
    category: "Sales",
    benefits: JSON.stringify(["Health Insurance", "Commission Structure", "Transport Allowance", "Paid Time Off", "Performance Bonus"]),
    description: `About Moniepoint:\nMoniepoint is Nigeria's fastest-growing fintech, powering payments for over 2 million businesses with POS terminals and business management tools.\n\nRole Overview:\nDrive merchant acquisition by onboarding new businesses to Moniepoint's payment and business management platform.\n\nResponsibilities:\n• Identify and approach potential merchant clients\n• Conduct product demos and onboarding sessions\n• Meet and exceed monthly sales targets\n• Build and maintain a sales pipeline\n• Gather market intelligence and competitor insights\n• Provide post-sale support to ensure merchant satisfaction\n\nRequirements:\n• 2+ years of B2B sales experience (fintech preferred)\n• Strong negotiation and communication skills\n• Self-motivated with proven track record of hitting targets\n• Valid driver's license and willingness to travel within Lagos\n• Basic understanding of payment systems\n• OND/HND/BSc in any field`,
    is_featured: false,
    views: 567,
    applications_count: 134
  },
  {
    title: "Cloud Solutions Architect",
    company: "Google Nigeria",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "$80,000 – $140,000/year",
    category: "Technology",
    benefits: JSON.stringify(["Health Insurance", "401(k) Plan", "Stock Options (RSU)", "Paid Parental Leave", "Relocation Package", "Free Meals", "Gym Membership", "Learning Budget"]),
    description: `About Google Nigeria:\nGoogle's Lagos office is part of our Africa expansion, focused on building products and infrastructure for the next billion users.\n\nRole Overview:\nAs a Cloud Solutions Architect, you'll work with enterprise customers across West Africa to design and implement cloud solutions on Google Cloud Platform.\n\nResponsibilities:\n• Design scalable cloud architectures for enterprise workloads\n• Lead technical discovery workshops with customers\n• Create proof-of-concept solutions and demos\n• Provide best practices for security, cost, and performance\n• Support customers through migration and modernization\n• Collaborate with product engineering on customer feedback\n\nRequirements:\n• 7+ years in software engineering or solutions architecture\n• Deep expertise in cloud platforms (GCP preferred, AWS/Azure accepted)\n• Experience with container orchestration (Kubernetes/GKE)\n• Strong understanding of networking, databases, and security\n• Excellent presentation and customer-facing skills\n• Google Cloud Professional certifications preferred`,
    is_featured: true,
    views: 892,
    applications_count: 156
  },
  {
    title: "Operations Manager",
    company: "Chowdeck",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦5,000,000 – ₦8,500,000/year",
    category: "Operations",
    benefits: JSON.stringify(["Health Insurance", "Meal Allowance", "Transport Allowance", "Paid Time Off", "Performance Bonus", "Team Events"]),
    description: `About Chowdeck:\nChowdeck is Nigeria's fastest-growing food delivery startup, connecting restaurants with hungry customers across major cities.\n\nRole Overview:\nManage day-to-day delivery operations in Lagos, ensuring smooth coordination between restaurants, riders, and customers.\n\nResponsibilities:\n• Oversee delivery operations and optimize for speed and quality\n• Manage rider fleet recruitment, training, and performance\n• Analyze operational metrics and implement improvements\n• Handle escalations and ensure customer satisfaction\n• Coordinate with restaurant partners on operations\n• Manage operational budgets and vendor relationships\n\nRequirements:\n• 4+ years of operations or logistics management experience\n• Experience in food delivery, e-commerce, or logistics preferred\n• Strong analytical and problem-solving skills\n• Experience managing teams of 20+ people\n• Proficiency with operations tools and spreadsheets\n• Ability to work in a fast-paced startup environment`,
    is_featured: false,
    views: 312,
    applications_count: 48
  },
  {
    title: "Legal Counsel",
    company: "GTBank",
    location: "Lagos, Nigeria",
    type: "Full-time",
    salary_range: "₦8,000,000 – ₦14,000,000/year",
    category: "Legal",
    benefits: JSON.stringify(["Health Insurance", "Pension Plan", "Housing Allowance", "Staff Loan Scheme", "Paid Time Off", "Car Allowance"]),
    description: `About GTBank:\nGuaranty Trust Bank is one of Nigeria's most respected financial institutions, known for innovation and excellent corporate governance.\n\nRole Overview:\nWe're seeking an experienced Legal Counsel to advise on regulatory compliance, contracts, litigation, and strategic legal matters across the bank's operations.\n\nResponsibilities:\n• Advise on banking regulations and CBN compliance requirements\n• Draft, review, and negotiate commercial contracts\n• Manage litigation and dispute resolution matters\n• Provide legal support for M&A and strategic partnerships\n• Ensure compliance with data protection regulations (NDPR)\n• Train staff on legal and regulatory matters\n\nRequirements:\n• LL.B and BL from a recognized institution\n• 7+ years of legal experience (banking/finance sector required)\n• Called to the Nigerian Bar\n• Strong knowledge of banking law and regulation\n• Excellent research, writing, and negotiation skills\n• Experience with cross-border transactions is a plus`,
    is_featured: false,
    views: 178,
    applications_count: 22
  },
  {
    title: "Business Analyst",
    company: "Airtel Nigeria",
    location: "Abuja, Nigeria",
    type: "Full-time",
    salary_range: "₦4,500,000 – ₦8,000,000/year",
    category: "Business",
    benefits: JSON.stringify(["Health Insurance", "Pension Plan", "Transport Allowance", "Paid Time Off", "Performance Bonus", "Airtime Allowance"]),
    description: `About Airtel Nigeria:\nAirtel is one of Nigeria's leading telecommunications companies, providing mobile, data, and digital services to millions of Nigerians.\n\nRole Overview:\nJoin our Strategy & Business Development team to analyze market trends, evaluate new business opportunities, and support strategic decision-making.\n\nResponsibilities:\n• Conduct market research and competitive analysis\n• Build business cases for new products and partnerships\n• Develop financial models and forecasts\n• Prepare board presentations and executive reports\n• Support strategic planning and M&A activities\n• Track industry trends and regulatory developments\n\nRequirements:\n• Bachelor's degree in Business, Economics, or related field\n• 3+ years of business analysis or consulting experience\n• Advanced Excel and PowerPoint skills\n• Experience with data visualization tools (Power BI, Tableau)\n• Telecoms or tech industry experience preferred\n• MBA is a plus`,
    is_featured: false,
    views: 234,
    applications_count: 56
  }
];

// Create a demo recruiter user first
const bcrypt = require('bcryptjs');
const usersPath = path.join(__dirname, 'jobbridge_users.json');
let users = [];
try {
  if (fs.existsSync(usersPath)) {
    users = JSON.parse(fs.readFileSync(usersPath, 'utf-8') || '[]');
  }
} catch (e) {}

// Check if demo recruiter exists
let demoRecruiter = users.find(u => u.email === 'recruiter@jobbridge.com');
if (!demoRecruiter) {
  demoRecruiter = {
    id: actualRecruiterId,
    email: 'recruiter@jobbridge.com',
    password_hash: bcrypt.hashSync('recruiter123', 8),
    full_name: 'JobBridge Recruiter',
    role: 'recruiter',
    company: 'JobBridge',
    phone: null,
    created_at: new Date().toISOString()
  };
  users.push(demoRecruiter);
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  console.log('Created demo recruiter account');
  // Also insert into DB
  if (db.available) {
    db.upsertUser(demoRecruiter);
  }
} else {
  actualRecruiterId = demoRecruiter.id;
}

const now = new Date();
const seedJobs = jobs.map((job, i) => {
  const createdAt = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000 * Math.floor(Math.random() * 3 + 1)));
  return {
    id: uuidv4(),
    recruiter_id: actualRecruiterId,
    title: job.title,
    company: job.company,
    description: job.description,
    location: job.location,
    type: job.type,
    salary_range: job.salary_range,
    is_featured: job.is_featured ? 1 : 0,
    is_active: 1,
    expires_at: null,
    views: job.views || Math.floor(Math.random() * 500),
    applications_count: job.applications_count || Math.floor(Math.random() * 100),
    created_at: createdAt.toISOString(),
    updated_at: createdAt.toISOString(),
    benefits: job.benefits,
    category: job.category,
    company_logo: null
  };
});

// Clear existing jobs
if (db.available) {
  try {
    const existingJobs = db.getAllJobs();
    for (const j of existingJobs) {
      db.deleteJob(j.id);
    }
    console.log(`Cleared ${existingJobs.length} existing jobs`);
  } catch (e) {
    console.log('No existing jobs to clear');
  }
  // Insert new jobs
  for (const job of seedJobs) {
    db.createJob(job);
  }
} else {
  // JSON fallback
  const jobsPath = path.join(__dirname, 'jobs.json');
  fs.writeFileSync(jobsPath, JSON.stringify(seedJobs, null, 2));
}

console.log(`Successfully seeded ${seedJobs.length} jobs!`);
console.log('\nJobs created:');
seedJobs.forEach((j, i) => console.log(`  ${i + 1}. ${j.title} at ${j.company} (${j.location})`));
