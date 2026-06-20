const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

let openai = null;
if (OPENAI_API_KEY) {
  try {
    const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    console.log('AI: OpenAI configured');
  } catch (e) {
    console.warn('AI: openai package not installed, using local fallback');
  }
} else {
  console.warn('AI: No OPENAI_API_KEY set. Set it in .env for AI features. Using local fallback.');
}

function callOpenAI(messages, model = 'gpt-4o-mini', maxTokens = 1000) {
  if (!openai) return null;
  return openai.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
  });
}

const COMMON_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'Ruby', 'PHP', 'Swift', 'Kotlin',
  'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'Next.js', 'Nuxt',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'DynamoDB', 'Firebase', 'Supabase',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Jenkins', 'GitHub Actions',
  'REST API', 'GraphQL', 'gRPC', 'WebSocket', 'OAuth', 'JWT', 'OpenAPI',
  'Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'InDesign',
  'UI Design', 'UX Design', 'Wireframing', 'Prototyping', 'User Research', 'Usability Testing',
  'Product Management', 'Agile', 'Scrum', 'JIRA', 'Confluence', 'Sprint Planning',
  'Digital Marketing', 'SEO', 'SEM', 'Google Analytics', 'Content Strategy', 'Social Media',
  'Data Analysis', 'Machine Learning', 'Deep Learning', 'NLP', 'TensorFlow', 'PyTorch',
  'Project Management', 'Leadership', 'Communication', 'Team Building', 'Strategic Planning',
  'Sales', 'Customer Success', 'Account Management', 'CRM', 'Salesforce', 'HubSpot',
  'Finance', 'Accounting', 'QuickBooks', 'Xero', 'Financial Analysis', 'Budgeting',
  'Human Resources', 'Recruiting', 'Onboarding', 'Payroll', 'HRIS',
];

function extractSkillsLocal(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const skill of COMMON_SKILLS) {
    const s = skill.toLowerCase();
    if (lower.includes(s)) {
      found.push(skill);
    }
  }
  return [...new Set(found)];
}

function extractSkillsAI(text) {
  if (!text || text.trim().length < 20) return [];
  const systemPrompt = 'Extract a JSON array of skill keywords from the text. Return only the JSON array, nothing else.';
  return callOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Text:\n' + text.substring(0, 4000) },
  ], 'gpt-4o-mini', 500);
}

const JD_TEMPLATES = {
  'Software Engineer': {
    description: 'We are looking for a talented Software Engineer to join our growing team. You will design, build, and maintain scalable software solutions that power our platform.',
    responsibilities: [
      'Design and implement high-quality, testable code',
      'Collaborate with product and design teams to define features',
      'Participate in code reviews and maintain code quality standards',
      'Troubleshoot and resolve production issues',
      'Contribute to architectural decisions and technical strategy',
    ],
    requirements: [
      'Bachelor\'s degree in Computer Science or related field',
      '3+ years of experience in software development',
      'Strong proficiency in JavaScript/TypeScript and modern frameworks',
      'Experience with cloud services (AWS/GCP/Azure)',
      'Excellent problem-solving and communication skills',
    ],
    benefits: [
      'Competitive salary and equity package',
      'Remote-friendly work environment',
      'Health and wellness benefits',
      'Professional development budget',
      'Flexible work hours',
    ],
  },
  'Product Manager': {
    description: 'We are seeking an experienced Product Manager to own the product roadmap and drive features from ideation to launch. You will work cross-functionally to deliver exceptional user experiences.',
    responsibilities: [
      'Define product vision, strategy, and roadmap',
      'Gather and prioritize product requirements from stakeholders',
      'Work with engineering, design, and marketing teams to ship features',
      'Analyze product metrics and user feedback to inform decisions',
      'Lead sprint planning and product releases',
    ],
    requirements: [
      'Bachelor\'s degree in Business, CS, or related field',
      '4+ years of product management experience',
      'Strong understanding of agile development methodologies',
      'Excellent analytical and data-driven decision-making skills',
      'Proven track record of shipping successful products',
    ],
    benefits: [
      'Competitive compensation package',
      'Health, dental, and vision insurance',
      'Stock options',
      'Flexible PTO policy',
      'Growth and learning opportunities',
    ],
  },
  'Data Scientist': {
    description: 'Join our data team to uncover insights and build ML models that drive business decisions. You will work with large datasets to solve complex problems across the organization.',
    responsibilities: [
      'Analyze large datasets to identify trends and patterns',
      'Build and deploy machine learning models to production',
      'Design A/B tests and analyze experimental results',
      'Present findings and recommendations to stakeholders',
      'Develop data pipelines and reporting dashboards',
    ],
    requirements: [
      'Masters or PhD in Data Science, Statistics, or related field',
      '3+ years of experience in data science or analytics',
      'Proficiency in Python and SQL',
      'Experience with ML frameworks (TensorFlow, PyTorch, scikit-learn)',
      'Strong statistical analysis skills',
    ],
    benefits: [
      'Leading compensation and equity',
      'Flexible remote policy',
      'Conference and learning budget',
      'Health and wellness programs',
      'Collaborative team culture',
    ],
  },
};

const DEFAULT_JD = {
  description: 'We are looking for a dedicated professional to join our team and contribute to our mission. You will play a key role in driving projects forward and delivering value to our users.',
  responsibilities: [
    'Execute on team goals and project milestones',
    'Collaborate with cross-functional teams',
    'Contribute to team processes and improvements',
    'Communicate progress and blockers effectively',
    'Maintain high quality standards in your work',
  ],
  requirements: [
    'Relevant experience in the role',
    'Strong communication and teamwork skills',
    'Ability to work in a fast-paced environment',
    'Problem-solving mindset',
    'Commitment to continuous learning',
  ],
  benefits: [
    'Competitive salary',
    'Health benefits',
    'Flexible work arrangements',
    'Professional development opportunities',
    'Positive team culture',
  ],
};

function generateJDLocal(title, requirements) {
  const lower = title.toLowerCase();
  let template = DEFAULT_JD;

  for (const [role, tmpl] of Object.entries(JD_TEMPLATES)) {
    if (lower.includes(role.toLowerCase())) {
      template = tmpl;
      break;
    }
  }

  const extraReqs = requirements && requirements.length
    ? requirements.filter(r => !template.requirements.some(t => t.toLowerCase().includes(r.toLowerCase())))
    : [];

  return {
    title,
    description: template.description,
    responsibilities: template.responsibilities,
    requirements: [...template.requirements, ...extraReqs.map(r => r.charAt(0).toUpperCase() + r.slice(1))],
    benefits: template.benefits,
  };
}

function scoreCandidatesLocal(jobRequirements, candidates) {
  const reqWords = jobRequirements
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);

  const allSkills = COMMON_SKILLS.map(s => s.toLowerCase());

  return candidates.map(candidate => {
    const profile = ((candidate.skills || []).join(' ') + ' ' + (candidate.resume_text || '')).toLowerCase();

    const matchedSkills = allSkills.filter(s => profile.includes(s));
    const matchedRequirements = reqWords.filter(w => profile.includes(w));

    const skillScore = matchedSkills.length / Math.max(allSkills.length * 0.1, 1);
    const reqScore = matchedRequirements.length / Math.max(reqWords.length, 1);
    const matchScore = Math.min(100, Math.round((skillScore * 0.5 + reqScore * 0.5) * 100));

    return {
      id: candidate.id,
      name: candidate.name,
      role: candidate.role || '',
      match_score: matchScore,
      matched_skills: matchedSkills,
      matched_requirements: matchedRequirements,
      total_skills: matchedSkills.length,
    };
  }).sort((a, b) => b.match_score - a.match_score);
}

async function extractSkills(text) {
  if (openai) {
    const response = await extractSkillsAI(text);
    if (response) {
      try {
        const content = response.choices[0].message.content;
        const json = JSON.parse(content);
        if (Array.isArray(json)) return json;
      } catch (e) { /* fall through */ }
    }
  }
  return extractSkillsLocal(text);
}

async function generateJD(title, requirements) {
  if (openai) {
    const systemPrompt = 'You are an expert HR professional. Generate a job description as JSON with keys: title, description, responsibilities (array), requirements (array), benefits (array). Return only valid JSON.';
    const userPrompt = `Job title: "${title}"\nCore requirements:\n${(requirements || []).map((r, i) => (i+1) + '. ' + r).join('\n') || 'None specified'}`;
    const response = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 'gpt-4o-mini', 1500);
    if (response) {
      try {
        const content = response.choices[0].message.content;
        const cleaned = content.replace(/```(json)?/g, '').trim();
        const json = JSON.parse(cleaned);
        if (json.title && json.description) return json;
      } catch (e) { /* fall through */ }
    }
  }
  return generateJDLocal(title, requirements);
}

async function tailorResume(resumeText, jobDescription, jobTitle) {
  if (openai) {
    const systemPrompt = 'You are an expert resume writer. Given a resume and a job description, rewrite the resume to highlight the most relevant experience and skills for this specific role. Include a professional summary section at the top tailored to the job. Return plain text, no markdown.';
    const userPrompt = `Target Job: ${jobTitle}\n\nJob Description:\n${jobDescription.substring(0, 3000)}\n\nCurrent Resume:\n${resumeText.substring(0, 3000)}`;
    const response = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 'gpt-4o-mini', 2000);
    if (response) {
      const content = response.choices[0].message.content;
      if (content && content.length > 100) return content;
    }
  }
  return resumeText;
}

async function generateCoverLetter(resumeText, jobDescription, jobTitle, companyName) {
  if (openai) {
    const systemPrompt = 'You are an expert career coach. Write a professional, compelling cover letter for a job application. Keep it concise (250-350 words), personalized to the role and company. Return plain text, no markdown.';
    const userPrompt = `Position: ${jobTitle} at ${companyName || 'the company'}\n\nJob Description:\n${jobDescription.substring(0, 2000)}\n\nResume Highlights:\n${resumeText.substring(0, 1500)}`;
    const response = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 'gpt-4o-mini', 1000);
    if (response) {
      const content = response.choices[0].message.content;
      if (content && content.length > 100) return content;
    }
  }
  const name = 'your name';
  return `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${jobTitle} position at ${companyName || 'your company'}. With my background and skills, I am confident I can contribute significantly to your team.\n\n[Your tailored experience and achievements would go here, highlighting specific accomplishments relevant to this role.]\n\nI would welcome the opportunity to discuss how my experience aligns with the needs of your team. Thank you for your consideration.\n\nBest regards,\n${name}`;
}

async function scoreCandidates(jobRequirements, candidates) {
  if (openai && candidates.length <= 20) {
    const systemPrompt = 'You are an AI recruitment assistant. Score each candidate against the job requirements. Return a JSON array of objects with keys: id, match_score (0-100), matched_skills (array). Return only the JSON array.';
    const userPrompt = `Job Requirements:\n${jobRequirements.join('\n')}\n\nCandidates:\n${JSON.stringify(candidates.map(c => ({ id: c.id, name: c.name, skills: c.skills || [], text: (c.resume_text || '').substring(0, 1000) })))}`;
    const response = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 'gpt-4o-mini', 2000);
    if (response) {
      try {
        const content = response.choices[0].message.content;
        const cleaned = content.replace(/```(json)?/g, '').trim();
        const json = JSON.parse(cleaned);
        if (Array.isArray(json)) return json;
      } catch (e) { /* fall through */ }
    }
  }
  return scoreCandidatesLocal(jobRequirements, candidates);
}

module.exports = {
  extractSkills,
  generateJD,
  tailorResume,
  generateCoverLetter,
  scoreCandidates,
};
