import { useState } from 'react';
import { companyLogoUrl } from '../lib/media';

interface CompanyLogoProps {
  company: string;
  className?: string;
  fallbackClassName?: string;
}

function getInitials(name: string) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function CompanyLogo({ company, className = 'w-11 h-11 rounded-lg', fallbackClassName = 'bg-blue-600' }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);
  const logoUrl = companyLogoUrl(company);

  if (!logoUrl || failed) {
    return (
      <div className={`${className} ${fallbackClassName} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
        {getInitials(company)}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={`${company} logo`}
      className={`${className} object-contain bg-white border border-gray-100 shrink-0`}
      onError={() => setFailed(true)}
    />
  );
}
