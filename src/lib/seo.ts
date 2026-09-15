export const SITE_URL = "https://www.jobbridge.com.ng";
export const SITE_NAME = "JobBridge";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export interface SeoRoute {
  path: string;
  title: string;
  description: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
  noindex?: boolean;
}

export const seoRoutes: SeoRoute[] = [
  {
    path: "/",
    title: "JobBridge | AI Job Matching, Hiring and Career Tools in Nigeria",
    description:
      "Find jobs, hire verified talent, build AI-optimized resumes, and connect with professional services on JobBridge.",
    changefreq: "daily",
    priority: 1,
  },
  {
    path: "/jobs",
    title: "Find Jobs in Nigeria | JobBridge",
    description:
      "Search verified job opportunities, save roles, and apply faster with JobBridge's AI-powered job marketplace.",
    changefreq: "daily",
    priority: 0.95,
  },
  {
    path: "/recruiter",
    title: "Recruiter Hiring Platform | JobBridge",
    description:
      "Post jobs, manage applicants, and discover qualified candidates with JobBridge recruiter tools.",
    changefreq: "weekly",
    priority: 0.85,
  },
  {
    path: "/providers",
    title: "Trusted Service Providers | JobBridge",
    description:
      "Find verified professionals for business, career, creative, technical, and support services.",
    changefreq: "weekly",
    priority: 0.85,
  },
  {
    path: "/business",
    title: "Business Advertising on JobBridge",
    description:
      "Promote your business to job seekers, employers, and professionals with JobBridge advert packages.",
    changefreq: "weekly",
    priority: 0.8,
  },
  {
    path: "/pricing",
    title: "JobBridge Pricing and Plans",
    description:
      "Compare JobBridge plans for job posts, service listings, business adverts, and AI career tools.",
    changefreq: "monthly",
    priority: 0.8,
  },
  {
    path: "/payment",
    title: "Secure Payments | JobBridge",
    description:
      "Pay securely for JobBridge premium plans, job posts, adverts, and service provider listings.",
    changefreq: "monthly",
    priority: 0.55,
  },
  {
    path: "/ai-resume",
    title: "AI Resume Builder and Career Tools | JobBridge",
    description:
      "Create stronger resumes, prepare for interviews, and improve applications with JobBridge AI career tools.",
    changefreq: "weekly",
    priority: 0.85,
  },
  {
    path: "/career",
    title: "Career Hub | JobBridge",
    description:
      "Explore career resources, launch updates, and job search tools built for the modern workforce.",
    changefreq: "weekly",
    priority: 0.75,
  },
  {
    path: "/analytics",
    title: "Career Analytics and Job Market Insights | JobBridge",
    description:
      "Explore JobBridge career analytics, hiring trends, salary benchmarks, skills demand, and job search performance insights.",
    changefreq: "weekly",
    priority: 0.7,
  },
  {
    path: "/games",
    title: "Career Games and Skill Challenges | JobBridge",
    description:
      "Practice career skills with JobBridge games, quizzes, memory challenges, and interactive learning activities.",
    changefreq: "weekly",
    priority: 0.6,
  },
  {
    path: "/blog",
    title: "Career Advice and Hiring Insights | JobBridge Blog",
    description:
      "Read practical advice on job search, hiring, AI recruitment, remote work, salary, and career growth.",
    changefreq: "weekly",
    priority: 0.75,
  },
  {
    path: "/about",
    title: "About JobBridge",
    description:
      "Learn how JobBridge connects talent, employers, service providers, and businesses through smarter career technology.",
    changefreq: "monthly",
    priority: 0.7,
  },
  {
    path: "/ceo",
    title: "JobBridge Leadership and Vision",
    description:
      "Meet the JobBridge leadership team and learn about the mission to connect talent with opportunity.",
    changefreq: "monthly",
    priority: 0.65,
  },
  {
    path: "/support",
    title: "JobBridge Support Center",
    description:
      "Get help with your JobBridge account, job applications, recruiting, payments, and service listings.",
    changefreq: "monthly",
    priority: 0.65,
  },
  {
    path: "/contact",
    title: "Contact JobBridge",
    description:
      "Contact the JobBridge team for support, partnerships, business inquiries, and account help.",
    changefreq: "monthly",
    priority: 0.6,
  },
  {
    path: "/privacy",
    title: "Privacy Center | JobBridge",
    description:
      "Review how JobBridge handles privacy, data protection, account controls, and user information.",
    changefreq: "yearly",
    priority: 0.45,
  },
  {
    path: "/terms",
    title: "Terms of Service | JobBridge",
    description:
      "Read the JobBridge terms of service for using the platform, marketplace, and career tools.",
    changefreq: "yearly",
    priority: 0.45,
  },
  {
    path: "/data-safety",
    title: "Data Safety | JobBridge",
    description:
      "A plain-language summary of the data JobBridge collects, why it is used, and how users control it.",
    changefreq: "yearly",
    priority: 0.45,
  },
  {
    path: "/delete-account",
    title: "Delete Your JobBridge Account",
    description:
      "Request deletion of your JobBridge account, profile, resumes, applications, and personal data.",
    changefreq: "yearly",
    priority: 0.35,
  },
  {
    path: "/report-content",
    title: "Report Content | JobBridge",
    description:
      "Report suspicious, unsafe, or inaccurate content to the JobBridge team for review.",
    changefreq: "yearly",
    priority: 0.35,
  },
];

export const noindexPaths = new Set([
  "/auth/callback",
  "/reset-password",
  "/login",
  "/signup",
  "/profile",
  "/settings",
  "/payment",
  "/my-jobs",
  "/messages",
  "/notifications",
  "/following",
  "/reviews",
  "/job-preferences",
  "/profile-visibility",
  "/admin/email-logs",
]);

export function normalizePath(pathname: string) {
  if (!pathname) return "/";
  let next = pathname.replace(/\/{2,}/g, "/").replace(/_/g, "-").toLowerCase();
  if (next.length > 1) next = next.replace(/\/+$/, "");
  return next || "/";
}

export function routeForPath(pathname: string): SeoRoute {
  const normalized = normalizePath(pathname);
  if (normalized.startsWith("/blog/")) {
    return {
      path: normalized,
      title: "Career Article | JobBridge Blog",
      description:
        "Read JobBridge career advice, hiring insights, and practical guidance for job seekers and recruiters.",
      changefreq: "monthly",
      priority: 0.65,
    };
  }

  return (
    seoRoutes.find((route) => route.path === normalized) || {
      path: normalized,
      title: "JobBridge | Career Marketplace",
      description:
        "JobBridge connects job seekers, recruiters, service providers, and businesses through one professional network.",
      changefreq: "monthly",
      priority: 0.5,
      noindex: noindexPaths.has(normalized),
    }
  );
}

export function canonicalUrl(pathname: string) {
  const normalized = normalizePath(pathname);
  return `${SITE_URL}${normalized === "/" ? "" : normalized}`;
}
