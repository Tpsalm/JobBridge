import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronDown, MapPin, Briefcase, MessageSquare } from 'lucide-react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import PageHero from '../components/PageHero';
import { HERO_CAROUSELS, avatarForIndex } from '../lib/media';

interface Candidate {
  id: number;
  name: string;
  role: string;
  company: string;
  location: string;
  experienceLevel: 'Entry' | 'Mid' | 'Senior' | 'Executive';
  matchScore: number;
  skills: string[];
  availability: 'Immediate' | '2 weeks' | '1 month';
  salary: number;
  immediate?: boolean;
  img?: string;
}

const TalentSearch: React.FC = () => {
  const { openModal } = useModal();
  const [searchName, setSearchName] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('All');
  const [availability, setAvailability] = useState('All');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortBy, setSortBy] = useState('Best Match');
  const [searchSkills, setSearchSkills] = useState('');
  const [minSalary, setMinSalary] = useState('');
  const [preferredCompanies, setPreferredCompanies] = useState('');

  const candidates: Candidate[] = [
    {
      id: 1,
      name: 'Alex Rivera',
      role: 'Senior React Engineer',
      company: 'Stripe',
      location: 'San Francisco, CA',
      experienceLevel: 'Senior',
      matchScore: 97,
      skills: ['React', 'TypeScript', 'GraphQL', 'AWS'],
      availability: 'Immediate',
      salary: 145000,
      immediate: true,
      img: avatarForIndex(0),
    },
    {
      id: 2,
      name: 'Mia Chen',
      role: 'Product Designer',
      company: 'Figma',
      location: 'Remote',
      experienceLevel: 'Mid',
      matchScore: 94,
      skills: ['Figma', 'Sketch', 'UX Research'],
      availability: '2 weeks',
      salary: 115000,
      img: avatarForIndex(1),
    },
    {
      id: 3,
      name: 'Jordan Park',
      role: 'Full Stack Dev',
      company: 'Netflix',
      location: 'Los Angeles, CA',
      experienceLevel: 'Senior',
      matchScore: 91,
      skills: ['Node.js', 'React', 'PostgreSQL'],
      availability: 'Immediate',
      salary: 135000,
      immediate: true,
      img: avatarForIndex(2),
    },
    {
      id: 4,
      name: 'Sam Taylor',
      role: 'Data Scientist',
      company: 'Google',
      location: 'New York, NY',
      experienceLevel: 'Senior',
      matchScore: 89,
      skills: ['Python', 'ML', 'TensorFlow'],
      availability: '1 month',
      salary: 155000,
      img: avatarForIndex(3),
    },
    {
      id: 5,
      name: 'Casey Morgan',
      role: 'DevOps Engineer',
      company: 'AWS',
      location: 'Remote',
      experienceLevel: 'Senior',
      matchScore: 87,
      skills: ['Kubernetes', 'Docker', 'Terraform'],
      availability: '2 weeks',
      salary: 140000,
      img: avatarForIndex(4),
    },
    {
      id: 6,
      name: 'Riley Kim',
      role: 'iOS Developer',
      company: 'Apple',
      location: 'Cupertino, CA',
      experienceLevel: 'Mid',
      matchScore: 85,
      skills: ['Swift', 'iOS', 'SwiftUI'],
      availability: 'Immediate',
      salary: 125000,
      immediate: true,
      img: avatarForIndex(5),
    },
    {
      id: 7,
      name: 'Drew Williams',
      role: 'Backend Engineer',
      company: 'Spotify',
      location: 'New York, NY',
      experienceLevel: 'Mid',
      matchScore: 83,
      skills: ['Go', 'Node.js', 'Redis'],
      availability: '2 weeks',
      salary: 130000,
      img: avatarForIndex(6),
    },
    {
      id: 8,
      name: 'Quinn Davis',
      role: 'UX Researcher',
      company: 'Microsoft',
      location: 'Seattle, WA',
      experienceLevel: 'Mid',
      matchScore: 80,
      skills: ['Research', 'Figma', 'Analytics'],
      availability: '1 month',
      salary: 110000,
      img: avatarForIndex(7),
    }
  ];

  const getExperienceBadgeColor = (level: string): string => {
    switch (level) {
      case 'Entry':
        return 'bg-blue-100 text-blue-700';
      case 'Mid':
        return 'bg-cyan-100 text-cyan-700';
      case 'Senior':
        return 'bg-orange-100 text-orange-700';
      case 'Executive':
        return 'bg-blue-700 text-white';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getInitials = (name: string): string => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAvatarColor = (id: number): string => {
    const colors = ['bg-blue-700', 'bg-cyan-600', 'bg-green-600', 'bg-orange-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600', 'bg-indigo-600'];
    return colors[id % colors.length];
  };

  const getMatchBadgeColor = (score: number): string => {
    if (score >= 85) return 'bg-emerald-100 text-emerald-700';
    return 'text-gray-600';
  };

  const [searchTriggered, setSearchTriggered] = useState(0);

  const handleSearch = () => setSearchTriggered(t => t + 1);

  const filteredCandidates = candidates.filter(candidate => {
    if (searchName && !candidate.name.toLowerCase().includes(searchName.toLowerCase())) return false;
    if (searchLocation && !candidate.location.toLowerCase().includes(searchLocation.toLowerCase())) return false;
    if (experienceLevel !== 'All' && candidate.experienceLevel !== experienceLevel) return false;
    if (availability !== 'All' && candidate.availability !== availability) return false;
    if (searchSkills) {
      const skills = searchSkills.split(',').map(s => s.trim().toLowerCase());
      if (!skills.every(s => candidate.skills.some(cs => cs.toLowerCase().includes(s)))) return false;
    }
    if (minSalary && candidate.salary < parseInt(minSalary)) return false;
    if (preferredCompanies && !preferredCompanies.split(',').some(c => candidate.company.toLowerCase().includes(c.trim().toLowerCase()))) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'Salary') return b.salary - a.salary;
    if (sortBy === 'Experience') return b.matchScore - a.matchScore;
    return b.matchScore - a.matchScore;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 pb-20 md:pb-0">
        <PageHero
          title="Talent Search"
          subtitle="Discover top professionals matched to your hiring needs"
          images={HERO_CAROUSELS.talent}
          imageAlt="Team of professionals collaborating"
          compact
        />

        {/* Search & Filters */}
        <section className="bg-white border-b border-gray-200 sticky top-16 md:top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Primary Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name / Title
                </label>
                <input
                  type="text"
                  placeholder="Search candidates"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  placeholder="City or Remote"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Experience Level
                </label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  <option>All</option>
                  <option>Entry</option>
                  <option>Mid</option>
                  <option>Senior</option>
                  <option>Executive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Availability
                </label>
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  <option>All</option>
                  <option>Immediate</option>
                  <option>2 weeks</option>
                  <option>1 month</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <button onClick={handleSearch} className="w-full sm:w-auto bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                <Search size={18} />
                Search
              </button>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full sm:w-auto text-blue-700 hover:text-blue-800 font-semibold flex items-center justify-center gap-2"
              >
                <ChevronDown size={18} className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                Advanced Filters
              </button>
            </div>

            {/* Advanced Filters */}
            {showAdvanced && (
              <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Skills (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="React, TypeScript, AWS"
                    value={searchSkills}
                    onChange={e => setSearchSkills(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Salary (₦)
                  </label>
                  <input
                    type="number"
                    placeholder="100000"
                    value={minSalary}
                    onChange={e => setMinSalary(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Companies
                  </label>
                  <input
                    type="text"
                    placeholder="Stripe, Google"
                    value={preferredCompanies}
                    onChange={e => setPreferredCompanies(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content */}
            <div className="flex-1">
              {/* Results Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 sm:mb-0">
                  {filteredCandidates.length} candidates found
                </h2>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Sort by:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
                  >
                    <option>Best Match</option>
                    <option>Recent</option>
                    <option>Experience</option>
                    <option>Salary</option>
                  </select>
                </div>
              </div>

              {/* Candidates Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredCandidates.map(candidate => (
                  <div
                    key={candidate.id}
                    className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        {candidate.img ? (
                          <img src={candidate.img} alt={candidate.name} className="w-12 h-12 rounded-full object-cover border-2 border-blue-100 shrink-0" />
                        ) : (
                          <div className={`${getAvatarColor(candidate.id)} text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm`}>
                            {getInitials(candidate.name)}
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900">{candidate.name}</h3>
                          <p className="text-sm text-gray-600">{candidate.role}</p>
                          <p className="text-xs text-gray-500">{candidate.company}</p>
                        </div>
                      </div>
                      {candidate.matchScore >= 85 && (
                        <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded">
                          {candidate.matchScore}%
                        </span>
                      )}
                    </div>

                    {/* Info Row */}
                    <div className="space-y-2 mb-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-blue-700" />
                        <span>{candidate.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Briefcase size={16} className="text-blue-700" />
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getExperienceBadgeColor(candidate.experienceLevel)}`}>
                          {candidate.experienceLevel}
                        </span>
                        {candidate.immediate && (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <span className="inline-block w-2 h-2 bg-green-600 rounded-full"></span>
                            Immediate
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-700 font-bold text-sm">₦</span>
                        <span>{(candidate.salary / 1000).toFixed(0)}k</span>
                      </div>
                    </div>

                    {/* Skills */}
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2">
                        {candidate.skills.slice(0, 4).map((skill, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      <button
                        onClick={() => openModal('profile', {
                          name: candidate.name,
                          role: candidate.role,
                          match: `${candidate.matchScore}%`
                        })}
                        className="w-full bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
                      >
                        View Profile
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => openModal('connect', { name: candidate.name })}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors text-sm"
                        >
                          Connect
                        </button>
                        <button
                          onClick={() => openModal('message', { name: candidate.name })}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors text-sm flex items-center justify-center gap-1"
                        >
                          <MessageSquare size={16} />
                          Message
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Saved Candidates Sidebar */}
            <div className="hidden lg:block w-72">
              <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-32">
                <h3 className="font-bold text-gray-900 mb-4">Saved (3)</h3>
                <div className="space-y-3 mb-4">
                  {candidates.slice(0, 3).map(candidate => (
                    <div key={candidate.id} className="flex items-center gap-3 pb-3 border-b border-gray-200">
                      <div className={`${getAvatarColor(candidate.id)} text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0`}>
                        {getInitials(candidate.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{candidate.name}</p>
                        <p className="text-xs text-gray-500 truncate">{candidate.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="w-full text-blue-700 hover:text-blue-800 font-semibold text-sm">
                  View All
                </button>
              </div>

              {/* Post Job CTA */}
              <button
                onClick={() => openModal('post-job')}
                className="w-full mt-4 bg-blue-700 hover:bg-blue-800 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
              >
                Post a Job
              </button>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default TalentSearch;
