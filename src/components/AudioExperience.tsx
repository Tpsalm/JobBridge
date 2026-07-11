import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Volume2, VolumeX } from "lucide-react";

const PAGE_MESSAGES: Record<string, string> = {
  "/": "Welcome to JobBridge. Discover meaningful jobs, connect with trusted providers, and explore smart career tools.",
  "/jobs": "Browse curated opportunities and find the role that matches your ambitions.",
  "/providers": "Meet skilled providers and discover services built to support your next opportunity.",
  "/support": "Visit support for guidance, answers, and help whenever you need it.",
  "/contact": "Reach out to the JobBridge team with questions, partnerships, or feedback.",
  "/about": "Learn more about JobBridge and the mission behind the platform.",
  "/pricing": "Review available plans and discover the right path for your career growth.",
  "/blog": "Read career stories, insights, and updates from the JobBridge community.",
  "/profile": "Manage your professional profile, update your details, and keep your account secure.",
  "/ai-resume": "Create a sharper AI-enhanced resume that highlights your experience with confidence.",
  "/messages": "Stay connected with conversations, updates, and opportunities in your network.",
  "/recruiter": "Explore recruiting tools and discover how JobBridge helps teams find strong candidates.",
  "/career": "Unlock career guidance and practical tools that support your next move.",
  "/analytics": "Explore insights and performance data that help you make smarter decisions.",
  "/games": "Take a break and enjoy light activities designed to keep the experience engaging.",
};

const DEFAULT_MESSAGE = "Welcome to JobBridge. Your next step in growth begins here.";

function pickVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((voice) =>
    voice.lang.startsWith("en") && /female|samantha|zira|victoria|ava|jessa|susan|alice|emma/i.test(voice.name),
  );

  return preferred ?? voices.find((voice) => voice.lang.startsWith("en")) ?? null;
}

function speakText(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1.05;
  utterance.volume = 0.9;
  const voice = pickVoice();

  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
}

export default function AudioExperience() {
  const location = useLocation();
  const [isEnabled, setIsEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicTimerRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const hasActivatedRef = useRef(false);

  const stopMusic = () => {
    if (musicTimerRef.current) {
      window.clearTimeout(musicTimerRef.current);
      musicTimerRef.current = null;
    }
    isPlayingRef.current = false;
  };

  const startMusic = () => {
    if (typeof window === "undefined") {
      return;
    }

    const AudioContextClass = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;

    if (context.state === "suspended") {
      void context.resume();
    }

    if (isPlayingRef.current) {
      return;
    }

    isPlayingRef.current = true;
    const notes = [261.63, 329.63, 392.0, 440.0];
    let noteIndex = 0;

    const playStep = () => {
      if (!isPlayingRef.current || !audioContextRef.current) {
        return;
      }

      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      const activeNotes = [notes[noteIndex % notes.length], notes[(noteIndex + 1) % notes.length], notes[(noteIndex + 2) % notes.length]];

      activeNotes.forEach((frequency) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filterNode = ctx.createBiquadFilter();

        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, now);
        filterNode.type = "lowpass";
        filterNode.frequency.setValueAtTime(1200, now);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(0.012, now + 0.08);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

        oscillator.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(now);
        oscillator.stop(now + 1.0);
      });

      noteIndex = (noteIndex + 1) % notes.length;
      musicTimerRef.current = window.setTimeout(playStep, 1600);
    };

    playStep();
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const activateAudio = () => {
      if (hasActivatedRef.current) {
        return;
      }

      hasActivatedRef.current = true;
      setIsEnabled(true);
    };

    const events = ["pointerdown", "keydown", "click"]; 
    events.forEach((eventName) => {
      window.addEventListener(eventName, activateAudio, { once: true });
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, activateAudio);
      });
    };
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      stopMusic();
      return;
    }

    startMusic();
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const currentPath = location.pathname;
    const message = PAGE_MESSAGES[currentPath] || DEFAULT_MESSAGE;

    const timer = window.setTimeout(() => {
      speakText(message);
    }, 650);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isEnabled, location.pathname]);

  const toggleAudio = () => {
    if (!isEnabled) {
      setIsEnabled(true);
      return;
    }

    setIsEnabled(false);
    window.speechSynthesis?.cancel();
  };

  return (
    <button
      type="button"
      onClick={toggleAudio}
      aria-label={isEnabled ? "Pause audio experience" : "Enable audio experience"}
      className="fixed bottom-5 right-5 z-[60] flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-lg backdrop-blur transition hover:scale-105 hover:bg-white"
    >
      {isEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
    </button>
  );
}
