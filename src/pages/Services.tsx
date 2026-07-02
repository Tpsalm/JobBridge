import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, MessageSquare, Zap, CheckCircle, Users } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import PageHero from '../components/PageHero';
import { HERO_CAROUSELS } from '../lib/media';

const Services = () => {
  const { openModal } = useModal();
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', 'Development', 'Design', 'Marketing', 'Writing', 'Finance', 'Legal', 'Consulting', 'Other'];

  const providers = [
    {
      id: 1,
      name: 'Alex Rivera',
      title: 'Full-Stack Developer',
      rating: 5.0,
      reviews: 128,
      rate: 95,
      skills: ['React', 'Node.js', 'PostgreSQL'],
      img: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
      bgColor: 'bg-blue-600',
    },
    {
      id: 2,
      name: 'Mia Chen',
      title: 'Brand Designer',
      rating: 4.9,
      reviews: 95,
      rate: 80,
      skills: ['Figma', 'Illustrator', 'Branding'],
      img: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
      bgColor: 'bg-blue-500',
    },
    {
      id: 3,
      name: 'Sam Taylor',
      title: 'SEO Specialist',
      rating: 4.8,
      reviews: 72,
      rate: 65,
      skills: ['SEO', 'Analytics', 'Content'],
      img: 'https://images.pexels.com/photos/1121796/pexels-photo-1121796.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
      bgColor: 'bg-blue-600',
    },
    {
      id: 4,
      name: 'Jordan Lee',
      title: 'React Developer',
      rating: 4.9,
      reviews: 110,
      rate: 90,
      skills: ['React', 'TypeScript', 'Next.js'],
      img: 'https://images.pexels.com/photos/1933873/pexels-photo-1933873.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
      bgColor: 'bg-blue-700',
    },
    {
      id: 5,
      name: 'Chris Morgan',
      title: 'Content Writer',
      rating: 4.7,
      reviews: 88,
      rate: 55,
      skills: ['Copywriting', 'SEO', 'Strategy'],
      img: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
      bgColor: 'bg-blue-500',
    },
    {
      id: 6,
      name: 'Pat Williams',
      title: 'Financial Advisor',
      rating: 5.0,
      reviews: 65,
      rate: 120,
      skills: ['Finance', 'Tax', 'Planning'],
      img: 'https://images.pexels.com/photos/1845534/pexels-photo-1845534.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
      bgColor: 'bg-blue-600',
    },
    {
      id: 7,
      name: 'Riley Smith',
      title: 'Legal Consultant',
      rating: 4.8,
      reviews: 54,
      rate: 150,
      skills: ['Contracts', 'IP', 'Compliance'],
      img: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
      bgColor: 'bg-blue-700',
    },
    {
      id: 8,
      name: 'Dana Brown',
      title: 'Marketing Lead',
      rating: 4.9,
      reviews: 92,
      rate: 85,
      skills: ['Campaigns', 'Social', 'Analytics'],
      img: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2&fit=crop&crop=face',
      bgColor: 'bg-blue-600',
    },
  ];

  const categoryMap: Record<string, string[]> = {
    'Development': ['Full-Stack Developer', 'React Developer', 'Backend Engineer'],
    'Design': ['Brand Designer', 'UX Researcher'],
    'Marketing': ['SEO Specialist', 'Marketing Lead', 'Content Writer'],
    'Writing': ['Content Writer'],
    'Finance': ['Financial Advisor'],
    'Legal': ['Legal Consultant'],
    'Consulting': ['Financial Advisor', 'Legal Consultant'],
  };
  const allMapped = Object.values(categoryMap).flat();
  const filteredProviders = activeCategory === 'All' ? providers : providers.filter(p => {
    if (activeCategory === 'Other') return !allMapped.includes(p.title);
    const matching = categoryMap[activeCategory] || [];
    return matching.includes(p.title);
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />

      <main className="flex-1 pb-20 md:pb-0">
        <PageHero
          title="Service Request Hub"
          subtitle="Connect with top professionals for your business needs"
          images={HERO_CAROUSELS.providers}
          imageAlt="Professionals offering services"
          compact
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row md:items-center md:justify-end gap-4">
          <button
            onClick={() => openModal('service-request')}
            className="bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 px-8 rounded-lg transition duration-200 inline-flex items-center justify-center"
          >
            <Zap className="w-5 h-5 mr-2" />
            Post a Request
          </button>
        </div>

        {/* Category Filters */}
        <section className="bg-white sticky top-[60px] z-10 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex overflow-x-auto gap-3 py-4 scrollbar-hide">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-5 py-2 rounded-full font-medium whitespace-nowrap transition duration-200 ${
                    activeCategory === category
                      ? 'bg-blue-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Service Provider Cards */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProviders.map((provider) => (
              <div key={provider.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition duration-200 overflow-hidden border border-gray-200">
                <div className="p-6">
                  {/* Avatar */}
                  <div className="flex items-start justify-between mb-4">
                    <img src={provider.img} alt={provider.name} className="w-14 h-14 rounded-full object-cover border-2 border-blue-100" />
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold text-gray-900">{provider.rating}</span>
                      <span className="text-gray-500 text-sm">({provider.reviews})</span>
                    </div>
                  </div>

                  {/* Name and Title */}
                  <h3 className="text-lg font-bold text-gray-900">{provider.name}</h3>
                  <p className="text-gray-600 text-sm mb-3">{provider.title}</p>

                  {/* Rate */}
                  <div className="mb-4">
                    <p className="text-2xl font-bold text-gray-900">
                      ${provider.rate}
                      <span className="text-sm text-gray-500 font-normal">/hr</span>
                    </p>
                  </div>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {provider.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => openModal('hire', { name: provider.name, role: provider.title })}
                      className="flex-1 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                    >
                      Hire
                    </button>
                    <button
                      onClick={() => openModal('message', { name: provider.name })}
                      className="flex-1 border-2 border-blue-700 text-blue-700 hover:bg-blue-50 font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it Works Section */}
        <section className="bg-blue-50 border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: '1',
                  title: 'Post Request',
                  description: 'Tell us what you need. Our experts will match with your requirements.',
                  icon: <Zap className="w-8 h-8" />,
                },
                {
                  step: '2',
                  title: 'Get Matched',
                  description: 'Review profiles and proposals from top professionals.',
                  icon: <Users className="w-8 h-8" />,
                },
                {
                  step: '3',
                  title: 'Start Working',
                  description: 'Collaborate with your chosen professional and get results.',
                  icon: <CheckCircle className="w-8 h-8" />,
                },
              ].map((item, idx) => (
                <div key={idx} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-700 text-white rounded-full mb-4">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Services;
