import { Link, useLocation } from 'react-router-dom';
import { Home, Briefcase, Users, BarChart3, CreditCard } from 'lucide-react';

const tabs = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Jobs', path: '/jobs', icon: Briefcase },
  { label: 'Providers', path: '/providers', icon: Users },
  { label: 'Business', path: '/business', icon: BarChart3 },
  { label: 'Payment', path: '/payment', icon: CreditCard },
];

export default function BottomNav() {
  const location = useLocation();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex items-center">
        {tabs.map(({ label, path, icon: Icon }) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              to={path}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors"
            >
              <Icon
                className={`w-5 h-5 transition-colors ${active ? 'text-blue-700' : 'text-gray-400'}`}
                strokeWidth={active ? 2.5 : 1.75}
              />
              <span className={`text-[10px] font-medium transition-colors ${active ? 'text-blue-700' : 'text-gray-400'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
