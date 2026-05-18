import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'

interface BreakViewProps {
  isActive: boolean
  timeLeft: number
  onEnd: () => void
  enableSound: boolean
}

function BreakView({ isActive, timeLeft, onEnd, enableSound }: BreakViewProps) {
  const { currentTip, isLoading } = useSelector((state: RootState) => state.tips)
  const [isPaused, setIsPaused] = useState(false)
  const [countdown, setCountdown] = useState(timeLeft)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const hasPlayedSound = useRef(false)
  const hasEnded = useRef(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastClickTime = useRef(0)

  useEffect(() => {
    setCountdown(timeLeft)
    setIsPaused(false)
    hasPlayedSound.current = false
    hasEnded.current = false
    // Initialize audio
    audioRef.current = new Audio('/tone/1sec-tone.wav')
  }, [isActive, timeLeft])

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Start new interval if active and not paused
    if (isActive && !isPaused) {
      intervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
            if (!hasEnded.current) {
              hasEnded.current = true
              onEnd()
            }
            return 0
          }
          
          // Play sound at last second
          if (prev === 2 && enableSound && !hasPlayedSound.current && audioRef.current) {
            hasPlayedSound.current = true
            audioRef.current.currentTime = 0
            audioRef.current.play().catch(err => console.log('Audio play failed:', err))
          }
          
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isActive, isPaused, onEnd, enableSound])

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

  const getCategoryBg = (category: string): string => {
    const colors: Record<string, string> = {
      eyes: 'bg-blue-500/10 border-blue-400/20',
      stress: 'bg-purple-500/10 border-purple-400/20',
      posture: 'bg-orange-500/10 border-orange-400/20',
      mindfulness: 'bg-cyan-500/10 border-cyan-400/20',
      hydration: 'bg-blue-400/10 border-blue-300/20',
      movement: 'bg-green-500/10 border-green-400/20'
    }
    return colors[category] || 'bg-accent/10 border-accent/20'
  }

  const getCategoryTextColor = (category: string): string => {
    const colors: Record<string, string> = {
      eyes: 'text-blue-300',
      stress: 'text-purple-300',
      posture: 'text-orange-300',
      mindfulness: 'text-cyan-300',
      hydration: 'text-blue-200',
      movement: 'text-green-300'
    }
    return colors[category] || 'text-accent'
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

  if (!isActive) return null

  const progress = currentTip?.duration ? Math.round((countdown / parseInt(currentTip.duration)) * 100) : 100

  return (
    <div className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex justify-center items-center p-4">
      <div className="w-full max-w-[600px] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden bg-glass glass-blur">
        {/* Header */}
        <div className="px-8 pt-8 pb-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
              <span className="text-xl">🌿</span>
            </div>
            <div>
              <h2 className="text-xl font-extralight text-white tracking-tight">Break Time</h2>
              <p className="text-[10px] text-green-200/40 mt-0.5">Rest your eyes and relax</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-400 animate-pulse' : 'bg-green-400 animate-pulse'}`} />
            <span className="font-mono text-lg font-light text-accent">{formatTime(countdown)}</span>
          </div>
        </div>

        {/* Tip Content */}
        <div className="px-8 py-8 min-h-[280px] flex flex-col items-center justify-center">
          {isLoading && !currentTip ? (
            <div className="text-center text-white/40">
              <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm">Preparing your wellness tip...</p>
            </div>
          ) : currentTip ? (
            <div className="w-full">
              {/* Progress bar */}
              <div className="w-full h-1 bg-white/5 rounded-full mb-6">
                <div
                  className="h-full bg-accent/40 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                />
              </div>

              <div className={`p-6 rounded-2xl border ${getCategoryBg(currentTip.category)}`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{getCategoryIcon(currentTip.category)}</span>
                  <span className={`text-xs font-bold uppercase tracking-[0.2em] ${getCategoryTextColor(currentTip.category)}`}>
                    {currentTip.category}
                  </span>
                  <span className="text-white/30 mx-1">•</span>
                  <span className="text-xs text-white/50">{currentTip.duration}</span>
                </div>

                <h3 className="text-lg font-light text-white mb-3 leading-snug">{currentTip.tip}</h3>
                <p className="text-sm text-green-200/70 leading-relaxed">{currentTip.instruction}</p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
                <span className="text-3xl">🌿</span>
              </div>
              <p className="text-sm text-white/40">Take a moment to breathe and relax</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="px-8 py-6 border-t border-white/5 flex items-center justify-between">
          <button
            className="h-12 rounded-full bg-glass glass-blur border border-white/20 text-white font-medium px-6 hover:bg-accent hover:text-primary cursor-pointer flex items-center gap-2"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const now = Date.now()
              if (now - lastClickTime.current < 300) return // Debounce 300ms
              lastClickTime.current = now
              setIsPaused(p => !p)
            }}
          >
            {isPaused ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Resume
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                </svg>
                Pause
              </>
            )}
          </button>
          <button
            className="h-12 rounded-full bg-glass glass-blur border border-white/20 text-white font-medium px-8 hover:bg-accent hover:text-primary cursor-pointer"
            onClick={onEnd}
          >
            I'm Refreshed
          </button>
        </div>
      </div>
    </div>
  )
}

export default BreakView
