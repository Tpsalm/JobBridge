-- =========================================================================
-- Seed: Trade Aviator — Urgent Job Posting
-- Run this in Supabase SQL Editor
-- =========================================================================

INSERT INTO public.jobs (recruiter_id, title, company, description, location, type, salary_range, category, requirements, is_featured, is_active)
SELECT
  id,
  'Customer Service Representative (Remote)',
  'Trade Aviator',
  'We are hiring a Customer Service Representative to join our growing team!

About Us:
Trade Aviator is a leading fintech company specializing in crypto, gift cards, and digital payment services. We are committed to providing exceptional service to our global customer base.

Role Overview:
We are looking for a dedicated and experienced Customer Service Representative who will be the first point of contact for our customers, helping them navigate our platform and resolve issues efficiently.

Responsibilities:
• Respond to customer inquiries via email, chat, and phone in a timely manner
• Resolve customer complaints and issues related to crypto transactions, gift cards, and digital payments
• Provide accurate information about our products and services
• Escalate complex issues to the appropriate department
• Maintain detailed records of customer interactions
• Contribute to improving our customer service processes

Why Join Us:
• Fully remote position — work from anywhere
• Competitive salary package
• Opportunity to work in the fast-growing fintech/crypto space
• Collaborative and supportive team environment',
  'Remote',
  'Full-time',
  '₦200,000 - ₦400,000 Monthly',
  'Customer Service',
  ARRAY[
    'Minimum of HND/B.Sc. in Human Resources, Marketing, Communications, or a related field',
    '2-4 years experience in Customer Service within the Fintech industry',
    'Strong knowledge of Crypto, Gift Cards, and Digital Payment Services',
    'Excellent communication and interpersonal skills',
    'Must own a smartphone and have reliable internet access'
  ],
  true,
  true
FROM auth.users
ORDER BY created_at ASC
LIMIT 1;
