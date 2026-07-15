import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { TrendingUp, Users, Briefcase, Award } from 'lucide-react';
import PageHero from '../components/PageHero';
import VideoPlayer from '../components/VideoPlayer';
import { HERO_CAROUSELS, VIDEO } from '../lib/media';
import { getHeroAbMetrics, resetHeroAbMetrics } from '../lib/abMetrics';

type DateRange = 'week' | 'month' | 'quarter' | 'year';

export default function Analytics() {
  const [dateRange, setDateRange] = useState<DateRange>('week');
  const [abMetrics, setAbMetrics] = useState(() => getHeroAbMetrics());

  useEffect(() => {
    setAbMetrics(getHeroAbMetrics());
  }, []);

  const refreshMetrics = () => setAbMetrics(getHeroAbMetrics());

  const kpis = [
    {
      title: 'Total Applications',
      value: '1,247',
      change: '+12%',
      icon: Briefcase,
    },
    {
      title: 'Profile Views',
      value: '8,431',
      change: '+24%',
      icon: Users,
    },
    {
      title: 'Interview Rate',
      value: '23%',
      change: '+3%',
      icon: TrendingUp,
    },
    {
      title: 'Offer Rate',
      value: '8%',
      change: '+1%',
      icon: Award,
    },
  ];

  const applicationData = [
    { day: 'Mon', count: 145, width: '65%' },
    { day: 'Tue', count: 198, width: '85%' },
    { day: 'Wed', count: 176, width: '78%' },
    { day: 'Thu', count: 212, width: '92%' },
    { day: 'Fri', count: 225, width: '100%' },
    { day: 'Sat', count: 87, width: '40%' },
    { day: 'Sun', count: 63, width: '28%' },
  ];

  const trendingJobs = [
    { title: 'React Developer', percentage: 89 },
    { title: 'Data Scientist', percentage: 76 },
    { title: 'Product Manager', percentage: 71 },
    { title: 'DevOps Engineer', percentage: 65 },
    { title: 'UX Designer', percentage: 58 },
  ];

  const salaryData = [
    { role: 'React Developer', avg: '₦95,000', min: '₦75,000', max: '₦120,000', yoy: '+8%' },
    { role: 'Data Scientist', avg: '₦110,000', min: '₦85,000', max: '₦145,000', yoy: '+12%' },
    { role: 'Product Manager', avg: '₦105,000', min: '₦80,000', max: '₦135,000', yoy: '+6%' },
    { role: 'DevOps Engineer', avg: '₦98,000', min: '₦78,000', max: '₦125,000', yoy: '+9%' },
    { role: 'UX Designer', avg: '₦88,000', min: '₦68,000', max: '₦115,000', yoy: '+5%' },
  ];

  const cities = [
    { name: 'San Francisco', count: 2340, width: '100%' },
    { name: 'New York', count: 2180, width: '93%' },
    { name: 'Seattle', count: 1890, width: '81%' },
    { name: 'Austin', count: 1450, width: '62%' },
    { name: 'Boston', count: 1220, width: '52%' },
  ];

  const skills = [
    { name: 'React', demand: 'High' },
    { name: 'TypeScript', demand: 'High' },
    { name: 'Python', demand: 'High' },
    { name: 'AWS', demand: 'High' },
    { name: 'Kubernetes', demand: 'Medium' },
    { name: 'GraphQL', demand: 'Medium' },
    { name: 'Rust', demand: 'Rising' },
    { name: 'Go', demand: 'Rising' },
    { name: 'Swift', demand: 'Medium' },
    { name: 'Flutter', demand: 'Rising' },
  ];

  const getDemandColor = (demand: string) => {
    switch (demand) {
      case 'High':
        return 'bg-blue-600 text-white';
      case 'Medium':
        return 'bg-blue-400 text-white';
      case 'Rising':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header />

      <PageHero
        compact
        title="Career Analytics"
        subtitle="Track your job search performance and market trends"
        images={HERO_CAROUSELS.analytics}
        imageAlt="Analytics dashboard visualization"
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* A/B Test Metrics */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500">Hero A/B Variant</p>
                <h3 className="text-xl font-bold text-gray-900">Variant {abMetrics.variant}</h3>
              </div>
              <button
                onClick={refreshMetrics}
                className="text-sm text-blue-700 hover:underline"
              >
                Refresh
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-gray-700">
                <span>Exposure A</span>
                <span>{abMetrics.exposures.A}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-700">
                <span>Exposure B</span>
                <span>{abMetrics.exposures.B}</span>
              </div>
              <div className="h-px bg-gray-100 my-3" />
              <div className="flex items-center justify-between text-sm text-gray-700">
                <span>CTA clicks A</span>
                <span>{abMetrics.ctaClicks.A}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-700">
                <span>CTA clicks B</span>
                <span>{abMetrics.ctaClicks.B}</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Conversion Ratio</h3>
            <p className="text-sm text-gray-600 mb-4">CTA clicks divided by exposures for each variant.</p>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between">
                <span>Variant A</span>
                <span>{abMetrics.exposures.A ? `${((abMetrics.ctaClicks.A / abMetrics.exposures.A) * 100).toFixed(1)}%` : '0.0%'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Variant B</span>
                <span>{abMetrics.exposures.B ? `${((abMetrics.ctaClicks.B / abMetrics.exposures.B) * 100).toFixed(1)}%` : '0.0%'}</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-500">Last updated</p>
                <p className="text-base font-semibold text-gray-900">{new Date(abMetrics.lastUpdated).toLocaleString()}</p>
              </div>
              <button
                onClick={() => {
                  resetHeroAbMetrics();
                  refreshMetrics();
                }}
                className="text-sm text-red-600 hover:underline"
              >
                Reset
              </button>
            </div>
            <p className="text-sm text-gray-600">This panel stores metrics locally in browser storage for quick A/B experimentation tracking.</p>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="mb-8 flex gap-2 flex-wrap">
          {(['week', 'month', 'quarter', 'year'] as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                dateRange === range
                  ? 'bg-blue-700 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.title}
                className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-700"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">{kpi.title}</p>
                    <h3 className="text-3xl font-bold text-gray-900 mt-2">{kpi.value}</h3>
                  </div>
                  <Icon className="text-blue-700" size={24} />
                </div>
                <p className="text-green-600 text-sm font-semibold">{kpi.change} vs last period</p>
              </div>
            );
          })}
        </div>

        {/* Application Activity */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Application Activity</h2>
          <div className="space-y-4">
            {applicationData.map((item) => (
              <div key={item.day} className="flex items-center gap-4">
                <span className="w-12 font-semibold text-gray-700">{item.day}</span>
                <div className="flex-1">
                  <div
                    className="h-8 bg-gradient-to-r from-blue-600 to-blue-500 rounded"
                    style={{ width: item.width }}
                  />
                </div>
                <span className="w-16 text-right font-semibold text-gray-700">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Job Market Trends */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Job Market Trends</h2>
          <div className="space-y-4">
            {trendingJobs.map((job) => (
              <div key={job.title} className="flex items-center gap-4">
                <span className="w-32 font-medium text-gray-700">{job.title}</span>
                <div className="flex-1">
                  <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-700 h-full"
                      style={{ width: `${job.percentage}%` }}
                    />
                  </div>
                </div>
                <span className="w-12 text-right font-semibold text-blue-700">
                  {job.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Salary Benchmarks Table */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Salary Benchmarks</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Avg Salary</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Min</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Max</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">YoY Change</th>
                </tr>
              </thead>
              <tbody>
                {salaryData.map((item) => (
                  <tr key={item.role} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 font-medium text-gray-900">{item.role}</td>
                    <td className="py-4 px-4 text-gray-700">{item.avg}</td>
                    <td className="py-4 px-4 text-gray-700">{item.min}</td>
                    <td className="py-4 px-4 text-gray-700">{item.max}</td>
                    <td className="py-4 px-4 font-semibold text-green-600">{item.yoy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Geographic Heatmap */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Geographic Heatmap</h2>
          <div className="space-y-4">
            {cities.map((city) => (
              <div key={city.name} className="flex items-center gap-4">
                <span className="w-24 font-medium text-gray-700">{city.name}</span>
                <div className="flex-1">
                  <div className="bg-gray-200 rounded h-6 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded flex items-center justify-end pr-2"
                      style={{ width: city.width }}
                    >
                      <span className="text-white text-xs font-bold">{city.count}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Market Insights Video */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Remote work trends</h2>
          <VideoPlayer
            src={VIDEO.remoteWork.src}
            poster={VIDEO.remoteWork.poster}
            title="Remote work trends"
          />
        </div>

        {/* Skills Demand */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Skills Demand</h2>
          <div className="flex flex-wrap gap-3">
            {skills.map((skill) => (
              <div
                key={skill.name}
                className={`px-4 py-2 rounded-full font-medium transition-all ${getDemandColor(
                  skill.demand
                )}`}
              >
                {skill.name}
                <span className="ml-2 text-xs opacity-80">({skill.demand})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
