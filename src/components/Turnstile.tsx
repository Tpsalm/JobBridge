import { useEffect, useRef } from 'react';

interface TurnstileProps {
  onVerify: (token: string) => void;
  theme?: 'light' | 'dark' | 'auto';
}

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'; // testing key

export default function Turnstile({ onVerify, theme = 'light' }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY || SITE_KEY.startsWith('1x000')) {
      // No real key configured — auto-verify for development
      onVerify('dummy-token');
      return;
    }

    const scriptId = 'cf-turnstile-script';
    const initWidget = () => {
      if (containerRef.current && window.turnstile) {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: onVerify,
          theme,
        });
      }
    };

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
      script.async = true;
      script.defer = true;
      window.onTurnstileLoad = initWidget;
      document.head.appendChild(script);
    } else if (window.turnstile) {
      initWidget();
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  return <div ref={containerRef} className="flex justify-center my-4" />;
}
