import { Link } from 'react-router-dom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { Eye, Zap, Users, ArrowRight } from 'lucide-react';
import AnimatedSection from '../components/AnimatedSection';

export default function About() {

  const milestones = [
    { year: 2021, event: 'Founded' },
    { year: 2022, event: 'Series A' },
    { year: 2023, event: '100k Users' },
    { year: 2024, event: 'AI Launch' },
    { year: 2025, event: '2M Users' },
    { year: 2026, event: 'Global Expansion' },
  ];

  const stats = [
    { label: 'Founded', value: '2021' },
    { label: 'Users', value: '2M+' },
    { label: 'Countries', value: '50+' },
    { label: 'Funding', value: '₦12M' },
  ];

  const pillars = [
    {
      icon: <Eye className="w-6 h-6" />,
      title: 'Transparency',
      description: 'Complete visibility into job market data and career opportunities',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Innovation',
      description: 'Cutting-edge AI and technology to revolutionize job searching',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Inclusion',
      description: 'Creating opportunities for talent from diverse backgrounds',
    },
  ];

  const teamMembers = [
    {
      name: 'Owoyemi Samuel Tobi',
      role: 'Chief Technology Officer',
      badge: 'Leadership',
      description: 'Owoyemi leads JobBridge’s technology vision, product engineering, and platform innovation with a focus on scalable systems, reliability, and meaningful user impact.',
      image: `${import.meta.env.BASE_URL}images/owoyemi-samuel-tobi.jpeg`,
    },
  ];

  const services = [
    {
      title: 'Professional Services Marketplace',
      description:
        'Connect with vetted professionals across development, design, marketing, finance, and legal services.',
    },
    {
      title: 'Business Advertising',
      description:
        'Promote your business with featured adverts, priority placement, and category targeting on JobBridge.',
    },
    {
      title: 'AI-Powered Career Tools',
      description:
        'Use resume tools, interview preparation, and intelligent job matching to move your career forward.',
    },
    {
      title: 'Recruitment & Talent Solutions',
      description:
        'Hire top talent, post jobs, and manage recruiting directly through our unified platform.',
    },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <AnimatedSection direction="up">
        <section className="px-4 lg:px-8 py-12 lg:py-20 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                <span className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  Building bridges
                </span>
                <br />
                between talent and opportunity
              </h1>
              <p className="text-gray-600 text-lg leading-relaxed">
                JobBridge is revolutionizing how talent discovers opportunities and how companies find
                their next great team members. We leverage AI, data, and human insights to create
                meaningful connections in the job market.
              </p>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <img
                  src="https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=600&h=450&dpr=2"
                  alt="Team collaboration"
                  className="rounded-2xl shadow-xl"
                />
                <div className="absolute -bottom-4 -left-4 bg-blue-700 text-white rounded-xl p-4 shadow-lg">
                  <p className="text-2xl font-bold">2M+</p>
                  <p className="text-sm text-blue-200">Users worldwide</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        </AnimatedSection>

        {/* Mission Section - Pillars */}
        <AnimatedSection direction="up">
        <section className="px-4 lg:px-8 py-12 lg:py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-12 text-center">
              Our Mission
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {pillars.map((pillar, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-lg p-8 border border-gray-200 hover:shadow-md transition"
                >
                  <div className="text-blue-700 mb-4">{pillar.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{pillar.title}</h3>
                  <p className="text-gray-600">{pillar.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        </AnimatedSection>

        {/* Stats Section */}
        <AnimatedSection direction="up">
        <section className="px-4 lg:px-8 py-12 lg:py-20">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-12 text-center">
              By The Numbers
            </h2>
            <div className="grid md:grid-cols-4 gap-8">
              {stats.map((stat, idx) => (
                <div key={idx} className="text-center">
                  <p className="text-4xl lg:text-5xl font-bold text-blue-700 mb-2">{stat.value}</p>
                  <p className="text-gray-600">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        </AnimatedSection>

        {/* Our Services Section */}
        <AnimatedSection direction="up">
        <section className="px-4 lg:px-8 py-12 lg:py-20 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-10 text-center">
              About Our Services
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {services.map((service, idx) => (
                <div key={idx} className="rounded-3xl border border-gray-200 p-8 shadow-sm hover:shadow-lg transition">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{service.title}</h3>
                  <p className="text-gray-600">{service.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        </AnimatedSection>

        {/* Team Section */}
        <AnimatedSection direction="up">
        <section className="px-4 lg:px-8 py-12 lg:py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-10 text-center">
              Meet Our Team
            </h2>
            <div className="flex justify-center">
              {teamMembers.map((member, idx) => (
                <div key={idx} className="w-full max-w-xl bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-lg transition">
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-blue-100 shadow-md">
                      <img
                        src={member.image}
                        alt={member.name}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}images/team-profile.jpeg`; }}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-semibold uppercase text-blue-700 tracking-[0.24em]">{member.badge}</p>
                      <h3 className="text-2xl font-bold text-gray-900">{member.name}</h3>
                      <p className="text-blue-700 font-semibold">{member.role}</p>
                      <p className="text-gray-600">{member.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        </AnimatedSection>

        {/* Timeline Section */}
        <AnimatedSection direction="up">
        <section className="px-4 lg:px-8 py-12 lg:py-20 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-12 text-center">
              Our Journey
            </h2>
            <div className="space-y-4 relative">
              {/* Vertical Line */}
              <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-blue-200"></div>

              {milestones.map((milestone, idx) => (
                <div
                  key={idx}
                  className={`flex ${idx % 2 === 0 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-8 items-center`}
                >
                  <div className="flex-1 md:text-right">
                    <p className="text-gray-600">{milestone.event}</p>
                  </div>
                  <div className="relative flex-shrink-0">
                    <div className="w-4 h-4 bg-blue-700 rounded-full border-4 border-white absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-2xl font-bold text-blue-700">{milestone.year}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        </AnimatedSection>

        {/* CTA Section */}
        <AnimatedSection direction="up">
        <section className="px-4 lg:px-8 py-12 lg:py-20 bg-blue-700">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Join Our Team</h2>
            <p className="text-blue-100 mb-8">
              We're building the future of job searching. Help us bridge the gap between talent and
              opportunity.
            </p>
            <Link
              to="/jobs"
              className="inline-flex items-center gap-2 px-8 py-3 bg-white text-blue-700 font-semibold rounded-lg hover:bg-blue-50 transition"
            >
              View Open Positions
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
        </AnimatedSection>
      </main>
      <BottomNav />
    </div>
  );
}
