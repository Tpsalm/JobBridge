import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, User } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

const blogPosts = [
  {
    id: 1,
    title: 'The Future of AI in Hiring',
    excerpt: 'As artificial intelligence reshapes the recruitment landscape, companies that embrace AI-powered matching see 3x faster hiring cycles and 40% better retention rates. Learn how to prepare your team for the AI-augmented workforce.',
    content: 'Artificial intelligence is fundamentally transforming how companies hire. From resume screening to candidate matching, AI tools are making recruitment faster, fairer, and more effective.\n\nAI-powered recruitment platforms can analyze thousands of resumes in seconds, identifying the best candidates based on skills, experience, and cultural fit. Machine learning algorithms continuously improve their recommendations based on hiring outcomes, creating a virtuous cycle of better matches over time.\n\nCompanies that have adopted AI-driven hiring report 3x faster time-to-hire and 40% improvement in retention rates. These tools eliminate unconscious bias by focusing on objective qualifications rather than subjective impressions.\n\nHowever, successful implementation requires careful planning. HR teams need training to interpret AI recommendations effectively, and companies must ensure their AI tools are transparent and auditable.\n\nThe future of hiring is hybrid — combining the efficiency of AI with the irreplaceable human elements of empathy, intuition, and relationship-building that define great recruitment.',
    category: 'AI & Tech',
    author: 'Sarah Martinez',
    date: 'June 1, 2026',
    readTime: 8,
    img: 'https://images.pexels.com/photos/7176027/pexels-photo-7176027.jpeg?auto=compress&cs=tinysrgb&w=800&h=400&dpr=2',
  },
  {
    id: 2,
    title: '10 Resume Mistakes That Cost You Interviews',
    excerpt: 'Discover the most common resume mistakes that keep candidates from landing interviews. Learn what recruiters are looking for and how to optimize your resume to stand out.',
    content: 'Your resume is often the first impression you make on a potential employer. Yet many qualified candidates sabotage their chances with avoidable mistakes.\n\n1. Generic Objective Statements: Replace vague objectives with a professional summary that highlights your unique value proposition and key achievements.\n\n2. Typos and Grammatical Errors: Even one error can signal carelessness. Use tools like Grammarly and have a friend review your resume before submitting.\n\n3. Overcomplicating Formatting: ATS systems struggle with complex layouts. Stick to clean, simple formatting with standard fonts and clear section headers.\n\n4. Listing Duties Instead of Achievements: Instead of saying "Responsible for social media," say "Increased engagement by 150% through targeted content strategy."\n\n5. Including Irrelevant Experience: Tailor your resume for each application. Remove experience that doesn\'t support your career narrative.\n\n6. Missing Keywords: Many companies use ATS filters. Study the job description and incorporate relevant keywords naturally.\n\n7. Poor Contact Information: Ensure your email, phone, and LinkedIn profile are up to date and professional.\n\n8. Overly Long or Too Short: Aim for one page per 10 years of experience. Be concise but comprehensive.\n\n9. Including References: Don\'t waste space. Simply note "References available upon request."\n\n10. Not Quantifying Results: Use numbers to demonstrate impact — revenue growth, time saved, team size managed.',
    category: 'Career Advice',
    author: 'Jane Wilson',
    date: 'May 28, 2026',
    readTime: 7,
    img: 'https://images.pexels.com/photos/7972572/pexels-photo-7972572.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&dpr=2',
  },
  {
    id: 3,
    title: 'How to Negotiate a 20% Higher Salary',
    excerpt: 'Salary negotiation is one of the most important career skills you can develop. Learn proven strategies to negotiate effectively and increase your lifetime earnings.',
    content: 'Salary negotiation can feel uncomfortable, but it\'s one of the most important career skills you can develop. A single successful negotiation can increase your lifetime earnings by hundreds of thousands of dollars.\n\nResearch the Market: Before any negotiation, arm yourself with data. Use sites like JobBridge, Glassdoor, and LinkedIn Salary to understand the compensation range for your role, experience level, and location.\n\nKnow Your Value: Document your achievements and quantify your impact. If you increased revenue, reduced costs, or improved efficiency, have those numbers ready.\n\nTime It Right: The best time to negotiate is after you\'ve received an offer but before you accept. You have maximum leverage at this point.\n\nUse Anchoring: Make the first specific salary mention. Research shows that the first number mentioned in a negotiation serves as an anchor that influences the entire discussion.\n\nFocus on Total Compensation: Salary is just one component. Consider bonuses, equity, benefits, vacation time, remote work flexibility, and professional development budgets.\n\nPractice Your Pitch: Rehearse what you\'ll say. Role-play with a friend or mentor. The more prepared you are, the more confident you\'ll feel.\n\nBe Prepared to Walk Away: Know your walk-away number beforehand. If the offer doesn\'t meet your minimum requirements, be willing to decline respectfully.',
    category: 'Salary & Benefits',
    author: 'Michael Torres',
    date: 'May 25, 2026',
    readTime: 6,
    img: 'https://images.pexels.com/photos/4386285/pexels-photo-4386285.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&dpr=2',
  },
  {
    id: 4,
    title: 'Remote Work Best Practices in 2026',
    excerpt: 'From productivity tools to work-life balance, discover the best practices that remote teams are using to stay connected and productive in the hybrid workplace.',
    content: 'Remote work has evolved from a temporary solution to a permanent fixture in the modern workplace. Here are the best practices that successful remote teams are using in 2026.\n\nEstablish Clear Communication Norms: Define which channels to use for different types of communication. Slack for quick questions, email for formal requests, video calls for complex discussions.\n\nOver-Communicate: In a remote environment, you can\'t rely on hallway conversations. Share updates proactively, document decisions, and keep stakeholders informed.\n\nCreate Dedicated Workspaces: Invest in a proper desk, ergonomic chair, and good lighting. A dedicated workspace signals to your brain that it\'s time to focus.\n\nSet Boundaries: Define your working hours and communicate them to your team. When work ends, close your laptop and step away.\n\nPrioritize Asynchronous Communication: Not everything requires a meeting. Use Loom for video updates, Notion for documentation, and async standups to reduce meeting fatigue.\n\nInvest in Team Connection: Schedule virtual coffee chats, team retreats, and regular social events. Strong relationships are the foundation of effective remote collaboration.\n\nUse the Right Tools: From project management (Linear, Asana) to documentation (Notion, Confluence) to communication (Slack, Teams), the right tools make remote work seamless.\n\nFocus on Outcomes, Not Hours: Measure productivity by results, not time spent online. This shift in mindset is critical for remote team success.',
    category: 'Remote Work',
    author: 'Aisha Patel',
    date: 'May 22, 2026',
    readTime: 9,
    img: 'https://images.pexels.com/photos/4386333/pexels-photo-4386333.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&dpr=2',
  },
  {
    id: 5,
    title: 'Building a Diverse Hiring Pipeline',
    excerpt: 'Diversity in hiring starts with intentional pipeline building. Learn how top companies are expanding their recruitment sources and creating inclusive hiring processes.',
    content: 'Building a diverse workforce requires intentional effort at every stage of the hiring process. Here\'s how leading companies are building more inclusive hiring pipelines.\n\nExpand Your Sourcing Channels: Don\'t rely on the same recruitment sources. Partner with diverse professional organizations, attend industry events for underrepresented groups, and use platforms that prioritize diversity.\n\nWrite Inclusive Job Descriptions: Use gender-neutral language, focus on required skills rather than years of experience, and include a diversity statement. Tools like Gender Decoder can help identify biased language.\n\nDiversify Your Interview Panels: Ensure that candidates meet diverse team members during the interview process. This signals that your company values diversity and provides multiple perspectives on each candidate.\n\nImplement Structured Interviews: Use the same questions for all candidates and score responses against predefined criteria. Structured interviews reduce bias and improve hiring accuracy.\n\nSet Diversity Goals: Establish clear, measurable diversity targets for your hiring pipeline. Track progress at each stage — sourcing, screening, interviewing, and offer acceptance.\n\nRemove Degree Requirements: Many roles don\'t actually require a degree. Focus on skills and experience instead, opening opportunities to candidates from non-traditional backgrounds.\n\nCreate Return-ship Programs: Design programs specifically for people returning to the workforce after career breaks. These programs tap into an overlooked talent pool.\n\nMeasure and Iterate: Regularly analyze your hiring data for bias. If certain groups are dropping off at specific stages, investigate and adjust your process accordingly.',
    category: 'Hiring',
    author: 'Alex Chen',
    date: 'May 20, 2026',
    readTime: 9,
    img: 'https://images.pexels.com/photos/3194519/pexels-photo-3194519.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&dpr=2',
  },
  {
    id: 6,
    title: 'The Rise of Skills-Based Hiring',
    excerpt: 'Skills-based hiring is transforming how companies evaluate candidates. Explore the shift from degree requirements to competency-focused recruitment strategies.',
    content: 'The traditional degree-based hiring model is giving way to a more equitable and effective approach: skills-based hiring. Companies are increasingly focusing on what candidates can do rather than where they went to school.\n\nWhat Is Skills-Based Hiring? Instead of filtering candidates by educational credentials, skills-based hiring evaluates candidates based on their demonstrated abilities through assessments, portfolios, and work samples.\n\nWhy It Matters: This approach dramatically expands the talent pool. Many skilled professionals lack traditional degrees but have exceptional abilities. Skills-based hiring also reduces bias and improves prediction of job performance.\n\nHow to Implement: Start by defining the specific skills required for each role. Create skills assessments that accurately measure these competencies. Use work samples and portfolio reviews as part of the evaluation process.\n\nTools and Platforms: Platforms like JobBridge support skills-based hiring with AI-powered skill assessments, portfolio integrations, and competency-based matching algorithms.\n\nThe Results: Companies using skills-based hiring report 5x more candidates per role, higher quality of hire, and improved diversity metrics. Candidates appreciate the focus on their actual abilities rather than pedigree.\n\nGetting Started: Begin with roles where skills are most easily measured — technical positions, creative roles, and analytical functions. Gradually expand to all roles as you refine your approach.',
    category: 'AI & Tech',
    author: 'Sam Kim',
    date: 'May 17, 2026',
    readTime: 5,
    img: 'https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&dpr=2',
  },
  {
    id: 7,
    title: 'How to Ace a Technical Interview',
    excerpt: 'Preparation is key to technical interview success. This comprehensive guide covers common patterns, communication strategies, and practice resources.',
    content: 'Technical interviews can be challenging, but with the right preparation strategy, you can approach them with confidence.\n\nUnderstand the Format: Technical interviews typically include coding challenges, system design questions, and behavioral interviews. Know what to expect at each stage.\n\nMaster the Fundamentals: Review data structures (arrays, linked lists, trees, graphs, hash tables) and algorithms (sorting, searching, dynamic programming). Practice until these concepts are second nature.\n\nPractice Out Loud: Solve problems while verbalizing your thought process. Interviewers want to understand how you think, not just whether you arrive at the correct answer.\n\nUse the STAR Method: For behavioral questions, structure your answers around Situation, Task, Action, and Result. This framework ensures you provide complete, compelling responses.\n\nAsk Clarifying Questions: Before writing code, ask questions to understand the problem fully. What are the edge cases? What are the constraints? This demonstrates analytical thinking.\n\nWrite Clean Code: Focus on readability, proper variable naming, and modular design. Clean code is as important as correct code.\n\nTest Your Solution: After writing code, walk through test cases including edge cases. This shows thoroughness and attention to detail.\n\nReview System Design: For senior roles, practice designing scalable systems. Study topics like load balancing, caching, database sharding, and microservices architecture.\n\nResources: Use LeetCode, HackerRank, and Pramp for practice. Mock interviews with peers can dramatically improve your performance.',
    category: 'Career Advice',
    author: 'Riley Johnson',
    date: 'May 14, 2026',
    readTime: 8,
    img: 'https://images.pexels.com/photos/8456191/pexels-photo-8456191.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&dpr=2',
  },
  {
    id: 8,
    title: 'Scaling Engineering Teams Remotely',
    excerpt: 'Building and scaling high-performing remote engineering teams requires intentional culture, communication frameworks, and the right tools.',
    content: 'Scaling an engineering team is challenging enough in person. Doing it remotely adds another layer of complexity. Here\'s how successful companies are building remote engineering teams that scale.\n\nDefine Your Culture Early: Document your engineering values, communication norms, and decision-making processes. These guidelines become the bedrock of your remote culture as the team grows.\n\nInvest in Onboarding: Create a structured remote onboarding program. Assign buddies, schedule regular check-ins, and provide clear documentation. New hires should feel connected from day one.\n\nBuild Async-First Communication: Not everyone is in the same timezone. Embrace asynchronous communication through written documents, recorded demos, and thoughtful status updates.\n\nUse the Right Tools: Version control (Git), CI/CD (GitHub Actions), documentation (Notion), communication (Slack), and project management (Linear) are essential for remote engineering teams.\n\nCreate Opportunities for Connection: Schedule regular team social events, hackathons, and virtual coffee chats. Strong relationships improve collaboration and reduce turnover.\n\nFocus on Output, Not Hours: Measure productivity by shipped features, code quality, and team velocity. Trust your engineers to manage their own schedules.\n\nPromote from Within: As you scale, create clear career progression paths. Remote teams need visible growth opportunities to retain top talent.\n\nRegular Retrospectives: Hold regular retrospectives to identify what\'s working and what needs improvement. Remote teams benefit from structured feedback loops.',
    category: 'Leadership',
    author: 'Dana Singh',
    date: 'May 11, 2026',
    readTime: 7,
    img: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&dpr=2',
  },
  {
    id: 9,
    title: 'AI-Powered Recruitment: A Guide',
    excerpt: 'Understanding the landscape of AI-powered recruitment tools and how they integrate into your hiring process. Best practices for implementation and optimization.',
    content: 'AI-powered recruitment tools are transforming how organizations find, screen, and hire talent. This guide provides a comprehensive overview of the AI recruitment landscape.\n\nScreening and Matching: AI-powered screening tools analyze resumes against job descriptions to identify the best candidates. These tools use natural language processing to understand context and nuance, going beyond simple keyword matching.\n\nChatbots and Candidate Engagement: AI chatbots handle initial candidate inquiries, schedule interviews, and provide updates throughout the hiring process. They offer 24/7 availability and consistent communication.\n\nVideo Interview Analysis: Advanced AI tools analyze video interviews for tone, engagement, and communication patterns, providing insights that complement human judgment.\n\nPredictive Analytics: AI can predict candidate success and retention probability by analyzing patterns across your hiring data. These insights help you make more informed hiring decisions.\n\nBias Mitigation: When properly designed, AI tools can reduce unconscious bias in hiring by focusing on objective qualifications and removing identifying information from initial screenings.\n\nImplementation Best Practices: Start with a pilot program, train your team on AI tool interpretation, maintain human oversight, and regularly audit your AI tools for fairness and accuracy.\n\nThe Future: AI recruitment is evolving rapidly. Emerging trends include skills-based assessments, virtual reality job previews, and AI-driven career pathing for internal mobility.',
    category: 'AI & Tech',
    author: 'Chris Wang',
    date: 'May 8, 2026',
    readTime: 10,
    img: 'https://images.pexels.com/photos/5668855/pexels-photo-5668855.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&dpr=2',
  },
  {
    id: 10,
    title: 'The 4-Day Workweek: Pros and Cons',
    excerpt: 'The 4-day workweek is gaining traction globally. We examine the benefits for productivity and employee satisfaction, along with implementation challenges.',
    content: 'The 4-day workweek has moved from a progressive experiment to a mainstream workplace trend. Here\'s a balanced look at the benefits and challenges.\n\nIncreased Productivity: Studies from companies that have adopted 4-day weeks show productivity improvements of 20-40%. Employees are more focused knowing they have less time to complete their work.\n\nImproved Work-Life Balance: Employees report higher satisfaction, reduced stress, and more time for family, hobbies, and rest. This leads to lower burnout and turnover rates.\n\nEnvironmental Benefits: Fewer commute days means reduced carbon emissions. Some companies report 15-20% reduction in their carbon footprint after switching.\n\nTalent Attraction: A 4-day workweek is a powerful recruiting tool. Companies offering this benefit see significantly more applicants and higher acceptance rates.\n\nChallenges: Not all roles can accommodate compressed schedules. Customer-facing positions, emergency services, and roles requiring daily coverage need careful staffing solutions.\n\nImplementation Approaches: Common models include four 10-hour days, reduced hours with same pay, and rotating schedules where different teams take different days off.\n\nClient and Customer Impact: Some clients expect 5-day availability. Companies need clear communication about response times and coverage during off days.\n\nThe Verdict: For many organizations, the 4-day workweek delivers meaningful benefits. Success depends on thoughtful implementation, clear policies, and a willingness to iterate.',
    category: 'Remote Work',
    author: 'Morgan Davis',
    date: 'May 5, 2026',
    readTime: 6,
    img: 'https://images.pexels.com/photos/927022/pexels-photo-927022.jpeg?auto=compress&cs=tinysrgb&w=400&h=250&dpr=2',
  },
];

const categoryColors: Record<string, string> = {
  'Career Advice': 'bg-blue-100 text-blue-700',
  'AI & Tech': 'bg-green-100 text-green-700',
  'Hiring': 'bg-orange-100 text-orange-700',
  'Remote Work': 'bg-cyan-100 text-cyan-700',
  'Salary & Benefits': 'bg-amber-100 text-amber-700',
  'Leadership': 'bg-rose-100 text-rose-700',
};

const BlogDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const post = blogPosts.find(p => p.id === Number(id));

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Article not found</h1>
          <button onClick={() => navigate('/blog')} className="text-blue-700 hover:underline">
            Back to Blog
          </button>
        </main>
        <BottomNav />
      </div>
    );
  }

  const paragraphs = post.content.split('\n\n');
  const catColor = categoryColors[post.category] || 'bg-blue-100 text-blue-700';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main>
        {/* Hero Image */}
        {post.img && (
          <div className="w-full h-64 sm:h-80 md:h-96 overflow-hidden">
            <img src={post.img} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back button */}
          <button
            onClick={() => navigate('/blog')}
            className="flex items-center text-gray-600 hover:text-blue-700 mb-6 transition-colors"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Blog
          </button>

          {/* Category badge */}
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${catColor}`}>
            {post.category}
          </span>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Author meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-8 pb-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <User size={16} />
              <span className="font-semibold text-gray-700">{post.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>{post.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>{post.readTime} min read</span>
            </div>
          </div>

          {/* Article content */}
          <div className="prose prose-gray max-w-none">
            {paragraphs.map((para, i) => (
              <p key={i} className="text-gray-700 leading-relaxed mb-5 text-base sm:text-lg">
                {para}
              </p>
            ))}
          </div>

          {/* Share / navigate */}
          <div className="mt-10 pt-6 border-t border-gray-200 flex justify-between items-center">
            <button
              onClick={() => navigate('/blog')}
              className="text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={18} />
              Back to all articles
            </button>
          </div>
        </article>
      </main>
      <BottomNav />
    </div>
  );
};

export default BlogDetail;
