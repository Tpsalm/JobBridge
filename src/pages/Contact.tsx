import React, { useState } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import { useModal } from '../contexts/ModalContext';
import { Phone, Mail, Twitter, Instagram, Facebook, MapPin } from 'lucide-react';

type SubjectType = 'general' | 'technical' | 'partnership' | 'media' | 'other';

export default function Contact() {
  const { openModal } = useModal();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'general' as SubjectType,
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const subjects: { value: SubjectType; label: string }[] = [
    { value: 'general', label: 'General' },
    { value: 'technical', label: 'Technical Support' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'media', label: 'Media' },
    { value: 'other', label: 'Other' },
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setFormData({ name: '', email: '', subject: 'general', message: '' });
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1 p-4 lg:p-8">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Contact Form */}
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-8">Get in Touch</h1>

            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <p className="text-green-900 font-medium mb-2">Message sent!</p>
                <p className="text-green-700 text-sm">
                  We'll get back to you as soon as possible.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-700"
                    placeholder="Your name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-700"
                    placeholder="your@email.com"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-900 mb-2">
                    Subject
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-700"
                  >
                    {subjects.map((subj) => (
                      <option key={subj.value} value={subj.value}>
                        {subj.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-900 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-700 resize-none"
                    placeholder="Tell us more..."
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800 transition"
                >
                  Send Message
                </button>
              </form>
            )}

            {/* Response Time Notice */}
            <p className="text-sm text-gray-600 mt-6 text-center">
              We typically respond within 24 hours
            </p>
          </div>

          {/* Contact Info */}
          <div>
            {/* Contact Image */}
            <div className="mb-8 rounded-lg overflow-hidden">
              <img
                src="https://images.pexels.com/photos/927022/pexels-photo-927022.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&dpr=2"
                alt="Contact us"
                className="w-full h-48 object-cover"
              />
            </div>
            {/* Info Cards */}
            <div className="space-y-6 mb-8">
              {/* Address */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Office Address</h2>
                <div className="flex gap-3">
                  <MapPin className="w-5 h-5 text-blue-700 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-gray-900">No 4, Phenol Crystal Street</p>
                    <p className="text-gray-500 text-sm">Koomi Rd, Saki, Oyo State</p>
                  </div>
                </div>
              </div>

              {/* Phone / WhatsApp */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Phone</h2>
                <div className="flex gap-3">
                  <Phone className="w-5 h-5 text-blue-700 flex-shrink-0 mt-1" />
                  <div>
                    <a
                      href="https://wa.me/2348024425069"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-700 hover:underline"
                    >
                      +234 802 442 5069
                    </a>
                    <p className="text-gray-600 text-sm">WhatsApp support</p>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Email</h2>
                <div className="flex gap-3">
                  <Mail className="w-5 h-5 text-blue-700 flex-shrink-0 mt-1" />
                  <div>
                    <a
                      href="mailto:jobbridgesupport@gmail.com"
                      className="text-blue-700 hover:underline"
                    >
                      jobbridgesupport@gmail.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Follow Us</h2>
                <div className="flex gap-4">
                  <a
                    href="https://x.com/jobbridge_com?s=11"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-gray-100 hover:bg-blue-100 rounded-lg transition"
                    aria-label="Twitter"
                  >
                    <Twitter className="w-5 h-5 text-blue-700" />
                  </a>
                  <a
                    href="https://www.instagram.com/jobbridge__?igsh=MThudW5wdHF0d3Qyeg%3D%3D&utm_source=qr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-gray-100 hover:bg-pink-50 rounded-lg transition"
                    aria-label="Instagram"
                  >
                    <Instagram className="w-5 h-5 text-pink-600" />
                  </a>
                  <a
                    href="https://www.facebook.com/share/1DhVVgkF6P/?mibextid=wwXIfr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-gray-100 hover:bg-blue-50 rounded-lg transition"
                    aria-label="Facebook"
                  >
                    <Facebook className="w-5 h-5 text-blue-700" />
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
