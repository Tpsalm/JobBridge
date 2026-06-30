import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import PageHero from '../components/PageHero';
import { HERO_CAROUSELS } from '../lib/media';
import { Flame, RotateCcw, Star, Zap, Trophy, Brain, Clock, CheckCircle, Medal, Sparkles, X, Music, VolumeX, ChevronRight, Lock, Unlock, Settings } from 'lucide-react';

interface StreakData {
  current: number;
  best: number;
  lastDate: string;
  points: number;
  gamesPlayed: number;
}

interface MemoryCard {
  id: number;
  emoji: string;
  label: string;
  flipped: boolean;
  matched: boolean;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

interface GameStage {
  id: number;
  name: string;
  description: string;
  type: 'memory' | 'quiz';
  unlocked: boolean;
  completed: boolean;
}

const DEFAULT_STREAK: StreakData = { current: 0, best: 0, lastDate: '', points: 0, gamesPlayed: 0 };

// ─── Audio Settings (module-level for Web Audio access) ────────
let musicVolume = 0.06;
let sfxVolume = 0.15;
let sfxEnabled = true;

function loadAudioSettings() {
  try {
    const raw = localStorage.getItem('jobbridge_audio_settings');
    if (raw) { const s = JSON.parse(raw); if (s.musicVolume !== undefined) musicVolume = s.musicVolume; if (s.sfxVolume !== undefined) sfxVolume = s.sfxVolume; if (s.sfxEnabled !== undefined) sfxEnabled = s.sfxEnabled; }
  } catch {}
}

function saveAudioSettings(mv: number, sv: number, se: boolean) {
  try { localStorage.setItem('jobbridge_audio_settings', JSON.stringify({ musicVolume: mv, sfxVolume: sv, sfxEnabled: se })); } catch {}
}

loadAudioSettings();

// ─── Jazz Background Music ──────────────────────────────────────
let jazzCtx: AudioContext | null = null;
let jazzGain: GainNode | null = null;
let jazzPlaying = false;
let jazzTimeout: ReturnType<typeof setTimeout> | null = null;

function getJazzCtx(): AudioContext {
  if (!jazzCtx) jazzCtx = new AudioContext();
  return jazzCtx;
}

function startJazzMusic() {
  if (jazzPlaying) return;
  const ctx = getJazzCtx();
  if (ctx.state === 'suspended') ctx.resume();
  jazzPlaying = true;
  if (!jazzGain) {
    jazzGain = ctx.createGain();
    jazzGain.connect(ctx.destination);
  }
  jazzGain.gain.setValueAtTime(musicVolume, ctx.currentTime);

  const chords = [
    [261.63, 329.63, 392.00, 493.88],
    [220.00, 329.63, 392.00, 440.00],
    [293.66, 349.23, 440.00, 523.25],
    [196.00, 293.66, 392.00, 466.16],
  ];

  const bassNotes = [130.81, 110.00, 146.83, 98.00];
  let stopped = false;

  function playChord(chord: number[], startTime: number, volume: number) {
    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.linearRampToValueAtTime(0, startTime + 3.8);
      osc.connect(gain);
      gain.connect(jazzGain!);
      osc.start(startTime);
      osc.stop(startTime + 3.8);
    });
  }

  function playBass(freq: number, startTime: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.08, startTime);
    gain.gain.linearRampToValueAtTime(0, startTime + 3.8);
    osc.connect(gain);
    gain.connect(jazzGain!);
    osc.start(startTime);
    osc.stop(startTime + 3.8);
  }

  let chordIndex = 0;
  const chordDuration = 4;

  function scheduleLoop() {
    if (stopped || !jazzPlaying) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const idx = (chordIndex + i) % chords.length;
      playChord(chords[idx], now + i * chordDuration, 0.025);
      playBass(bassNotes[idx], now + i * chordDuration);
    }
    chordIndex = (chordIndex + 4) % chords.length;
    jazzTimeout = setTimeout(scheduleLoop, chordDuration * 4 * 1000 - 100);
  }

  scheduleLoop();
}

function stopJazzMusic() {
  jazzPlaying = false;
  if (jazzTimeout) { clearTimeout(jazzTimeout); jazzTimeout = null; }
}

// ─── Sound effects (Web Audio API) ──────────────────────────────
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume?: number) {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume ?? sfxVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playFlipSound() { playTone(600, 0.1, 'sine', 0.1); }
function playMatchSound() {
  playTone(523, 0.12, 'sine', 0.12);
  setTimeout(() => playTone(659, 0.12, 'sine', 0.12), 100);
  setTimeout(() => playTone(784, 0.15, 'sine', 0.12), 200);
}
function playMismatchSound() {
  playTone(300, 0.15, 'square', 0.08);
  setTimeout(() => playTone(250, 0.2, 'square', 0.08), 120);
}
function playWinSound() {
  const notes = [523, 587, 659, 698, 784, 880, 988, 1047];
  notes.forEach((n, i) => setTimeout(() => playTone(n, 0.2, 'sine', 0.12), i * 80));
}
function playCorrectSound() { playTone(784, 0.15, 'sine', 0.12); setTimeout(() => playTone(988, 0.2, 'sine', 0.12), 120); }
function playWrongSound() { playTone(250, 0.2, 'square', 0.08); }
function playStageCompleteSound() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => setTimeout(() => playTone(n, 0.25, 'sine', 0.12), i * 150));
}

// ─── Memory Card Data ───────────────────────────────────────────
const CARD_PAIRS = [
  { emoji: '💼', label: 'Career' },
  { emoji: '🚀', label: 'Growth' },
  { emoji: '🎯', label: 'Goals' },
  { emoji: '💡', label: 'Ideas' },
  { emoji: '🤝', label: 'Network' },
  { emoji: '📈', label: 'Success' },
  { emoji: '🏆', label: 'Achieve' },
  { emoji: '⭐', label: 'Excellence' },
];

const CARD_PAIRS_2 = [
  { emoji: '🌍', label: 'Global' },
  { emoji: '🔧', label: 'Skills' },
  { emoji: '🎓', label: 'Learn' },
  { emoji: '💪', label: 'Strength' },
  { emoji: '🌈', label: 'Diverse' },
  { emoji: '🚦', label: 'Progress' },
  { emoji: '🎨', label: 'Create' },
  { emoji: '🔗', label: 'Connect' },
];

// ─── Quiz Questions Pool ────────────────────────────────────────
const QUIZ_POOL: QuizQuestion[] = [
  { question: 'What does the STAR method stand for in interviews?', options: ['Situation, Task, Action, Result', 'Start, Think, Answer, Respond', 'State, Track, Analyze, Review', 'Structure, Time, Action, Rating'], correct: 0 },
  { question: 'When asked "Tell me about yourself", what should you focus on?', options: ['Your entire life story', 'Your professional background relevant to the role', 'Your personal hobbies only', 'Complaints about your last job'], correct: 1 },
  { question: 'What is the best way to prepare for an interview?', options: ['Show up without preparation', 'Research the company and practice common questions', 'Only read the job title', 'Memorize one answer'], correct: 1 },
  { question: 'What should you wear to a professional job interview?', options: ['Casual clothes', 'Professional attire matching company culture', 'Costume', 'Sportswear'], correct: 1 },
  { question: 'How should you handle a question about your weaknesses?', options: ['Say you have no weaknesses', 'Be honest and mention how you are improving', 'Lie about a weakness', 'Change the subject'], correct: 1 },
  { question: 'What is the ideal length for a resume?', options: ['One page for most professionals', 'As long as possible', 'Only half a page', 'At least 5 pages'], correct: 0 },
  { question: 'What does "networking" mean in a job search context?', options: ['Fixing computer networks', 'Building professional relationships for opportunities', 'Attending parties only', 'Sending spam emails'], correct: 1 },
  { question: 'When should you send a thank-you email after an interview?', options: ['One month later', 'Within 24 hours', 'Never', 'Only if you got the job'], correct: 1 },
  { question: 'What is a "soft skill"?', options: ['Technical programming ability', 'Interpersonal skills like communication and teamwork', 'Physical strength', 'Knowledge of software'], correct: 1 },
  { question: 'What should you do if you don\'t know the answer to an interview question?', options: ['Panic and remain silent', 'Be honest and explain how you would find the answer', 'Make up an answer', 'Walk out'], correct: 1 },
  { question: 'What is the purpose of a cover letter?', options: ['Repeat your resume', 'Introduce yourself and explain why you are a good fit', 'Write a novel', 'List your references'], correct: 1 },
  { question: 'How should you negotiate salary?', options: ['Accept the first offer immediately', 'Research market rates and make a reasoned case', 'Demand an unrealistic amount', 'Avoid talking about money'], correct: 1 },
  { question: 'What is a "behavioral question" in an interview?', options: ['A question about your behavior outside work', 'A question asking how you handled past situations', 'A trick question', 'A personality test'], correct: 1 },
  { question: 'What does "upskilling" mean?', options: ['Moving to a higher floor', 'Learning new skills to advance your career', 'Working faster', 'Changing job titles'], correct: 1 },
  { question: 'What is the best way to answer "Why do you want this job?"', options: ['I need a job', 'Connect your skills and goals to the company\'s mission', 'The salary is good', 'I don\'t know'], correct: 1 },
  { question: 'How should you handle a gap in employment on your resume?', options: ['Hide it', 'Be honest and highlight what you learned during the gap', 'Make up a job', 'Ignore the question'], correct: 1 },
  { question: 'What is a "portfolio" in a job application?', options: ['A briefcase', 'A collection of your work samples and achievements', 'A type of resume', 'A cover letter'], correct: 1 },
  { question: 'What should you do before accepting a job offer?', options: ['Accept immediately', 'Review the offer, ask questions, and consider your goals', 'Ignore the details', 'Ask friends to decide'], correct: 1 },
  { question: 'What is "company culture"?', options: ['The company\'s office design', 'The values, behaviors, and environment of a workplace', 'The company logo', 'The product they sell'], correct: 1 },
  { question: 'How can you make your resume stand out?', options: ['Use fancy fonts and colors', 'Quantify achievements and tailor it to the job', 'Make it 10 pages long', 'Use emojis throughout'], correct: 1 },
  { question: 'What is "work-life balance"?', options: ['Working all the time', 'Balancing professional responsibilities with personal life', 'Working from home only', 'Taking long vacations'], correct: 1 },
  { question: 'What should you do during a phone screening?', options: ['Multi-task while talking', 'Be prepared, speak clearly, and ask thoughtful questions', 'Whisper so no one hears', 'Rush through the call'], correct: 1 },
  { question: 'What does "professional development" mean?', options: ['Going to college forever', 'Ongoing learning to improve your career skills', 'Getting a promotion', 'Changing careers'], correct: 1 },
  { question: 'How should you answer "Where do you see yourself in 5 years?"', options: ['I don\'t plan ahead', 'Share realistic career goals aligned with the role', 'Your job', 'Retired'], correct: 1 },
  { question: 'What is the best way to build a professional network?', options: ['Collect business cards without talking', 'Attend industry events, connect genuinely, and follow up', 'Send connection requests to everyone', 'Only talk to recruiters'], correct: 1 },
  { question: 'What is a "reference check"?', options: ['Checking your social media', 'Contacting people who can vouch for your work', 'A background check', 'A credit check'], correct: 1 },
  { question: 'How should you handle rejection after an interview?', options: ['Give up on job searching', 'Ask for feedback and keep applying to other roles', 'Argue with the recruiter', 'Ignore it'], correct: 1 },
  { question: 'What is "mentorship" in a career context?', options: ['A formal class', 'Guidance from an experienced professional to help you grow', 'A type of promotion', 'A training program'], correct: 1 },
  { question: 'What does "remote work readiness" mean to employers?', options: ['Having a fast internet connection', 'Being self-motivated, communicative, and organized while working remotely', 'Owning a laptop', 'Working from a coffee shop'], correct: 1 },
  { question: 'What should you include in a follow-up email after an interview?', options: ['Ask if you got the job', 'Thank them, reiterate your interest, and highlight a key point from the interview', 'Complain about the process', 'Send your resume again'], correct: 1 },
  { question: 'What is a "hard skill"?', options: ['Being friendly', 'A teachable technical ability like coding or data analysis', 'Personality trait', 'Emotional intelligence'], correct: 1 },
  { question: 'How can you identify your transferable skills?', options: ['Only look at job-specific skills', 'Review your experiences and identify skills useful across different roles', 'Ignore past experience', 'Focus on education only'], correct: 1 },
  { question: 'What does "job hopping" mean?', options: ['Jumping between job sites', 'Changing jobs frequently within short periods', 'A type of commute', 'Working multiple jobs'], correct: 1 },
  { question: 'How should you address a career change in an interview?', options: ['Avoid explaining it', 'Frame it positively by connecting past experience to the new path', 'Apologize for changing careers', 'Say you disliked your old field'], correct: 1 },
  { question: 'What is the best approach to answering "Tell me about a time you failed"?', options: ['Say you never fail', 'Be honest, describe what you learned, and how you improved', 'Blame others', 'Make up a fake failure'], correct: 1 },
  { question: 'What does "personal brand" mean for your career?', options: ['The clothes you wear', 'How you present your professional reputation and expertise', 'Your social media followers', 'Your job title'], correct: 1 },
  { question: 'How should you research a company before an interview?', options: ['Just read the job description', 'Study their website, recent news, products, and company culture', 'Look at their logo', 'Ask friends about the company'], correct: 1 },
  { question: 'What is a "skills gap"?', options: ['A gap between buildings', 'The difference between skills you have and skills a job requires', 'A missing tool', 'A type of interview question'], correct: 1 },
  { question: 'What does "diversity and inclusion" mean in the workplace?', options: ['Hiring people from the same background', 'Creating an environment where all employees feel valued and respected', 'Only hiring minorities', 'A legal requirement'], correct: 1 },
  { question: 'What is the best way to answer "What are your salary expectations?"', options: ['Give a number immediately', 'Provide a range based on market research and your experience', 'Refuse to answer', 'Ask for the maximum'], correct: 1 },
];

const STAGES: GameStage[] = [
  { id: 1, name: 'Memory Match', description: 'Match the career pairs', type: 'memory', unlocked: true, completed: false },
  { id: 2, name: 'Interview Basics', description: 'Essential interview knowledge', type: 'quiz', unlocked: false, completed: false },
  { id: 3, name: 'Behavioral Mastery', description: 'Tackle behavioral questions', type: 'quiz', unlocked: false, completed: false },
  { id: 4, name: 'Resume & Portfolio', description: 'Craft your professional story', type: 'quiz', unlocked: false, completed: false },
  { id: 5, name: 'Salary & Negotiation', description: 'Know your worth', type: 'quiz', unlocked: false, completed: false },
  { id: 6, name: 'Workplace Wisdom', description: 'Navigate workplace scenarios', type: 'quiz', unlocked: false, completed: false },
  { id: 7, name: 'Career Strategy', description: 'Plan your career path', type: 'quiz', unlocked: false, completed: false },
  { id: 8, name: 'Networking Pro', description: 'Build meaningful connections', type: 'quiz', unlocked: false, completed: false },
  { id: 9, name: 'Leadership Edge', description: 'Show leadership potential', type: 'quiz', unlocked: false, completed: false },
  { id: 10, name: 'Final Challenge', description: 'The ultimate interview test', type: 'quiz', unlocked: false, completed: false },
  { id: 11, name: 'Tile Match Pro', description: 'Match the global career tiles', type: 'memory', unlocked: false, completed: false },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem('jobbridge_streak');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_STREAK;
}

function saveStreak(data: StreakData) {
  localStorage.setItem('jobbridge_streak', JSON.stringify(data));
}

function addStreakNotification(streak: number) {
  try {
    const raw = localStorage.getItem('jobbridge_notifications');
    const notifs: any[] = raw ? JSON.parse(raw) : [];
    notifs.unshift({
      id: 'streak-' + Date.now(),
      type: 'system',
      title: streak >= 7 ? 'Hot Streak!' : 'Streak Bonus!',
      content: streak >= 7
        ? `You're on a ${streak}-day streak! Unstoppable! Keep playing daily to maintain your streak.`
        : `You've earned a ${streak}-day streak! Play daily to reach new milestones.`,
      time: 'Just now',
      isRead: false,
    });
    localStorage.setItem('jobbridge_notifications', JSON.stringify(notifs.slice(0, 50)));
  } catch {}
}

function updateStreak(): StreakData {
  const streak = loadStreak();
  const today = new Date().toDateString();
  if (streak.lastDate === today) return streak;

  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (streak.lastDate === '' || streak.lastDate === yesterday) {
    streak.current += 1;
  } else if (streak.lastDate !== today) {
    streak.current = 1;
  }

  if (streak.current > streak.best) streak.best = streak.current;
  streak.lastDate = today;
  streak.points += 10;
  streak.gamesPlayed += 1;
  saveStreak(streak);
  addStreakNotification(streak.current);
  return streak;
}

function loadStageProgress(): number[] {
  try {
    const raw = localStorage.getItem('jobbridge_stage_progress');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [1];
}

function saveStageProgress(completed: number[]) {
  localStorage.setItem('jobbridge_stage_progress', JSON.stringify(completed));
}

export default function Games() {
  const [musicOn, setMusicOn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sfxOn, setSfxOn] = useState(() => sfxEnabled);
  const [musicVol, setMusicVol] = useState(() => Math.round(musicVolume * 100));
  const [sfxVol, setSfxVol] = useState(() => Math.round(sfxVolume * 100));
  const [currentScreen, setCurrentScreen] = useState<'stages' | 'memory' | 'quiz'>('stages');
  const [currentStage, setCurrentStage] = useState(1);
  const [completedStages, setCompletedStages] = useState<number[]>(() => loadStageProgress());
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [timedOut, setTimedOut] = useState(false);

  // Memory game state
  const [cards, setCards] = useState<MemoryCard[]>(() =>
    shuffle([...CARD_PAIRS, ...CARD_PAIRS].map((pair, i) => ({
      id: i, emoji: pair.emoji, label: pair.label, flipped: false, matched: false,
    })))
  );
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [timer, setTimer] = useState(0);
  const [streak, setStreak] = useState<StreakData>(loadStreak);
  const [showResult, setShowResult] = useState(false);
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [bestScore, setBestScore] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('jobbridge_best_moves') || '999'); } catch { return 999; }
  });
  const memoryCardSet = useRef(CARD_PAIRS);

  // Stage progress
  const stages = STAGES.map(s => ({
    ...s,
    unlocked: completedStages.includes(s.id - 1) || s.id === 1,
    completed: completedStages.includes(s.id),
  }));

  // Audio settings handlers
  const updateMusicVol = (v: number) => {
    setMusicVol(v);
    musicVolume = v / 100;
    if (jazzGain) { try { jazzGain.gain.setValueAtTime(musicVolume, getJazzCtx().currentTime); } catch {} }
    saveAudioSettings(musicVolume, sfxVolume, sfxEnabled);
  };
  const updateSfxVol = (v: number) => {
    setSfxVol(v);
    sfxVolume = v / 100;
    saveAudioSettings(musicVolume, sfxVolume, sfxEnabled);
  };
  const toggleSfx = () => {
    sfxEnabled = !sfxEnabled;
    setSfxOn(sfxEnabled);
    saveAudioSettings(musicVolume, sfxVolume, sfxEnabled);
  };

  // Toggle music
  useEffect(() => {
    if (musicOn) startJazzMusic();
    else stopJazzMusic();
    return () => stopJazzMusic();
  }, [musicOn]);

  // Memory game timer
  useEffect(() => {
    if (gameComplete || currentScreen !== 'memory') return;
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [gameComplete, currentScreen]);

  // Memory match logic
  useEffect(() => {
    if (flippedIds.length !== 2) return;
    const [first, second] = flippedIds;
    const card1 = cards.find(c => c.id === first)!;
    const card2 = cards.find(c => c.id === second)!;
    const isMatch = card1.label === card2.label && first !== second;

    setTimeout(() => {
      setCards(prev =>
        prev.map(c =>
          c.id === first || c.id === second
            ? { ...c, flipped: isMatch ? true : false, matched: isMatch ? true : c.matched }
            : c
        )
      );
      setFlippedIds([]);
      if (isMatch) {
        playMatchSound();
        const newMatched = matchedCount + 1;
        setMatchedCount(newMatched);
        if (newMatched === memoryCardSet.current.length) {
          setGameComplete(true);
          playWinSound();
          const newStreak = updateStreak();
          setStreak(newStreak);
          setShowResult(true);
          setTimeout(() => setShowStreakPopup(true), 800);
          if (moves + 1 < bestScore) {
            setBestScore(moves + 1);
            localStorage.setItem('jobbridge_best_moves', String(moves + 1));
          }
        }
      } else {
        playMismatchSound();
      }
    }, 600);
  }, [flippedIds, cards, moves, matchedCount, bestScore]);

  const handleCardClick = useCallback((cardId: number) => {
    if (gameComplete) return;
    if (flippedIds.length >= 2) return;
    const card = cards.find(c => c.id === cardId);
    if (!card || card.flipped || card.matched) return;

    setCards(prev => prev.map(c => (c.id === cardId ? { ...c, flipped: true } : c)));
    setFlippedIds(prev => [...prev, cardId]);
    setMoves(m => m + 1);
    playFlipSound();
  }, [gameComplete, flippedIds, cards]);

  const resetMemoryGame = () => {
    setCards(shuffle([...CARD_PAIRS, ...CARD_PAIRS].map((pair, i) => ({
      id: i, emoji: pair.emoji, label: pair.label, flipped: false, matched: false,
    }))));
    setFlippedIds([]);
    setMoves(0);
    setMatchedCount(0);
    setGameComplete(false);
    setTimer(0);
    setShowResult(false);
  };

  const startMemoryStage = (stageId: number) => {
    const pairs = stageId === 11 ? CARD_PAIRS_2 : CARD_PAIRS;
    memoryCardSet.current = pairs;
    setCards(shuffle([...pairs, ...pairs].map((pair, i) => ({
      id: i, emoji: pair.emoji, label: pair.label, flipped: false, matched: false,
    }))));
    setFlippedIds([]);
    setMoves(0);
    setMatchedCount(0);
    setGameComplete(false);
    setTimer(0);
    setShowResult(false);
    setCurrentStage(stageId);
    setCurrentScreen('memory');
  };

  const completeMemoryStage = () => {
    const newCompleted = [...new Set([...completedStages, currentStage])];
    setCompletedStages(newCompleted);
    saveStageProgress(newCompleted);
    setCurrentScreen('stages');
  };

  const getTimeLimit = (stageId: number) => stageId <= 2 ? 15 : stageId <= 3 ? 12 : stageId <= 4 ? 10 : 8;
  const getPassThreshold = (stageId: number, total: number) => stageId <= 2 ? Math.ceil(total * 0.6) : stageId <= 3 ? Math.ceil(total * 0.7) : Math.ceil(total * 0.75);
  const hasPenalty = (stageId: number) => stageId >= 4;

  const startQuizStage = (stageId: number) => {
    const pool = shuffle([...QUIZ_POOL]);
    const count = stageId <= 3 ? 5 : stageId <= 6 ? 6 : 8;
    setQuizQuestions(pool.slice(0, count));
    setQuizIndex(0);
    setScore(0);
    setQuizFinished(false);
    setQuizPassed(false);
    setSelectedAnswer(null);
    setShowAnswer(false);
    setTimeLeft(getTimeLimit(stageId));
    setTimedOut(false);
    setCurrentStage(stageId);
    setCurrentScreen('quiz');
  };

  useEffect(() => {
    if (currentScreen !== 'quiz' || quizFinished || showAnswer) return;
    const t = getTimeLimit(currentStage);
    setTimeLeft(t);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimedOut(true);
          setShowAnswer(true);
          setSelectedAnswer(-1);
          if (hasPenalty(currentStage)) setScore(s => Math.max(0, s - 1));
          playWrongSound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentScreen, quizIndex, quizFinished, showAnswer, currentStage]);

  const handleAnswer = (optionIndex: number) => {
    if (showAnswer) return;
    setSelectedAnswer(optionIndex);
    setShowAnswer(true);
    if (optionIndex === quizQuestions[quizIndex].correct) {
      setScore(s => s + 1);
      playCorrectSound();
    } else {
      if (hasPenalty(currentStage)) setScore(s => Math.max(0, s - 1));
      playWrongSound();
    }
  };

  const nextQuizQuestion = () => {
    if (quizIndex < quizQuestions.length - 1) {
      setQuizIndex(i => i + 1);
      setSelectedAnswer(null);
      setShowAnswer(false);
      setTimedOut(false);
      setTimeLeft(getTimeLimit(currentStage));
    } else {
      const passThreshold = getPassThreshold(currentStage, quizQuestions.length);
      const passed = score >= passThreshold;
      setQuizFinished(true);
      setQuizPassed(passed);
      if (passed) {
        playStageCompleteSound();
        const newCompleted = [...new Set([...completedStages, currentStage])];
        setCompletedStages(newCompleted);
        saveStageProgress(newCompleted);
      }
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const streakLevel = streak.current >= 30 ? 'Legendary' : streak.current >= 14 ? 'Unstoppable' : streak.current >= 7 ? 'On Fire' : streak.current >= 3 ? 'Rising' : streak.current >= 1 ? 'Getting Started' : 'Not Started';
  const streakEmoji = streak.current >= 30 ? '👑' : streak.current >= 14 ? '🔥🔥' : streak.current >= 7 ? '🔥' : streak.current >= 3 ? '⭐' : streak.current >= 1 ? '✨' : '💤';

  // ─── Render: Stage Map ────────────────────────────────────────
  if (currentScreen === 'stages') {
    return (
      <div className="min-h-screen bg-stone-50 pb-24">
        <Header />
        <PageHero compact title="Career Games" subtitle="Complete stages to unlock new challenges" images={HERO_CAROUSELS.games} imageAlt="Career games" overlay="dark" />

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {/* Streak Bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                  streak.current > 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {streak.current > 0 ? streakEmoji : '💤'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{streak.current}</span>
                    <span className="text-xs text-amber-600 font-medium uppercase tracking-wider">{streakLevel}</span>
                  </div>
                  <p className="text-xs text-gray-500">day streak · Best: {streak.best} · {streak.points.toLocaleString()} pts</p>
                </div>
              </div>
            </div>
            <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((streak.current / 30) * 100, 100)}%` }} />
            </div>
          </div>

          {/* Music Toggle & Stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Brain className="w-4 h-4" />
              <span>{completedStages.length}/10 stages</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSettings(true)}
                className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                title="Audio settings">
                <Settings className="w-5 h-5" />
              </button>
              <button onClick={() => setMusicOn(!musicOn)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                  musicOn ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>
                {musicOn ? <Music className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                {musicOn ? 'Music On' : 'Music Off'}
              </button>
            </div>
          </div>

          {/* Stage List */}
          <div className="space-y-3">
            {stages.map(stage => (
              <div key={stage.id}
                className={`rounded-xl border p-4 transition ${
                  stage.completed
                    ? 'bg-emerald-50 border-emerald-200'
                    : stage.unlocked
                      ? 'bg-white border-gray-200 cursor-pointer hover:shadow-md'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
                onClick={() => {
                  if (!stage.unlocked || stage.completed) return;
                  if (stage.type === 'memory') startMemoryStage(stage.id);
                  else startQuizStage(stage.id);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                      stage.completed
                        ? 'bg-emerald-100 text-emerald-600'
                        : stage.unlocked
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-400'
                    }`}>
                      {stage.completed ? '✅' : stage.unlocked ? stage.id.toString() : '🔒'}
                    </div>
                    <div>
                      <p className={`font-semibold ${stage.completed ? 'text-emerald-800' : 'text-gray-900'}`}>
                        Stage {stage.id}: {stage.name}
                      </p>
                      <p className="text-xs text-gray-500">{stage.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {stage.completed ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : stage.unlocked ? (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    ) : (
                      <Lock className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowSettings(false)} />
            <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Audio Settings</h3>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Music className={`w-5 h-5 ${musicOn ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium text-gray-700">Background Music</span>
                  </div>
                  <button onClick={() => setMusicOn(!musicOn)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${musicOn ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${musicOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {musicOn && (
                  <div>
                    <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">Music Volume <span>{musicVol}%</span></label>
                    <input type="range" min="0" max="100" value={musicVol} onChange={e => updateMusicVol(+e.target.value)}
                      className="w-full accent-blue-700" />
                  </div>
                )}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Zap className={`w-5 h-5 ${sfxOn ? 'text-amber-500' : 'text-gray-400'}`} />
                      <span className="text-sm font-medium text-gray-700">Sound Effects</span>
                    </div>
                    <button onClick={toggleSfx}
                      className={`relative w-11 h-6 rounded-full transition-colors ${sfxOn ? 'bg-blue-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${sfxOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {sfxOn && (
                    <div>
                      <label className="flex justify-between text-sm font-medium text-gray-700 mb-2">SFX Volume <span>{sfxVol}%</span></label>
                      <input type="range" min="0" max="100" value={sfxVol} onChange={e => updateSfxVol(+e.target.value)}
                        className="w-full accent-blue-700" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <BottomNav />
      </div>
    );
  }

  // ─── Render: Memory Game ──────────────────────────────────────
  if (currentScreen === 'memory') {
    return (
      <div className="min-h-screen bg-stone-50 pb-24">
        <Header />
        <PageHero compact title={`Stage ${currentStage}: ${STAGES[currentStage - 1]?.name || 'Memory Match'}`} subtitle="Match the pairs to advance" images={HERO_CAROUSELS.games} imageAlt="Memory match game" overlay="dark" />

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {/* Back to Stages */}
          <button onClick={() => setCurrentScreen('stages')}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Stages
          </button>

          {/* Game Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Time', value: formatTime(timer), icon: Clock, color: 'from-cyan-500 to-blue-600' },
              { label: 'Moves', value: moves.toString(), icon: Zap, color: 'from-violet-500 to-purple-600' },
              { label: 'Matched', value: `${matchedCount}/${memoryCardSet.current.length}`, icon: CheckCircle, color: 'from-emerald-500 to-green-600' },
              { label: 'Best', value: bestScore < 999 ? `${bestScore}` : '—', icon: Trophy, color: 'from-amber-500 to-orange-600' },
            ].map(s => (
              <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-xl p-3 text-center`}>
                <s.icon className="w-4 h-4 mx-auto mb-1 text-white/80" />
                <p className="text-lg font-bold text-white">{s.value}</p>
                <p className="text-[10px] text-white/70">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Game Board */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            {showResult && gameComplete && (
              <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl text-center">
                <div className="text-3xl mb-1">🎉</div>
                <h3 className="text-lg font-bold text-gray-900">Stage 1 Complete!</h3>
                <p className="text-sm text-amber-700">
                  Solved in {formatTime(timer)} · {moves} moves · +10 pts
                </p>
                <button onClick={completeMemoryStage}
                  className="mt-3 px-6 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 transition-all">
                  Continue to Stage {currentStage + 1}
                </button>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {cards.map(card => (
                <button key={card.id} onClick={() => handleCardClick(card.id)}
                  disabled={card.flipped || card.matched || gameComplete}
                  className={`aspect-square rounded-xl text-2xl sm:text-3xl flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    card.matched
                      ? 'bg-emerald-50 border border-emerald-300 scale-95 opacity-70'
                      : card.flipped
                        ? 'bg-white border-2 border-blue-400 shadow-md scale-100'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 hover:shadow-md text-gray-400'
                  }`}
                >
                  {(card.flipped || card.matched) ? card.emoji : '?'}
                </button>
              ))}
            </div>
          </div>

          <button onClick={resetMemoryGame}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all">
            <RotateCcw className="w-4 h-4" /> Restart
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ─── Render: Quiz Game ────────────────────────────────────────
  if (currentScreen === 'quiz') {
    const question = quizQuestions[quizIndex];
    const passThreshold = Math.ceil(quizQuestions.length * 0.6);
    const progress = ((quizIndex) / quizQuestions.length) * 100;

    return (
      <div className="min-h-screen bg-stone-50 pb-24">
        <Header />
        <PageHero compact title={`Stage ${currentStage}: ${STAGES[currentStage - 1].name}`}
          subtitle="Answer the questions correctly to pass" images={HERO_CAROUSELS.games} imageAlt="Quiz game" overlay="dark" />

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <button onClick={() => setCurrentScreen('stages')}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Stages
          </button>

          {!quizFinished ? (
            <>
              {/* Progress & Timer */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Question {quizIndex + 1} of {quizQuestions.length}</span>
                  <span className="text-sm text-gray-500">Score: {score}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                {/* Timer Bar */}
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${timeLeft <= 3 ? 'text-red-500' : 'text-gray-400'}`} />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${
                      timeLeft <= 3 ? 'bg-red-500' : timeLeft <= 6 ? 'bg-amber-500' : 'bg-blue-500'
                    }`} style={{ width: `${(timeLeft / getTimeLimit(currentStage)) * 100}%` }} />
                  </div>
                  <span className={`text-xs font-bold ${timeLeft <= 3 ? 'text-red-500' : 'text-gray-500'}`}>
                    {timeLeft}s
                  </span>
                </div>
              </div>

              {/* Question */}
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-6">{question.question}</h3>
                {timedOut && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                    <span className="text-sm font-semibold text-red-700">Time's up! {hasPenalty(currentStage) ? '-1 point' : 'No points'}</span>
                  </div>
                )}
                <div className="space-y-3">
                  {question.options.map((opt, i) => {
                    let btnClass = 'border-gray-200 hover:bg-gray-50 text-gray-900';
                    if (showAnswer) {
                      if (i === question.correct) btnClass = 'border-emerald-400 bg-emerald-50 text-emerald-800';
                      else if (i === selectedAnswer) btnClass = 'border-red-400 bg-red-50 text-red-800';
                      else btnClass = 'border-gray-200 opacity-60';
                    } else if (selectedAnswer === i) {
                      btnClass = 'border-blue-400 bg-blue-50';
                    }
                    return (
                      <button key={i} onClick={() => handleAnswer(i)}
                        disabled={showAnswer}
                        className={`w-full text-left p-4 rounded-xl border transition ${btnClass}`}>
                        <span className="text-sm font-medium">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {showAnswer && (
                  <button onClick={nextQuizQuestion}
                    className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition">
                    {quizIndex < quizQuestions.length - 1 ? 'Next Question' : 'See Results'}
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Quiz Results */
            <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
              <div className="text-5xl mb-4">{quizPassed ? '🎉' : '😅'}</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {quizPassed ? 'Stage Passed!' : 'Not Quite'}
              </h3>
              <p className="text-gray-600 mb-2">
                You scored {score}/{quizQuestions.length}
                {quizPassed ? ' — well done!' : ` — need ${passThreshold}/${quizQuestions.length} to pass.`}
              </p>
              {hasPenalty(currentStage) && <p className="text-xs text-red-500 mb-2">Wrong answers lose points</p>}
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-6">
                <div className={`h-full rounded-full transition-all duration-500 ${
                  quizPassed ? 'bg-emerald-500' : 'bg-red-400'
                }`} style={{ width: `${(score / quizQuestions.length) * 100}%` }} />
              </div>
              <div className="flex gap-3">
                {!quizPassed && (
                  <button onClick={() => startQuizStage(currentStage)}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition">
                    Try Again
                  </button>
                )}
                <button onClick={() => setCurrentScreen('stages')}
                  className={`flex-1 py-3 rounded-xl font-semibold transition ${
                    quizPassed
                      ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                  {quizPassed ? 'Next Stage' : 'Back to Stages'}
                </button>
              </div>
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  return null;
}
