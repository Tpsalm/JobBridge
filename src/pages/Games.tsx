import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import PageHero from '../components/PageHero';
import { HERO_CAROUSELS } from '../lib/media';
import { Flame, RotateCcw, Star, Zap, Trophy, Brain, Clock, CheckCircle, Medal, Sparkles, X } from 'lucide-react';

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

const DEFAULT_STREAK: StreakData = { current: 0, best: 0, lastDate: '', points: 0, gamesPlayed: 0 };

// ─── Sound effects (Web Audio API) ──────────────────────────────
let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
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

export default function Games() {
  const [cards, setCards] = useState<MemoryCard[]>(() =>
    shuffle(
      [...CARD_PAIRS, ...CARD_PAIRS].map((pair, i) => ({
        id: i,
        emoji: pair.emoji,
        label: pair.label,
        flipped: false,
        matched: false,
      }))
    )
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

  useEffect(() => {
    if (gameComplete) return;
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [gameComplete]);

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
        if (newMatched === CARD_PAIRS.length) {
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

  const resetGame = () => {
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

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const streakLevel = streak.current >= 30 ? 'Legendary' : streak.current >= 14 ? 'Unstoppable' : streak.current >= 7 ? 'On Fire' : streak.current >= 3 ? 'Rising' : streak.current >= 1 ? 'Getting Started' : 'Not Started';
  const streakEmoji = streak.current >= 30 ? '👑' : streak.current >= 14 ? '🔥🔥' : streak.current >= 7 ? '🔥' : streak.current >= 3 ? '⭐' : streak.current >= 1 ? '✨' : '💤';

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header />
      <PageHero compact title="Career Match" subtitle="Match the pairs, build your streak, sharpen your mind" images={HERO_CAROUSELS.games} imageAlt="Career Match game" overlay="dark" />

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
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
              <Trophy className="w-3.5 h-3.5" />
              Best: {bestScore < 999 ? `${bestScore} moves` : '—'}
            </div>
          </div>
          <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((streak.current / 30) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>0</span>
            <span className={streak.current >= 3 ? 'text-amber-600 font-medium' : ''}>3⭐</span>
            <span className={streak.current >= 7 ? 'text-amber-600 font-medium' : ''}>7🔥</span>
            <span className={streak.current >= 14 ? 'text-amber-600 font-medium' : ''}>14🔥🔥</span>
            <span className={streak.current >= 30 ? 'text-amber-600 font-medium' : ''}>30👑</span>
          </div>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Time', value: formatTime(timer), icon: Clock, color: 'from-cyan-500 to-blue-600' },
            { label: 'Moves', value: moves.toString(), icon: Zap, color: 'from-violet-500 to-purple-600' },
            { label: 'Matched', value: `${matchedCount}/${CARD_PAIRS.length}`, icon: CheckCircle, color: 'from-emerald-500 to-green-600' },
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
              <h3 className="text-lg font-bold text-gray-900">Great Job!</h3>
              <p className="text-sm text-amber-700">
                Solved in {formatTime(timer)} · {moves} moves · +10 pts
              </p>
              {streak.current >= 7 && (
                <div className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <Flame className="w-3 h-3" /> {streak.current}-day streak!
                </div>
              )}
            </div>
          )}

          {/* Streak completion popup */}
          {showStreakPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowStreakPopup(false)}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center relative animate-bounce-in" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowStreakPopup(false)} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl shadow-lg">
                  🏆
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Excellent Job!</h3>
                <p className="text-amber-600 font-semibold text-lg mb-1">You are on a Streak!</p>
                <p className="text-sm text-gray-500 mb-4">
                  {streak.current}-day streak · {streak.points.toLocaleString()} total points
                </p>
                <div className="flex items-center justify-center gap-2 mb-4">
                  {streak.current >= 7 && <span className="text-2xl">🔥</span>}
                  <span className="text-4xl font-bold text-amber-500">{streak.current}</span>
                  <span className="text-sm text-gray-400">days</span>
                </div>
                <button
                  onClick={() => setShowStreakPopup(false)}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all"
                >
                  Keep Going!
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {cards.map(card => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                disabled={card.flipped || card.matched || gameComplete}
                className={`aspect-square rounded-xl text-2xl sm:text-3xl flex items-center justify-center transition-all duration-300 cursor-pointer ${
                  card.matched
                    ? 'bg-emerald-50 border border-emerald-300 scale-95 opacity-70'
                    : card.flipped
                      ? 'bg-white border-2 border-blue-400 shadow-md scale-100'
                      : 'bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 hover:scale-105 text-gray-400'
                }`}
              >
                {(card.flipped || card.matched) ? card.emoji : '?'}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <button
          onClick={resetGame}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all"
        >
          <RotateCcw className="w-4 h-4" /> New Game
        </button>

        {/* Streak Milestones */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Medal className="w-4 h-4 text-amber-500" /> Streak Milestones
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { days: 3, label: 'Rising Star', icon: '⭐', reached: streak.current >= 3 },
              { days: 7, label: 'On Fire!', icon: '🔥', reached: streak.current >= 7 },
              { days: 14, label: 'Unstoppable', icon: '🔥🔥', reached: streak.current >= 14 },
              { days: 30, label: 'Legend', icon: '👑', reached: streak.current >= 30 },
            ].map(m => (
              <div key={m.days} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                m.reached ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'
              }`}>
                <span>{m.reached ? m.icon : '⚪'}</span>
                <span className="font-medium">{m.label}</span>
                <span className="ml-auto text-[10px] opacity-60">{m.days} days</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
