import { useState, useEffect, useCallback, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchSettings, updateSettings, clearSettings } from './store/settingsSlice'
import { fetchTipRecommendation, clearTip } from './store/tipSlice'
import { saveSession } from './store/activitySlice'
import type { RootState, AppDispatch } from './store'
import ProfileOverlay from './components/ProfileOverlay'
import LoginModal from './components/LoginModal'
import SettingsOverlay from './components/SettingsOverlay'
import InsightsOverlay from './components/InsightsOverlay'
import BreakView from './components/BreakView'
import ChatOverlay from './components/ChatOverlay'
import MusicOverlay from './components/MusicOverlay'

function App() {
  const dispatch = useDispatch<AppDispatch>()
  const { isAuthenticated, token } = useSelector((state: RootState) => state.auth)
  const settings = useSelector((state: RootState) => state.settings)

  const [timeRemaining, setTimeRemaining] = useState(1800 * 1000) // Will be updated when settings load
  const [isPaused, setIsPaused] = useState(false)
  const [isBreakActive, setIsBreakActive] = useState(false)
  const [breakTimeLeft, setBreakTimeLeft] = useState(90) // Will be updated when settings load
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isInsightsOpen, setIsInsightsOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isMusicOpen, setIsMusicOpen] = useState(false)

  // Fetch user settings when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      console.log('Fetching settings from backend...')
      dispatch(fetchSettings(token))
    }
  }, [isAuthenticated, token, dispatch])

  // Handle logout - reset everything
  useEffect(() => {
    if (!isAuthenticated) {
      // User logged out - reset all states
      dispatch(clearSettings())
      dispatch(clearTip())
      setTimeRemaining(1800 * 1000)  // Reset to default (30 minutes)
      setBreakTimeLeft(90)  // Reset to default (1 minute 30 seconds)
      setIsPaused(false)
      setIsBreakActive(false)
      hasInitializedTimer.current = false  // Allow re-initialization on next login
      
      // Stop Electron timer
      window.electronAPI?.sendResetTimer()
      
      console.log('Logout complete - all states reset')
    }
  }, [isAuthenticated, dispatch])

  // Sync timer ONLY after settings are actually fetched from backend
  const hasInitializedTimer = useRef(false)
  
  useEffect(() => {
    // Only initialize timer after settings fetch completes
    if (isAuthenticated && token && !hasInitializedTimer.current && settings.fetched && settings.breakInterval > 0) {
      console.log('Applying backend settings to timer:', settings.breakInterval, 'seconds')
      setTimeRemaining(settings.breakInterval * 1000) // Convert seconds to ms
      setBreakTimeLeft(settings.breakDuration)
      hasInitializedTimer.current = true
      
      // Send settings to Electron to start the timer with backend values
      window.electronAPI?.sendUpdateTimerSetting({
        interval: settings.breakInterval,
        duration: settings.breakDuration,
        autoStart: settings.autoStart
      })
    }
  }, [isAuthenticated, token, settings.breakInterval, settings.breakDuration, settings.autoStart, settings.fetched])

  const handleApplySettings = useCallback((interval: number, duration: number, soundEnabled: boolean) => {
    console.log('App.tsx - handleApplySettings called with:', { interval, duration, soundEnabled })
    
    // Immediately notify Electron with new settings
    window.electronAPI?.sendUpdateTimerSetting({
      interval,   // seconds
      duration,   // seconds
      autoStart: true,
      enableSound: soundEnabled
    })
    
    // Also update backend if authenticated
    if (token) {
      console.log('App.tsx - Dispatching updateSettings to backend')
      dispatch(updateSettings({
        token: token, 
        settings: { 
          break_interval: interval,   // Already in seconds
          break_duration: duration,   // Already in seconds
          auto_start: true,
          enable_sound: soundEnabled
        }
      }))
    }
  }, [token, dispatch])

  // Format time as HH:MM:SS or MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

// Track if session was completed naturally (timer reached 0)
  const sessionCompletedRef = useRef(false)
  const sessionStartTimeRef = useRef<number>(0)

  // Timer logic and IPC listeners
  useEffect(() => {
    if (!window.electronAPI) return

    const cleanupTimerUpdate = window.electronAPI.onTimerUpdate((time) => setTimeRemaining(time))
    const cleanupTimerReset = window.electronAPI.onTimerReset(() => {
      const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
      if (!sessionCompletedRef.current && token && elapsed > 10) {
        dispatch(saveSession({
          token,
          sessionDuration: elapsed,
          targetDuration: settings.breakInterval,
          completed: false,
          skipped: true
        }))
      }
      sessionCompletedRef.current = false
      setTimeRemaining(settings.breakInterval * 1000)
      setIsPaused(false)
    })
    const cleanupBreakTime = window.electronAPI.onBreakTime((data) => {
      sessionCompletedRef.current = true
      sessionStartTimeRef.current = Date.now()
      if (data.duration) setBreakTimeLeft(data.duration)
      setIsBreakActive(true)
    })
    const cleanupSettingsUpdated = window.electronAPI.onSettingsUpdated((data) => {
      setTimeRemaining(data.interval * 1000)
    })

    return () => {
      cleanupTimerUpdate()
      cleanupTimerReset()
      cleanupBreakTime()
      cleanupSettingsUpdated()
    }
  }, [settings, token, dispatch])

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

  // Fetch tip recommendation 5 seconds before break starts (when work timer hits 5s)
  const hasFetchedTip = useRef(false)
  useEffect(() => {
    // When work timer reaches 5 seconds (5000ms), fetch tip for upcoming break
    if (!isBreakActive && timeRemaining > 0 && timeRemaining <= 5000 && token && !hasFetchedTip.current) {
      console.log('Fetching tip recommendation for upcoming break...')
      dispatch(fetchTipRecommendation(token))
      hasFetchedTip.current = true
    }
    
    // Reset flag when break ends or timer is reset
    if (isBreakActive === false && timeRemaining > 5000) {
      hasFetchedTip.current = false
    }
    
    // Clear tip when break ends
    if (!isBreakActive && timeRemaining === settings.breakInterval * 1000) {
      dispatch(clearTip())
    }
  }, [isBreakActive, timeRemaining, token, dispatch, settings.breakInterval])

  const togglePause = useCallback(() => {
    if (isPaused) window.electronAPI?.sendResumeTimer()
    else window.electronAPI?.sendPauseTimer()
    setIsPaused(!isPaused)
  }, [isPaused])

  const resetTimer = useCallback(() => {
    window.electronAPI?.sendResetTimer()
    setIsPaused(false)
  }, [])

  const handleEndBreak = useCallback(() => {
    if (token) {
      const elapsedSeconds = Math.floor((settings.breakInterval * 1000 - timeRemaining) / 1000)
      dispatch(saveSession({
        token,
        sessionDuration: elapsedSeconds,
        targetDuration: settings.breakInterval,
        completed: true,
        skipped: false
      }))
    }
    setIsBreakActive(false)
    window.electronAPI?.sendResetTimer()
    window.electronAPI?.sendMinimizeToTray()
  }, [token, timeRemaining, settings.breakInterval, dispatch])

  const progress = ((settings.breakInterval * 1000 - timeRemaining) / (settings.breakInterval * 1000)) * 100
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
        <button onClick={() => window.electronAPI?.sendMinimizeToTray()} className="w-10 h-10 rounded-xl bg-glass glass-blur border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all duration-300 cursor-pointer">
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
          <button onClick={resetTimer} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 active:scale-90 transition-all duration-150 cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          
          <button onClick={togglePause}  className="w-42 px-5 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 active:scale-90 transition-all duration-150 cursor-pointer">
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <button onClick={() => setIsSettingsOpen(true)} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 active:scale-90 transition-all duration-150 cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>

          <button onClick={() => setIsProfileOpen(true)} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 active:scale-90 transition-all duration-150 cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </button>

          <button onClick={() => setIsInsightsOpen(true)} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 active:scale-90 transition-all duration-150 cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          </button>

          <button onClick={() => setIsMusicOpen(true)} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 active:scale-90 transition-all duration-150 cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </button>

          <button onClick={() => setIsChatOpen(true)} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 active:scale-90 transition-all duration-150 cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
      </main>

      {/* Settings Overlay */}
      <SettingsOverlay
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialInterval={settings.breakInterval}
        initialDuration={settings.breakDuration}
        enableSound={settings.enableSound}
        onApply={handleApplySettings}
      />

      {/* Insights Overlay */}
      <InsightsOverlay
        isOpen={isInsightsOpen}
        onClose={() => setIsInsightsOpen(false)}
      />

      {/* Break View */}
      <BreakView
        isActive={isBreakActive}
        timeLeft={breakTimeLeft}
        onEnd={handleEndBreak}
        enableSound={settings.enableSound}
      />

      <ChatOverlay isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <MusicOverlay isOpen={isMusicOpen} onClose={() => setIsMusicOpen(false)} />
      <ProfileOverlay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      {!isAuthenticated && <LoginModal isOpen={true} onClose={() => {}} />}
    </div>
  )
}

export default App
