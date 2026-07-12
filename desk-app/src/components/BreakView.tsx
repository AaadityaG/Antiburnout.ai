import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'

interface BreakViewProps {
  isActive: boolean
  timeLeft: number
  isPaused: boolean
  onPause: () => void
  onResume: () => void
  onEnd: () => void
  enableSound: boolean
}

function BreakView({ isActive, timeLeft, isPaused, onPause, onResume, onEnd, enableSound }: BreakViewProps) {
  const { currentTip, isLoading } = useSelector((state: RootState) => state.tips)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasPlayedSound = useRef(false)
  const lastTimeLeftRef = useRef(timeLeft)
  const lastClickTime = useRef(0)

  useEffect(() => {
    hasPlayedSound.current = false
    // Initialize audio
    audioRef.current = new Audio('/tone/1sec-tone.wav')
  }, [isActive])

  // Play sound when countdown reaches 2 seconds
  useEffect(() => {
    if (timeLeft === 2 && enableSound && !hasPlayedSound.current && audioRef.current && !isPaused) {
      hasPlayedSound.current = true
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(err => console.log('Audio play failed:', err))
    }

    // Track timeLeft changes
    lastTimeLeftRef.current = timeLeft
  }, [timeLeft, enableSound, isPaused])

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      eyes: '👁️',
      stress: '🧘',
      posture: '🧍',
      mindfulness: '🧠',
      hydration: '💧',
      movement: '🚶'
    }
    return icons[category] || '💡'
  }

  const getCategoryAccent = (category: string): { bg: string; border: string; text: string; glow: string } => {
    const colors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
      eyes: { bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.15)', text: '#93c5fd', glow: 'rgba(96,165,250,0.2)' },
      stress: { bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.15)', text: '#c4b5fd', glow: 'rgba(192,132,252,0.2)' },
      posture: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.15)', text: '#fcd34d', glow: 'rgba(251,191,36,0.2)' },
      mindfulness: { bg: 'rgba(103,232,249,0.08)', border: 'rgba(103,232,249,0.15)', text: '#a5f3fc', glow: 'rgba(103,232,249,0.2)' },
      hydration: { bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.15)', text: '#7dd3fc', glow: 'rgba(56,189,248,0.2)' },
      movement: { bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.15)', text: '#86efac', glow: 'rgba(74,222,128,0.2)' }
    }
    return colors[category] || { bg: 'rgba(212,252,212,0.08)', border: 'rgba(212,252,212,0.15)', text: '#d4fcd4', glow: 'rgba(212,252,212,0.2)' }
  }

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60

    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Generate stable floating particles
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 8,
      opacity: 0.15 + Math.random() * 0.25,
    }))
  }, [])

  const totalDuration = currentTip?.duration ? parseInt(currentTip.duration) : 90
  const progress = Math.round((timeLeft / totalDuration) * 100)
  const circumference = 2 * Math.PI * 240
  const tipAccent = currentTip ? getCategoryAccent(currentTip.category) : null

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="break-view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, #0a2820 0%, #081a14 35%, #06120e 60%, #040d0a 100%)',
          }}
        >
      {/* CSS Animations */}
      <style>{`
        @keyframes breakBreathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.02); opacity: 0.95; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes glowPulseOuter {
          0%, 100% { opacity: 0.15; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.35; transform: translate(-50%, -50%) scale(1.12); }
        }
        @keyframes particleFloat {
          0% { transform: translateY(0px) translateX(0px); opacity: 0; }
          15% { opacity: var(--particle-opacity); }
          85% { opacity: var(--particle-opacity); }
          100% { transform: translateY(-80px) translateX(20px); opacity: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes subtleShimmer {
          0%, 100% { background-position: 200% center; }
          50% { background-position: -200% center; }
        }
        .break-breathe {
          animation: breakBreathe 6s infinite ease-in-out;
        }
        .break-fade-in {
          animation: fadeInUp 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .break-fade-in-delay {
          animation: fadeInUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards;
          opacity: 0;
        }
        .break-fade-in-delay-2 {
          animation: fadeInUp 1s cubic-bezier(0.22, 1, 0.36, 1) 0.6s forwards;
          opacity: 0;
        }
      `}</style>

      {/* Ambient floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              background: 'radial-gradient(circle, rgba(212,252,212,0.6) 0%, rgba(212,252,212,0) 70%)',
              animation: `particleFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
              '--particle-opacity': p.opacity,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Soft ambient light orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600,
          height: 600,
          left: '50%',
          top: '40%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(45,90,39,0.15) 0%, transparent 70%)',
          animation: 'glowPulseOuter 8s infinite ease-in-out',
        }}
      />

      {/* Top section — greeting */}
      <div className="break-fade-in mb-10 flex flex-col items-center">
        <div className="flex items-center gap-3 px-6 py-3 rounded-full border border-white/8"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}>
          <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400'}`}
            style={{
              boxShadow: isPaused ? '0 0 8px rgba(251,191,36,0.5)' : '0 0 8px rgba(52,211,153,0.5)',
              animation: isPaused ? 'none' : 'glowPulse 3s infinite ease-in-out',
            }}
          />
          <span className="text-[11px] uppercase tracking-[0.25em] font-medium"
            style={{ color: 'rgba(212,252,212,0.5)' }}>
            {isPaused ? 'Paused' : 'Break Time — Breathe & Relax'}
          </span>
        </div>
      </div>

      {/* Main Timer — Grand & Centered */}
      <div className="relative flex items-center justify-center break-fade-in -mt-16">


        {/* Timer text */}
        <div className="break-breathe relative z-10 mt-16 flex flex-col items-center">
          <h1
            className="font-mono font-extralight leading-none tracking-tighter"
            style={{
              fontSize: '9rem',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(212,252,212,0.7) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: 'none',
              filter: 'drop-shadow(0 4px 30px rgba(212,252,212,0.15))',
            }}
          >
            {formatTime(timeLeft)}
          </h1>
          <p className="mt-4 text-sm font-light tracking-wide"
            style={{ color: 'rgba(212,252,212,0.35)' }}>
            {isPaused ? 'Timer paused' : 'Time remaining'}
          </p>
        </div>
      </div>

            {/* Tip Section */}
      <div className="break-fade-in-delay mt-8 w-full max-w-xl px-8">
        {isLoading && !currentTip ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-8 h-8 border-2 rounded-full animate-spin mb-4"
              style={{ 
                borderColor: 'rgba(212,252,212,0.1)', 
                borderTopColor: 'rgba(212,252,212,0.6)' 
              }} />
            <p className="text-xs font-light tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Preparing your wellness tip...
            </p>
          </div>
        ) : currentTip ? (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              background: tipAccent?.bg,
              borderColor: tipAccent?.border,
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Category Header */}
            <div className="px-5 py-4 flex items-center justify-between gap-3"
              style={{ borderBottom: `1px solid ${tipAccent?.border}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${tipAccent?.text}15` }}>
                <span className="text-xl">{getCategoryIcon(currentTip.category)}</span>
              </div>
              <div className="flex gap-1.5 items-center">
                <span className="text-[12px] font-light tracking-wide block "
                  >
                  Wellness activity
                </span>
                
              </div>
              <div className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: tipAccent?.text }} />
            </div>

            {/* Tip Content */}
            <div className="px-5 py-5">
              <h3 className="text-xl font-light text-green-300 mb-3 leading-relaxed">
                {currentTip.tip}
              </h3>
              <div className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" 
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: 'rgba(212,252,212,0.5)' }}>
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4"/>
                  <path d="M12 8h.01"/>
                </svg>
                <p className="text-sm leading-relaxed font-light" style={{ color: 'rgba(212,252,212,0.6)' }}>
                  {currentTip.instruction}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border"
              style={{
                background: 'rgba(212,252,212,0.05)',
                borderColor: 'rgba(212,252,212,0.15)'
              }}>
              <span className="text-3xl">🌿</span>
            </div>
            <p className="text-sm font-light tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Take a moment to breathe and relax
            </p>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="break-fade-in-delay-2 mt-10 flex items-center gap-5">
        <button
          className="h-14 rounded-full px-8 flex items-center gap-3 font-medium transition-all duration-300 cursor-pointer border"
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderColor: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(212,252,212,0.12)'
            e.currentTarget.style.borderColor = 'rgba(212,252,212,0.25)'
            e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const now = Date.now()
            if (now - lastClickTime.current < 300) return
            lastClickTime.current = now

            if (isPaused) {
              onResume()
            } else {
              onPause()
            }
          }}
        >
          {isPaused ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Resume
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
              </svg>
              Pause
            </>
          )}
        </button>

        <button
          className="h-14 rounded-full px-10 flex items-center gap-3 font-semibold transition-all duration-300 cursor-pointer border"
          style={{
            background: 'rgba(212,252,212,0.1)',
            borderColor: 'rgba(212,252,212,0.2)',
            color: '#d4fcd4',
            backdropFilter: 'blur(20px)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(212,252,212,0.9)'
            e.currentTarget.style.color = '#0a2820'
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(212,252,212,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(212,252,212,0.1)'
            e.currentTarget.style.color = '#d4fcd4'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
          onClick={onEnd}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3a9 9 0 1 0 9 9" />
            <path d="M12 7v5l3 3" />
          </svg>
          I'm Refreshed
        </button>
      </div>
    </motion.div>
    )}
    </AnimatePresence>
  )
}

export default BreakView
