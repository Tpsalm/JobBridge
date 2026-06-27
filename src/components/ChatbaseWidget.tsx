import { useEffect } from 'react';

const CHATBOT_ID = import.meta.env.VITE_CHATBASE_ID;

export default function ChatbaseWidget() {
  useEffect(() => {
    if (!CHATBOT_ID) return;

    const win = window as any;

    // Set Chatbase config
    win.chatbaseConfig = {
      chatbotId: CHATBOT_ID,
      domain: 'www.chatbase.co',
    };

    // Inject the Chatbase embed script
    const script = document.createElement('script');
    script.src = 'https://www.chatbase.co/embed.min.js';
    script.setAttribute('chatbotId', CHATBOT_ID);
    script.setAttribute('domain', 'www.chatbase.co');
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      delete win.chatbaseConfig;
    };
  }, []);

  if (!CHATBOT_ID) return null;

  return null;
}