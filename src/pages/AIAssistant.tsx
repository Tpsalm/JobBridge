import React, { useState } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import { Bot, Send, Lightbulb, Zap, Brain, TrendingUp } from 'lucide-react';
import VideoPlayer from '../components/VideoPlayer';
import { IMG, VIDEO } from '../lib/media';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return greeting;
}

export default function AIAssistant() {
  const { openModal } = useModal();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'bot',
      content:
        `${getTimeGreeting()}! I'm your AI career assistant. I can help with resume writing, interview prep, job search strategies, and salary negotiation. What can I help you today?`,
    },
    {
      role: 'user',
      content: 'Can you help me optimize my resume for a senior frontend role?',
    },
    {
      role: 'bot',
      content:
        'Absolutely! To optimize your resume for a senior frontend role, focus on: 1) Quantifiable achievements (e.g., "Reduced load time by 40%"), 2) Modern tech stack keywords (React, TypeScript, Next.js), 3) Leadership examples, 4) Open source contributions. Would you like me to analyze your current resume?',
    },
  ]);
  const [inputValue, setInputValue] = useState('');

  const suggestedPrompts = [
    'Review my resume',
    'Interview tips',
    'Salary negotiation',
    'Career pivot advice',
    'Top companies hiring',
    'Skills gap analysis',
  ];

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      setMessages([...messages, { role: 'user', content: inputValue }]);
      setInputValue('');
    }
  };

  const handleSuggestedPrompt = (prompt: string) => {
    setMessages([...messages, { role: 'user', content: prompt }]);
    setInputValue('');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-4 lg:p-8">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Bot className="w-8 h-8 text-blue-700" />
              <h1 className="text-3xl font-bold text-gray-900">JobBridge AI</h1>
            </div>
            <p className="text-gray-600">Your AI-powered career coach</p>
          </div>

          {/* Chat Area */}
          <div className="flex-1 bg-gray-50 rounded-lg p-4 overflow-y-auto mb-4 max-h-[60vh]">
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-700 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested Prompts */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Suggested prompts:</p>
            <div className="flex overflow-x-auto gap-2 pb-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="whitespace-nowrap px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm hover:bg-blue-100 hover:text-blue-700 transition"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask me anything about your career..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-700"
            />
            <button
              onClick={handleSendMessage}
              className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>

        {/* Sidebar - Quick Actions */}
        <div className="w-full lg:w-72 space-y-3">
          <div className="rounded-xl overflow-hidden mb-4 hidden lg:block">
            <img src={IMG.hero.ai} alt="AI career assistant" className="w-full h-36 object-cover" />
          </div>

          <div className="hidden lg:block mb-4">
            <VideoPlayer
              src={VIDEO.howItWorks.src}
              poster={VIDEO.howItWorks.poster}
              title="AI career coaching demo"
              className="shadow-md"
            />
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>

          {/* AI Resume Builder */}
          <button
            onClick={() => openModal('ai-resume')}
            className="w-full p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 hover:shadow-md transition text-left"
          >
            <div className="flex items-start gap-3">
              <Zap className="w-6 h-6 text-blue-700 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">AI Resume Builder</h3>
                <p className="text-sm text-gray-700">Generate and optimize</p>
              </div>
            </div>
          </button>

          {/* Career Assessment */}
          <button
            onClick={() =>
              openModal('info', {
                title: 'Career Assessment',
                content:
                  'Our AI analyzes your skills, experience, and goals to provide a personalized career roadmap with specific action steps.',
              })
            }
            className="w-full p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition text-left"
          >
            <div className="flex items-start gap-3">
              <Brain className="w-6 h-6 text-blue-700 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">Career Assessment</h3>
                <p className="text-sm text-gray-700">Discover your path</p>
              </div>
            </div>
          </button>

          {/* Interview Simulator */}
          <button
            onClick={() =>
              openModal('info', {
                title: 'Interview Simulator',
                content:
                  'Practice common interview questions with AI feedback on your answers, body language tips, and confidence coaching.',
              })
            }
            className="w-full p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition text-left"
          >
            <div className="flex items-start gap-3">
              <Lightbulb className="w-6 h-6 text-blue-700 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">Interview Simulator</h3>
                <p className="text-sm text-gray-700">Practice with AI feedback</p>
              </div>
            </div>
          </button>

          {/* Salary Insights */}
          <button
            onClick={() =>
              openModal('info', {
                title: 'Salary Insights',
                content:
                  'Get real-time salary data for your role and location, with negotiation scripts and benchmark comparisons.',
              })
            }
            className="w-full p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition text-left"
          >
            <div className="flex items-start gap-3">
              <TrendingUp className="w-6 h-6 text-blue-700 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">Salary Insights</h3>
                <p className="text-sm text-gray-700">Real-time salary data</p>
              </div>
            </div>
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
