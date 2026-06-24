import { Instagram, Facebook, Twitter } from 'lucide-react';
import JobBridgeLogo from './JobBridgeLogo';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <JobBridgeLogo variant="horizontal" iconSize={28} />

        <div className="text-sm text-gray-700">
          <div className="font-semibold text-gray-900">Contact JobBridge</div>
          <div className="mt-1">No 4, Phenol Crystal Street, Koomi Rd, Saki, Oyo State</div>
          <div className="mt-1">Email: jobbridgesupport@gmail.com</div>
          <div>WhatsApp: 09136171354</div>
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-900 mb-2">Social</div>
          <div className="flex gap-3">
            <a href="https://www.instagram.com/jobbridge__" target="_blank" rel="noopener noreferrer" className="p-2.5 bg-gray-100 hover:bg-pink-50 rounded-lg transition" aria-label="Instagram">
              <Instagram className="w-5 h-5 text-pink-600" />
            </a>
            <a href="https://www.facebook.com/share/1DhVVgkF6P/" target="_blank" rel="noopener noreferrer" className="p-2.5 bg-gray-100 hover:bg-blue-50 rounded-lg transition" aria-label="Facebook">
              <Facebook className="w-5 h-5 text-blue-700" />
            </a>
            <a href="https://x.com/jobbridge_com" target="_blank" rel="noopener noreferrer" className="p-2.5 bg-gray-100 hover:bg-blue-50 rounded-lg transition" aria-label="X">
              <Twitter className="w-5 h-5 text-blue-700" />
            </a>
          </div>
        </div>

        <div className="text-sm text-gray-500">© {new Date().getFullYear()} JobBridge</div>
      </div>
    </footer>
  );
}
