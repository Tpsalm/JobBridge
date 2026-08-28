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
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex items-stretch min-h-14">
        {tabs.map(({ label, path, icon: Icon }) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              to={path}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors"
            >
              <Icon
                className={`h-5 w-5 transition-colors ${active ? 'text-blue-700' : 'text-gray-400'}`}
                strokeWidth={active ? 2.5 : 1.75}
              />
              <span className={`max-w-full truncate text-[10px] font-medium transition-colors ${active ? 'text-blue-700' : 'text-gray-400'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
