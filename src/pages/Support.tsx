import React, { useState } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import { Search, MessageCircle, Mail, Phone, CheckCircle, ChevronDown, MapPin } from 'lucide-react';
import Card3D from '../components/Card3D';
import AnimatedSection from '../components/AnimatedSection';

interface FAQ {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  faqs: FAQ[];
}

export default function Support() {
  const { openModal } = useModal();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const faqCategories: FAQCategory[] = [
    {
      title: 'Account & Profile',
      faqs: [
        {
          question: 'How do I reset my password?',
          answer:
            'Click "Forgot Password" on the login page and enter your email. We\'ll send you a reset link valid for 24 hours.',
        },
        {
          question: 'Can I change my email address?',
          answer:
            'Yes, go to Settings > Account and click "Change Email". You\'ll need to verify your new email address.',
        },
        {
          question: 'How do I delete my account?',
          answer:
            'Navigate to Settings > Account > Delete Account. Note that this action is permanent and cannot be undone.',
        },
      ],
    },
    {
      title: 'Job Applications',
      faqs: [
        {
          question: 'Can I apply to multiple jobs at once?',
          answer:
            'Yes, JobBridge allows you to apply to unlimited jobs. You can also save jobs to apply later from your saved list.',
        },
        {
          question: 'How do I track my applications?',
          answer:
            'Use the "My Applications" dashboard to see all submitted applications, their status, and any recruiter messages.',
        },
        {
          question: 'Can I withdraw an application?',
          answer:
            'Yes, you can withdraw applications from the "My Applications" page if the status is "Applied" or "In Review".',
        },
      ],
    },
    {
      title: 'Premium & Billing',
      faqs: [
        {
          question: 'What payment methods do you accept?',
          answer:
            'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and Apple Pay.',
        },
        {
          question: 'Can I cancel my subscription anytime?',
          answer:
            'Yes, you can cancel anytime from your billing settings. Your access continues until the end of your billing cycle.',
        },
        {
          question: 'Do you offer refunds?',
          answer:
            'We offer 30-day money-back guarantee if you\'re not satisfied with your subscription. Contact jobbridgesupport@gmail.com.',
        },
      ],
    },
    {
      title: 'Technical Issues',
      faqs: [
        {
          question: 'The website is loading slowly. What should I do?',
          answer:
            'Clear your browser cache, disable extensions, and try a different browser. If issues persist, contact our support team.',
        },
        {
          question: 'Is JobBridge available as a mobile app?',
          answer:
            'Yes! Download JobBridge from the App Store or Google Play. The mobile app offers the same features as the web version.',
        },
        {
          question: 'What browsers does JobBridge support?',
          answer:
            'We support Chrome, Firefox, Safari, and Edge (latest versions). We recommend keeping your browser updated for best performance.',
        },
      ],
    },
  ];

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1 p-4 lg:p-8">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="relative rounded-2xl overflow-hidden mb-8">
            <img
              src="https://images.pexels.com/photos/927022/pexels-photo-927022.jpeg?auto=compress&cs=tinysrgb&w=800&h=300&dpr=2"
              alt="Support center"
              className="w-full h-48 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 to-blue-700/60 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl lg:text-5xl font-bold text-white mb-2">
                  How can we help you?
                </h1>
                <p className="text-blue-100">Our support team is here for you</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for help..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-700"
            />
          </div>
        </div>

        {/* Status Banner */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-green-900 font-medium">All systems operational</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto grid lg:grid-cols-3 gap-8 mb-12">
          {/* FAQ Section */}
          <AnimatedSection direction="up" className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqCategories.map((category) => (
                <div key={category.title}>
                  <button
                    onClick={() => toggleCategory(category.title)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-left"
                  >
                    <h3 className="font-semibold text-gray-900">{category.title}</h3>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-600 transition ${
                        openCategories[category.title] ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openCategories[category.title] && (
                    <div className="bg-white border border-gray-200 border-t-0 space-y-4 p-4 rounded-b-lg">
                      {category.faqs.map((faq, idx) => (
                        <div key={idx} className="pb-4 border-b last:pb-0 last:border-b-0">
                          <h4 className="font-medium text-gray-900 mb-2">{faq.question}</h4>
                          <p className="text-gray-700 text-sm">
                            {faq.answer.split(/(jobbridgesupport@gmail\.com)/).map((part, i) =>
                              part.match(/jobbridgesupport@gmail\.com/) ? (
                                <a key={i} href={`mailto:${part}`} className="text-blue-700 hover:underline">{part}</a>
                              ) : part
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AnimatedSection>

          {/* Contact Support Section */}
          <AnimatedSection direction="up">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Support</h2>
            <div className="space-y-4">
              {/* Live Chat — opens WhatsApp */}
              <Card3D
                onClick={() => window.open('https://wa.me/2349136171354', '_blank')}
                className="w-full"
                strength={6}
              >
                <button className="w-full flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition text-left border border-blue-200">
                  <MessageCircle className="w-5 h-5 text-blue-700 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Live Chat</p>
                    <p className="text-sm text-blue-700 font-medium">09136171354</p>
                    <p className="text-xs text-gray-600">Mon-Fri, 9am-10pm CAT</p>
                  </div>
                </button>
              </Card3D>

              {/* Email Support — opens mailto */}
              <Card3D className="w-full" strength={6}>
                <a
                  href="mailto:jobbridgesupport@gmail.com"
                  className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-blue-50 rounded-lg transition border border-gray-200"
                >
                  <Mail className="w-5 h-5 text-blue-700 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Email Support</p>
                    <p className="text-sm text-blue-700 hover:underline">jobbridgesupport@gmail.com</p>
                  </div>
                </a>
              </Card3D>

              {/* Office Address */}
              <Card3D className="w-full" strength={6}>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <MapPin className="w-5 h-5 text-blue-700 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Office Address</p>
                    <p className="text-sm text-gray-600">No 4, Phenol Crystal Street, Koomi Rd, Saki, Oyo State</p>
                  </div>
                </div>
              </Card3D>

              {/* Phone Support */}
              <Card3D className="w-full" strength={6}>
                <a
                  href="tel:+2349136171354"
                  className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-blue-50 rounded-lg transition border border-gray-200"
                >
                  <Phone className="w-5 h-5 text-blue-700 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Call Us</p>
                    <p className="text-sm text-blue-700 hover:underline">09136171354</p>
                  </div>
                </a>
              </Card3D>
            </div>
          </AnimatedSection>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
