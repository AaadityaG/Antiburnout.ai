import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { login as loginAction, logout as logoutAction } from './store/authSlice'
import { fetchSettings, updateSettings, clearSettings } from './store/settingsSlice'
import type { RootState, AppDispatch } from './store'
import ProfileOverlay from './components/ProfileOverlay'
import LoginModal from './components/LoginModal'

function App() {
  const dispatch = useDispatch<AppDispatch>()
  const { isAuthenticated, token } = useSelector((state: RootState) => state.auth)
  const settings = useSelector((state: RootState) => state.settings)

  const [timeRemaining, setTimeRemaining] = useState(settings.breakInterval * 60 * 1000)
  const [isPaused, setIsPaused] = useState(false)
  const [isBreakActive, setIsBreakActive] = useState(false)
  const [breakTimeLeft, setBreakTimeLeft] = useState(settings.breakDuration)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isInsightsOpen, setIsInsightsOpen] = useState(false)

  // Local state for settings inputs
  const [localInterval, setLocalInterval] = useState(settings.breakInterval)
  const [localDuration, setLocalDuration] = useState(settings.breakDuration)

  // Fetch user settings when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      dispatch(fetchSettings(token))
    }
  }, [isAuthenticated, token, dispatch])

  // Sync timer when settings change
  useEffect(() => {
    setTimeRemaining(settings.breakInterval * 60 * 1000)
    setBreakTimeLeft(settings.breakDuration)
    setLocalInterval(settings.breakInterval)
    setLocalDuration(settings.breakDuration)
  }, [settings])

  const handleApplySettings = useCallback(() => {
    dispatch(updateSettings({ 
      token: token || '', 
      settings: { 
        break_interval: localInterval,
        break_duration: localDuration 
      } 
    }))
    // Also notify Electron if needed
    window.electronAPI?.sendUpdateTimerSetting({
      interval: localInterval,
      duration: localDuration,
      autoStart: true
    })
    setIsSettingsOpen(false)
  }, [token, localInterval, localDuration, dispatch])

  // Format time as MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Timer logic and IPC listeners
  useEffect(() => {
    if (!window.electronAPI) return

    const cleanupTimerUpdate = window.electronAPI.onTimerUpdate((time) => setTimeRemaining(time))
    const cleanupTimerReset = window.electronAPI.onTimerReset(() => {
      setTimeRemaining(settings.breakInterval * 60 * 1000)
      setIsPaused(false)
    })
    const cleanupBreakTime = window.electronAPI.onBreakTime((data) => {
      if (data.duration) setBreakTimeLeft(data.duration)
      setIsBreakActive(true)
    })
    const cleanupSettingsUpdated = window.electronAPI.onSettingsUpdated((data) => {
      setTimeRemaining(data.interval * 60 * 1000)
    })

    return () => {
      cleanupTimerUpdate()
      cleanupTimerReset()
      cleanupBreakTime()
      cleanupSettingsUpdated()
    }
  }, [settings])

  // Break timer countdown
  useEffect(() => {
    let interval: any = null
    if (isBreakActive && breakTimeLeft > 0) {
      interval = setInterval(() => {
        setBreakTimeLeft(prev => {
          if (prev <= 1) {
            setIsBreakActive(false)
            window.electronAPI?.sendTimerBreakComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isBreakActive, breakTimeLeft])

  const togglePause = useCallback(() => {
    if (isPaused) window.electronAPI?.sendResumeTimer()
    else window.electronAPI?.sendPauseTimer()
    setIsPaused(!isPaused)
  }, [isPaused])

  const resetTimer = useCallback(() => {
    window.electronAPI?.sendResetTimer()
    setIsPaused(false)
  }, [])

  const progress = ((settings.breakInterval * 60 * 1000 - timeRemaining) / (settings.breakInterval * 60 * 1000)) * 100
  const circumference = 2 * Math.PI * 270

  return (
    <div className="relative w-screen h-screen flex flex-col justify-center items-center text-center overflow-hidden font-sans">
      {/* Background Image Container */}
      <div 
        className="fixed inset-0 z-[-2] transition-transform duration-[10000ms] scale-105 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: "url('nature_bg.png')",
          backgroundColor: "#0c140c" 
        }}
      ></div>
      {/* Ambient Overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-transparent to-black/60 z-[-1]"></div>

      {/* Draggable Area */}
      <div className="fixed top-0 left-0 right-0 h-20 drag-area z-50"></div>

      {/* Window Controls */}
      <div className="fixed top-8 right-8 flex gap-3 z-[100] drag-none">
        <button onClick={() => window.electronAPI?.sendMinimizeToTray()} className="w-10 h-10 rounded-xl bg-glass glass-blur border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all duration-300">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
        </button>
      </div>

      {/* Main UI */}
      <main className={`relative flex flex-col mt-40 items-center justify-center transition-all duration-1000 ${isBreakActive ? 'scale-110 blur-xl opacity-0' : 'scale-100 opacity-100'}`}>
        <div className="relative mb-8 animate-breathe">
          <h1 className="font-mono text-[10rem] font-extralight leading-none tracking-tighter bg-gradient-to-b from-white to-accent bg-clip-text text-transparent drop-shadow-2xl">
            {formatTime(timeRemaining)}
          </h1>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] z-[-1] -rotate-90">
            <svg viewBox="0 0 600 600" className="w-full h-full">
              <circle cx="300" cy="300" r="270" className="fill-none stroke-white/5 stroke-[4]" />
              <circle cx="300" cy="300" r="270" 
                className="fill-none stroke-accent stroke-[4] transition-[stroke-dashoffset] duration-1000 ease-linear drop-shadow-[0_0_12px_var(--color-accent)]"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (progress / 100) * circumference}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        <div className="flex items-center gap-3 p-6  bg-glass glass-blur border border-white/10 rounded-full text-xs font-bold uppercase tracking-[0.2em] text-accent">
          <span className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${isPaused ? 'bg-yellow-400 shadow-yellow-400' : 'bg-green-400 shadow-green-400 animate-pulse'}`}></span>
          {isPaused ? 'Paused' : 'Next break in...'}
        </div>

        <div className="mt-40 flex gap-4 items-center">
          <button onClick={resetTimer} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-all duration-300">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          
          <button onClick={togglePause}  className="w-42 px-5 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-all duration-300">
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <button onClick={() => setIsSettingsOpen(true)} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-all duration-300">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>

          <button onClick={() => setIsProfileOpen(true)} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-all duration-300">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </button>

          <button onClick={() => setIsInsightsOpen(true)} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-all duration-300">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          </button>
        </div>
      </main>

      {/* Settings Overlay */}
      <div className={`fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4 transition-all duration-500 ${isSettingsOpen ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-105'}`}>
        <div className="w-full max-w-[500px] bg-glass-heavy border border-white/10 rounded-[32px] p-10 shadow-2xl">
          <h2 className="text-4xl font-extralight text-white text-center mb-10">Settings</h2>
          
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-green-200/50">Break Interval (Minutes)</label>
              <input 
                type="number" 
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white text-lg focus:outline-none focus:border-accent"
                value={localInterval}
                onChange={(e) => setLocalInterval(parseInt(e.target.value))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-green-200/50">Rest Duration (Seconds)</label>
              <input 
                type="number" 
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white text-lg focus:outline-none focus:border-accent"
                value={localDuration}
                onChange={(e) => setLocalDuration(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-10">
            <button className="flex-1 h-14 bg-white text-bg-dark font-bold rounded-2xl hover:bg-accent transition-all" onClick={handleApplySettings}>Apply</button>
            <button className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl text-white flex items-center justify-center" onClick={() => setIsSettingsOpen(false)}>✕</button>
          </div>
        </div>
      </div>

      {/* Insights Overlay */}
      <div className={`fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4 transition-all duration-500 ${isInsightsOpen ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-105'}`}>
        <div className="w-full max-w-[500px] bg-glass-heavy border border-white/10 rounded-[32px] p-10 shadow-2xl text-center">
          <h2 className="text-4xl font-extralight text-white mb-6">Insights</h2>
          <div className="text-6xl mb-6">📊</div>
          <p className="text-green-200/50 mb-10 text-lg">Coming Soon...<br/>Track your break history and eye health stats here.</p>
          <button className="w-full h-14 bg-white text-bg-dark font-bold rounded-2xl hover:bg-accent transition-all" onClick={() => setIsInsightsOpen(false)}>Close</button>
        </div>
      </div>

      {/* Break View */}
      <div className={`fixed inset-0 bg-bg-dark z-[1000] flex justify-center items-center transition-opacity duration-1000 ${isBreakActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="text-center animate-in zoom-in-95 duration-1000">
          <div className="text-8xl mb-8 drop-shadow-[0_0_20px_var(--color-accent)]">🌿</div>
          <h2 className="text-6xl font-extralight mb-6 text-accent tracking-tight">Time to Rest</h2>
          <div className="font-mono text-[10rem] font-extralight my-10 text-white leading-none tracking-tighter">
            {breakTimeLeft}
          </div>
          <p className="text-green-200/40 tracking-[0.3em] uppercase text-xs">Focus on the horizon • Blink often</p>
        </div>
      </div>

      <ProfileOverlay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      {!isAuthenticated && <LoginModal isOpen={true} onClose={() => {}} />}
    </div>
  )
}

export default App
