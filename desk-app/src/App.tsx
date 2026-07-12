import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

const API_URL = import.meta.env.VITE_API_URL

interface Video {
  video_id: string
  title: string
  channel: string
  thumbnail: string
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

function App() {
  const dispatch = useDispatch<AppDispatch>()
  const { isAuthenticated, token } = useSelector((state: RootState) => state.auth)
  const settings = useSelector((state: RootState) => state.settings)

  const [timeRemaining, setTimeRemaining] = useState(1800 * 1000)
  const [isPaused, setIsPaused] = useState(false)
  const [isBreakActive, setIsBreakActive] = useState(false)
  const [breakTimeLeft, setBreakTimeLeft] = useState(90)
  const [isBreakPaused, setIsBreakPaused] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isInsightsOpen, setIsInsightsOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isMusicOpen, setIsMusicOpen] = useState(false)

  const [currentTrack, setCurrentTrack] = useState<Video | null>(null)
  const [isMusicPlaying, setIsMusicPlaying] = useState(false)

  const ytPlayerRef = useRef<any>(null)
  const ytReadyRef = useRef(false)
  const ytContainerRef = useRef<HTMLDivElement>(null)

  // Load YouTube IFrame API once
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      ytReadyRef.current = true
      return
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    window.onYouTubeIframeAPIReady = () => {
      ytReadyRef.current = true
    }
  }, [])

  // Create or load video into the persistent player
  const loadVideo = useCallback((videoId: string) => {
    if (!ytContainerRef.current) return

    if (ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
      ytPlayerRef.current.loadVideoById(videoId)
      return
    }

    const tryCreate = () => {
      if (!window.YT || !window.YT.Player || !ytContainerRef.current) {
        setTimeout(tryCreate, 200)
        return
      }
      ytPlayerRef.current = new window.YT.Player('yt-player-container', {
        videoId,
        playerVars: {
          autoplay: 1,
          loop: 1,
          playlist: videoId,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            setIsMusicPlaying(true)
          },
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.PLAYING) setIsMusicPlaying(true)
            if (e.data === window.YT.PlayerState.PAUSED) setIsMusicPlaying(false)
          },
        },
      })
    }
    tryCreate()
  }, [])

  const handlePlayTrack = useCallback((track: Video) => {
    setCurrentTrack(track)
    loadVideo(track.video_id)
    if (!isMusicOpen) setIsMusicOpen(true)
  }, [isMusicOpen, loadVideo])

  const handleToggleMusicPlay = useCallback(() => {
    if (!ytPlayerRef.current) return
    if (isMusicPlaying) {
      ytPlayerRef.current.pauseVideo()
    } else {
      ytPlayerRef.current.playVideo()
    }
  }, [isMusicPlaying])

  const handleStopMusic = useCallback(() => {
    if (ytPlayerRef.current && ytPlayerRef.current.stopVideo) {
      ytPlayerRef.current.stopVideo()
    }
    setCurrentTrack(null)
    setIsMusicPlaying(false)
  }, [])

  const handlePlayMusic = useCallback(async (mood: string) => {
    try {
      const res = await fetch(`${API_URL}/music/mood/${mood}?max_results=1`)
      const data = await res.json()
      if (data.videos && data.videos.length > 0) {
        const track = data.videos[0]
        setCurrentTrack(track)
        loadVideo(track.video_id)
      }
    } catch (err) {
      console.error('Failed to fetch music for mood:', err)
    }
  }, [loadVideo])

  const handleCloseMusicOverlay = useCallback(() => {
    setIsMusicOpen(false)
  }, [])

  // Fetch user settings when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      dispatch(fetchSettings(token))
    }
  }, [isAuthenticated, token, dispatch])

  // Handle logout
  useEffect(() => {
    if (!isAuthenticated) {
      dispatch(clearSettings())
      dispatch(clearTip())
      setTimeRemaining(1800 * 1000)
      setBreakTimeLeft(90)
      setIsPaused(false)
      setIsBreakActive(false)
      setIsBreakPaused(false)
      hasInitializedTimer.current = false
      window.electronAPI?.sendResetTimer()
    }
  }, [isAuthenticated, dispatch])

  const hasInitializedTimer = useRef(false)

  useEffect(() => {
    if (isAuthenticated && token && !hasInitializedTimer.current && settings.fetched && settings.breakInterval > 0) {
      setTimeRemaining(settings.breakInterval * 1000)
      setBreakTimeLeft(settings.breakDuration)
      hasInitializedTimer.current = true

      window.electronAPI?.sendUpdateTimerSetting({
        interval: settings.breakInterval,
        duration: settings.breakDuration,
        autoStart: settings.autoStart,
        enableSound: settings.enableSound
      })
    }
  }, [isAuthenticated, token, settings.breakInterval, settings.breakDuration, settings.autoStart, settings.fetched])

  const handleApplySettings = useCallback((interval: number, duration: number, soundEnabled: boolean) => {
    window.electronAPI?.sendUpdateTimerSetting({
      interval, duration, autoStart: true, enableSound: soundEnabled
    })
    if (token) {
      dispatch(updateSettings({
        token, settings: {
          break_interval: interval, break_duration: duration, auto_start: true, enable_sound: soundEnabled
        }
      }))
    }
  }, [token, dispatch])

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const sessionCompletedRef = useRef(false)
  const sessionStartTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!window.electronAPI) return
    const cleanupTimerUpdate = window.electronAPI.onTimerUpdate((time) => setTimeRemaining(time))
    const cleanupTimerReset = window.electronAPI.onTimerReset(() => {
      const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
      if (!sessionCompletedRef.current && token && elapsed > 10) {
        dispatch(saveSession({
          token, sessionDuration: elapsed, targetDuration: settings.breakInterval, completed: false, skipped: true
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
      setIsBreakPaused(false)
    })
    const cleanupSettingsUpdated = window.electronAPI.onSettingsUpdated((data) => {
      setTimeRemaining(data.interval * 1000)
    })
    return () => { cleanupTimerUpdate(); cleanupTimerReset(); cleanupBreakTime(); cleanupSettingsUpdated() }
  }, [settings, token, dispatch])

  useEffect(() => {
    let interval: any = null
    if (isBreakActive && breakTimeLeft > 0 && !isBreakPaused) {
      interval = setInterval(() => {
        setBreakTimeLeft(prev => {
          if (prev <= 1) {
            setIsBreakActive(false)
            setIsBreakPaused(false)
            window.electronAPI?.sendTimerBreakComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isBreakActive, breakTimeLeft, isBreakPaused])

  const hasFetchedTip = useRef(false)
  useEffect(() => {
    if (!isBreakActive && timeRemaining > 0 && timeRemaining <= 5000 && token && !hasFetchedTip.current) {
      dispatch(fetchTipRecommendation(token))
      hasFetchedTip.current = true
    }
    if (isBreakActive === false && timeRemaining > 5000) hasFetchedTip.current = false
    if (!isBreakActive && timeRemaining === settings.breakInterval * 1000) dispatch(clearTip())
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
        token, sessionDuration: elapsedSeconds, targetDuration: settings.breakInterval, completed: true, skipped: false
      }))
    }
    setIsBreakActive(false)
    setIsBreakPaused(false)
    window.electronAPI?.sendResetTimer()
    window.electronAPI?.sendMinimizeToTray()
  }, [token, timeRemaining, settings.breakInterval, dispatch])

  const handlePauseBreak = useCallback(() => { setIsBreakPaused(true) }, [])
  const handleResumeBreak = useCallback(() => { setIsBreakPaused(false) }, [])

  const progress = ((settings.breakInterval * 1000 - timeRemaining) / (settings.breakInterval * 1000)) * 100
  const circumference = 2 * Math.PI * 270

  return (
    <div className="relative w-screen h-screen flex flex-col justify-center items-center text-center overflow-hidden font-sans">
      {/* Background */}
      <div
        className="fixed inset-0 z-[-2] transition-transform duration-[10000ms] scale-105 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('nature_bg.png')", backgroundColor: "#0c140c" }}
      ></div>
      <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-transparent to-black/60 z-[-1]"></div>

      <div className="fixed top-0 left-0 right-0 h-20 drag-area z-50"></div>

      {/* Logo */}
      <div className="fixed top-6 left-8 z-[100] drag-none select-none">
        <span className="text-2xl font-semibold tracking-tight text-white/80">
          antiburnout<span className="text-emerald-400">.ai</span>
        </span>
      </div>

      <div className="fixed top-8 right-8 flex gap-3 z-[100] drag-none">
        <button onClick={() => window.electronAPI?.sendMinimizeToTray()} className="w-10 h-10 rounded-xl bg-glass glass-blur border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all duration-300 cursor-pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
        </button>
      </div>

      {/* Main UI */}
      <main className={`relative flex flex-col mt-24 items-center justify-center transition-all duration-1000 ${isBreakActive ? 'scale-110 blur-xl opacity-0' : 'scale-100 opacity-100'}`}>
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

        <div className="flex items-center gap-3 p-6 bg-glass glass-blur border border-white/10 rounded-full text-xs font-bold uppercase tracking-[0.2em] text-accent">
          <span className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${isPaused ? 'bg-yellow-400 shadow-yellow-400' : 'bg-green-400 shadow-green-400 animate-pulse'}`}></span>
          {isPaused ? 'Paused' : 'Next break in...'}
        </div>

        <div className="absolute -bottom-9/12 flex gap-4 items-center">
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={resetTimer} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 transition-colors cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={togglePause} className="w-42 px-5 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 transition-colors cursor-pointer">
            {isPaused ? 'Resume' : 'Pause'}
          </motion.button>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => setIsSettingsOpen(true)} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 transition-colors cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </motion.button>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => setIsProfileOpen(true)} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 transition-colors cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </motion.button>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => setIsInsightsOpen(true)} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 transition-colors cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
          </motion.button>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => setIsMusicOpen(true)} className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 transition-colors cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </motion.button>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => setIsChatOpen(true)} className="w-14 h-14 absolute -right-11/12 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary hover:border-accent/40 transition-colors cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </motion.button>
        </div>
      </main>

      {/* Overlays */}
      <SettingsOverlay isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} initialInterval={settings.breakInterval} initialDuration={settings.breakDuration} enableSound={settings.enableSound} onApply={handleApplySettings} />
      <InsightsOverlay isOpen={isInsightsOpen} onClose={() => setIsInsightsOpen(false)} />
      <BreakView isActive={isBreakActive} timeLeft={breakTimeLeft} isPaused={isBreakPaused} onPause={handlePauseBreak} onResume={handleResumeBreak} onEnd={handleEndBreak} enableSound={settings.enableSound} />
      <ChatOverlay isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} onPlayMusic={handlePlayMusic} />

      {/* Persistent YouTube player container - NEVER unmounts */}
      <motion.div
        ref={ytContainerRef}
        initial={false}
        animate={currentTrack && !isMusicOpen
          ? { opacity: 1, y: 0, scale: 1, width: 380, height: 90 }
          : { opacity: 0, y: 40, scale: 0.9, width: 0, height: 0 }
        }
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 left-6 z-[9997] rounded-2xl overflow-hidden border border-white/10 shadow-2xl pointer-events-auto"
        style={{ pointerEvents: currentTrack && !isMusicOpen ? 'auto' : 'none' }}
      >
        <div id="yt-player-container" className="w-full h-full" />
        {/* Mini-player overlay on top of the iframe */}
        <div className="absolute inset-0 flex items-center gap-3 px-4 bg-black/80 backdrop-blur-xl">
          {currentTrack && (
            <>
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-14 h-14 rounded-xl object-cover shrink-0 ring-1 ring-white/10"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
                <p className="text-xs text-white/40 truncate">{currentTrack.channel}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToggleMusicPlay}
                  className="w-10 h-10 rounded-full bg-white/10 border border-white/10 text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-colors cursor-pointer"
                >
                  {isMusicPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  )}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsMusicOpen(true)}
                  className="w-10 h-10 rounded-full bg-white/10 border border-white/10 text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-colors cursor-pointer"
                  title="Open player"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleStopMusic}
                  className="w-10 h-10 rounded-full bg-white/10 border border-white/10 text-white/50 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
                  title="Stop music"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </motion.button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Music Overlay */}
      <MusicOverlay
        isOpen={isMusicOpen}
        onClose={handleCloseMusicOverlay}
        currentTrack={currentTrack}
        onPlayTrack={handlePlayTrack}
      />

      <ProfileOverlay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      {!isAuthenticated && <LoginModal isOpen={true} onClose={() => {}} />}
    </div>
  )
}

export default App
