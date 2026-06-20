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
      description: 'JobBridge launched with a mission to democratize career opportunities'
    },
    {
      year: 2022,
      title: 'Series A Funding',
      description: 'Raised $8M to expand platform and build AI-powered matching'
    },
    {
      year: 2023,
      title: '1M Users',
      description: 'Reached 1 million active users across 25 countries'
    },
    {
      year: 2024,
      title: 'Series B Funding',
      description: 'Secured $25M for international expansion and product development'
    },
    {
      year: 2025,
      title: 'Global Reach',
      description: 'Expanded to 50+ countries with localized experiences'
    },
    {
      year: 2026,
      title: 'AI Revolution',
      description: 'Launched GenAI-powered recruitment intelligence platform'
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
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Letter from Mr. Victor Eniola</h2>
            <div className="prose prose-lg max-w-none text-gray-700 space-y-6">
              <p>
                When I founded JobBridge in 2021, I was driven by a simple observation: the job market was broken. Talented individuals couldn't find opportunities aligned with their values, and companies struggled to discover the best talent beyond their existing networks. The disconnect was both a tragedy and an opportunity.
              </p>
              <p>
                Over the past five years, we've grown from a small team of believers to a global platform serving millions of users across 50+ countries. We've processed millions of job placements and helped countless individuals navigate crucial career transitions. But more importantly, we've learned something profound: when talent and opportunity connect transparently, magic happens.
              </p>
              <p>
                Our commitment to AI-first technology doesn't diminish the human element of career development—it amplifies it. We're using artificial intelligence to remove bias, expand possibilities, and surface matches that might otherwise be missed. At the same time, we're ensuring that people remain at the center of every decision.
              </p>
              <p>
                As we look ahead to 2027 and beyond, our mission remains unchanged: to build the infrastructure for a more connected, equitable future of work. We're just getting started, and we're grateful for every user, employer, and partner who is part of this journey.
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
