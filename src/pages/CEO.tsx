import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Linkedin, Twitter } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

interface Milestone {
  year: number;
  title: string;
  description: string;
}

const CEO: React.FC = () => {
  const milestones: Milestone[] = [
    {
      year: 2021,
      title: 'Founded',
      description: 'Founded JobBridge with a simple idea: solve the disconnect between talent and opportunity.'
    },
    {
      year: 2022,
      title: 'Market Research',
      description: 'Conducted market research and identified key challenges faced by job seekers and employers.'
    },
    {
      year: 2023,
      title: 'Vision & Roadmap',
      description: 'Developed the JobBridge vision, business model, and long-term roadmap.'
    },
    {
      year: 2024,
      title: 'Platform Design',
      description: 'Designed the platform concept and defined core features and services.'
    },
    {
      year: 2025,
      title: 'Development',
      description: 'Began platform development and built the foundation for launch.'
    },
    {
      year: 2026,
      title: 'AI Launch',
      description: 'Introduced AI-powered solutions and officially launched JobBridge to the public.'
    }
  ];

  const ImageOrPlaceholder: React.FC = () => (
    <img
      src="/MrVictor1.jpeg.png"
      alt="Mr. Victor Eniola, CEO of JobBridge"
      className="w-full h-full object-cover"
    />
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <main className="flex-1 pb-20 md:pb-0">
        {/* Hero Section */}
        <section className="relative py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Photo: try loading public/MrVictor.jpeg, fallback to placeholder */}
            <div className="h-96 rounded-lg shadow-lg overflow-hidden bg-gray-100">
              <ImageOrPlaceholder />
            </div>

            {/* Content */}
            <div>
              <p className="text-blue-700 font-semibold mb-4 uppercase tracking-wider">
                Welcome from our CEO
              </p>
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
                We're building the infrastructure for the future of work
              </h1>
              <p className="text-lg text-gray-600">
                JobBridge is more than a platform—it's a movement to reimagine how talent and opportunity connect in a rapidly changing world.
              </p>
            </div>
          </div>
        </section>

        {/* CEO Profile Card */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-8 border border-blue-200">
            <div className="flex flex-col sm:flex-row gap-8 items-start">
              <img
                src="/MrVictor1.jpeg.png"
                alt="Mr. Victor Eniola"
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md flex-shrink-0"
              />
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Mr. Victor Eniola</h2>
                <p className="text-lg text-blue-700 font-semibold mb-4">CEO & Founder</p>
                <p className="text-gray-700 mb-6">
                  Mr. Victor Eniola is the CEO and founder of JobBridge. With extensive experience in HR technology and marketplace growth, Victor started JobBridge to make career opportunities more accessible and transparent. He leads the company's vision to connect talent and employers through better matching, fairness, and technology-driven insights.
                </p>
                <div className="flex gap-4">
                  <a
                    href="https://www.linkedin.com/in/victor-eniola-b77407259?utm_source=share_via&utm_content=profile&utm_medium=member_ios"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-2"
                  >
                    <Linkedin size={20} />
                    LinkedIn
                  </a>
                  <a
                    href="https://x.com/phenol_jnr?s=11"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:text-blue-800 font-semibold flex items-center gap-2"
                  >
                    <Twitter size={20} />
                    Twitter
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Vision Pillars */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-12 text-center">Our Vision Pillars</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-blue-50 rounded-lg p-8 border border-blue-200 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold text-blue-900 mb-3">Democratizing Opportunity</h3>
              <p className="text-gray-700">
                Every person deserves access to meaningful career opportunities. We're removing barriers and creating pathways for talent from all backgrounds.
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-8 border border-blue-200 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold text-blue-900 mb-3">AI-First Approach</h3>
              <p className="text-gray-700">
                Artificial intelligence should augment human decision-making, not replace it. We're building AI tools that enhance recruiting and career discovery for everyone.
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-8 border border-blue-200 hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-bold text-blue-900 mb-3">Global Impact</h3>
              <p className="text-gray-700">
                Economic opportunity knows no borders. JobBridge is expanding globally to connect talent and employers across the world.
              </p>
            </div>
          </div>
        </section>

        {/* Letter from CEO */}
        <section className="bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Letter from Victor</h2>
            <div className="prose prose-lg max-w-none text-gray-700 space-y-6">
              <p>
                When I founded JobBridge, it started with a simple belief: talent is everywhere, but opportunity is not.
              </p>
              <p>
                Across communities, I saw skilled people—graduates, artisans, creatives, technicians, and professionals—struggling to find meaningful opportunities, not because they lacked ability, but because they lacked access. At the same time, businesses and employers were searching for talent, yet many qualified individuals remained invisible.
              </p>
              <p>
                The problem was never a shortage of talent. The problem was the gap between talent and opportunity.
              </p>
              <p>
                JobBridge was created to close that gap.
              </p>
              <p>
                We believe that a person's future should not be determined by who they know, where they live, or whether they have access to the right network. Everyone deserves a fair chance to showcase their skills, discover opportunities, and build a better life.
              </p>
              <p>
                Our mission is to create a platform where employers can find the right people, job seekers can access the right opportunities, and professionals can continuously develop themselves through learning and training.
              </p>
              <p>
                Technology is helping us make this vision possible. By leveraging intelligent tools and data-driven solutions, we can connect people with opportunities faster, reduce barriers to entry, and create a more transparent and inclusive job market.
              </p>
              <p>
                At JobBridge, we're not just building a job platform. We're building a bridge between potential and possibility, between ambition and achievement, and between communities and economic growth.
              </p>
              <p>
                Because when talent meets opportunity, lives change. And when lives change, communities grow.
              </p>
            </div>
          </div>
        </section>

        {/* Company Milestones */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">Company Milestones</h2>
          <div className="relative">
            {/* Timeline Line */}
            <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-blue-200"></div>

            {/* Milestones */}
            <div className="space-y-12">
              {milestones.map((milestone, idx) => (
                <div
                  key={milestone.year}
                  className={`relative flex ${idx % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
                >
                  {/* Content */}
                  <div className={`w-full md:w-1/2 ${idx % 2 === 0 ? 'md:pr-12' : 'md:pl-12'}`}>
                    <div className="bg-white rounded-lg border border-blue-200 p-6 hover:shadow-lg transition-shadow">
                      <div className="text-3xl font-bold text-blue-700 mb-2">{milestone.year}</div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{milestone.title}</h3>
                      <p className="text-gray-600">{milestone.description}</p>
                    </div>
                  </div>

                  {/* Timeline Dot */}
                  <div className="hidden md:flex w-0 md:w-12 justify-center">
                    <div className="w-6 h-6 bg-blue-700 rounded-full border-4 border-white absolute top-6 left-1/2 transform -translate-x-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Join Our Mission CTA */}
        <section className="bg-blue-700 py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Join Our Mission
            </h2>
            <p className="text-blue-100 text-lg mb-8">
              We're building something meaningful. If you're passionate about the future of work, we want to hear from you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/jobs"
                className="bg-white hover:bg-gray-100 text-blue-700 px-8 py-3 rounded-lg font-semibold transition-colors inline-flex items-center justify-center gap-2"
              >
                Explore Open Roles
                <ArrowRight size={20} />
              </Link>
              <Link
                to="/about"
                className="border-2 border-white hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors inline-flex items-center justify-center gap-2"
              >
                Learn More About Us
                <ArrowRight size={20} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default CEO;
