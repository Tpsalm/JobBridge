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
  "/ceo": "Meet the leadership vision behind JobBridge and discover the story of the people shaping the platform.",
  "/pricing": "Review available plans and discover the right path for your career growth.",
  "/payment": "Explore payment options and checkout choices designed to make your experience smooth and secure.",
  "/blog": "Read career stories, insights, and updates from the JobBridge community.",
  "/profile": "Manage your professional profile, update your details, and keep your account secure.",
  "/ai-resume": "Create a sharper AI-enhanced resume that highlights your experience with confidence.",
  "/messages": "Stay connected with conversations, updates, and opportunities in your network.",
  "/recruiter": "Explore recruiting tools and discover how JobBridge helps teams find strong candidates.",
  "/career": "Unlock career guidance and practical tools that support your next move.",
  "/analytics": "Explore insights and performance data that help you make smarter decisions.",
  "/games": "Take a break and enjoy light activities designed to keep the experience engaging.",
  "/signup": "Create your account and begin building a strong professional presence on JobBridge.",
  "/login": "Sign in and continue your journey with JobBridge.",
  "/privacy": "Review privacy details and understand how your data is protected.",
  "/business": "Discover advertising and business growth tools crafted for ambitious teams.",
  "/profile-visibility": "Adjust who can see your profile and refine your privacy settings.",
  "/job-preferences": "Set your job preferences and fine-tune the opportunities you receive.",
  "/following": "Keep track of the people and companies you follow.",
  "/reviews": "Read reviews and ratings to stay informed and make confident choices.",
};

const DEFAULT_MESSAGE = "Welcome to JobBridge. Your next step in growth begins here.";

const PAGE_MUSIC_PRESETS: Record<string, { notes: number[]; waveforms: OscillatorType[]; pace: number; gain: number }> = {
  "/": { notes: [196, 246.94, 329.63, 392], waveforms: ["sine", "triangle", "sine", "triangle"], pace: 3200, gain: 0.0057 },
  "/jobs": { notes: [261.63, 329.63, 392, 523.25, 587.33], waveforms: ["triangle", "sine", "square", "triangle", "sine"], pace: 2100, gain: 0.0075 },
  "/ai-resume": { notes: [220, 261.63, 329.63, 392], waveforms: ["sine", "triangle", "sine", "triangle"], pace: 2400, gain: 0.0068 },
  "/ceo": { notes: [196, 220, 261.63, 329.63, 392], waveforms: ["sine", "triangle", "sine", "triangle", "sine"], pace: 3400, gain: 0.0052 },
  "/pricing": { notes: [196, 246.94, 293.66, 349.23, 392], waveforms: ["triangle", "sine", "triangle", "sine", "triangle"], pace: 3000, gain: 0.0061 },
  "/payment": { notes: [220, 277.18, 329.63, 392], waveforms: ["sine", "triangle", "sine", "triangle"], pace: 2800, gain: 0.0059 },
  "/about": { notes: [196, 261.63, 329.63, 392], waveforms: ["sine", "triangle", "sine", "triangle"], pace: 3100, gain: 0.0056 },
  default: { notes: [196, 246.94, 329.63, 392, 440], waveforms: ["sine", "triangle", "sine", "triangle", "sine"], pace: 2800, gain: 0.0062 },
};

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

function formatSpeechText(text: string, mode: "page" | "assistant" = "page") {
  const normalized = text.replace(/[#*_`]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return normalized;

  const pauses = normalized
    .replace(/([.!?])\s+/g, "$1 ")
    .replace(/(Welcome to JobBridge|Discover meaningful jobs|Browse curated opportunities|Meet skilled providers|Review available plans|Create a sharper AI-enhanced resume|Manage your professional profile|Explore recruiting tools|Unlock career guidance|Here|Welcome|Let me|You can|To get started|On this page)/gi, "$1...")
    .replace(/(\.\.\.)/g, "... ");

  return mode === "assistant" ? pauses.replace(/(JobBridge|AI|career|resume|jobs|profile)/gi, "$1") : pauses;
}

function speakText(text: string, mode: "page" | "assistant" = "page") {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  const normalized = formatSpeechText(text, mode);
  if (!normalized) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(normalized);
  utterance.lang = "en-US";
  utterance.rate = mode === "assistant" ? 1.02 : 0.97;
  utterance.pitch = mode === "assistant" ? 1.08 : 1.02;
  utterance.volume = mode === "assistant" ? 0.95 : 0.9;
  const voice = pickVoice();

  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
}

export default function AudioExperience() {
  const location = useLocation();
  // Hide the audio/voice control on the public homepage only
  if (location.pathname === "/") {
    return null;
  }
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

  const startMusic = (path: string) => {
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

    const preset = PAGE_MUSIC_PRESETS[path] || PAGE_MUSIC_PRESETS.default;
    isPlayingRef.current = true;
    let noteIndex = 0;

    const playStep = () => {
      if (!isPlayingRef.current || !audioContextRef.current) {
        return;
      }

      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      const chord = [preset.notes[noteIndex % preset.notes.length], preset.notes[(noteIndex + 2) % preset.notes.length], preset.notes[(noteIndex + 4) % preset.notes.length]];

      chord.forEach((frequency, layerIndex) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        const filterNode = ctx.createBiquadFilter();
        const waveType = preset.waveforms[layerIndex] || preset.waveforms[preset.waveforms.length - 1];

        oscillator.type = waveType as OscillatorType;
        oscillator.frequency.setValueAtTime(frequency, now);
        filterNode.type = "lowpass";
        filterNode.frequency.setValueAtTime(1800, now);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(layerIndex === 2 ? preset.gain * 0.7 : preset.gain, now + 0.85);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

        oscillator.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(now);
        oscillator.stop(now + 3.0);
      });

      noteIndex = (noteIndex + 1) % preset.notes.length;
      musicTimerRef.current = window.setTimeout(playStep, preset.pace);
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

    startMusic(location.pathname);
  }, [isEnabled, location.pathname]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const currentPath = location.pathname;
    const message = PAGE_MESSAGES[currentPath] || DEFAULT_MESSAGE;

    const timer = window.setTimeout(() => {
      speakText(message, "page");
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
