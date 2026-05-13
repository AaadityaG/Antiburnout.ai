import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

function App() {
  const [timeRemaining, setTimeRemaining] = useState(30 * 60 * 1000)
  const [initialTime, setInitialTime] = useState(30 * 60 * 1000)
  const [breakDuration, setBreakDuration] = useState(20)
  const [isPaused, setIsPaused] = useState(false)
  const [isBreakActive, setIsBreakActive] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [autoStart, setAutoStart] = useState(true)
  const [breakTimeLeft, setBreakTimeLeft] = useState(20)
  const [intervalInput, setIntervalInput] = useState(30)
  const [durationInput, setDurationInput] = useState(20)
  const initialTimeRef = useRef(initialTime)

  // Format time as MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const progress = ((initialTime - timeRemaining) / initialTime) * 100

  // Update ref when initialTime changes
  useEffect(() => {
    initialTimeRef.current = initialTime
  }, [initialTime])

  // Handle timer updates from main process - setup only once
  useEffect(() => {
    console.log('electronAPI available:', !!window.electronAPI)
    
    if (!window.electronAPI) {
      console.error('electronAPI not available!')
      return
    }

    console.log('Setting up IPC listeners')
    
    window.electronAPI.onTimerUpdate((_event: any, time: number) => {
      console.log('Timer update received:', time)
      setTimeRemaining(time)
    })

    window.electronAPI.onTimerReset(() => {
      console.log('Timer reset received')
      setTimeRemaining(initialTimeRef.current)
      setIsPaused(false)
    })

    window.electronAPI.onBreakTime((_event: any, data: any) => {
      console.log('Break time received:', data)
      if (data.duration) setBreakDuration(data.duration)
      setBreakTimeLeft(data.duration)
      setIsBreakActive(true)
    })

    window.electronAPI.onSettingsUpdated((_event: any, data: any) => {
      console.log('Settings updated:', data)
      setInitialTime(data.interval * 60 * 1000)
      setBreakDuration(data.duration)
      setTimeRemaining(data.interval * 60 * 1000)
      if (data.autoStart !== undefined) setAutoStart(data.autoStart)
    })
    
    console.log('IPC listeners setup complete')
  }, [])

  // Break timer countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    
    if (isBreakActive && breakTimeLeft > 0) {
      interval = setInterval(() => {
        setBreakTimeLeft(prev => {
          if (prev <= 1) {
            completeBreak()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isBreakActive, breakTimeLeft])

  const togglePause = useCallback(() => {
    if (isPaused) {
      window.electronAPI?.sendResumeTimer()
    } else {
      window.electronAPI?.sendPauseTimer()
    }
    setIsPaused(!isPaused)
  }, [isPaused])

  const resetTimer = useCallback(() => {
    window.electronAPI?.sendResetTimer()
    setIsPaused(false)
  }, [])

  const completeBreak = useCallback(() => {
    setIsBreakActive(false)
    window.electronAPI?.sendTimerBreakComplete()
    setTimeout(() => {
      window.electronAPI?.sendMinimizeToTray()
    }, 500)
  }, [])

  const minimizeToTray = useCallback(() => {
    console.log('Minimize to tray clicked')
    window.electronAPI?.sendMinimizeToTray()
  }, [])

  const saveSettings = useCallback(() => {
    if (intervalInput >= 1 && durationInput >= 5) {
      console.log('Saving settings:', { interval: intervalInput, duration: durationInput, autoStart })
      window.electronAPI?.sendUpdateTimerSetting({
        interval: intervalInput,
        duration: durationInput,
        autoStart,
      })
      setIsSettingsOpen(false)
    }
  }, [intervalInput, durationInput, autoStart])

  const toggleAutoStart = useCallback(() => {
    setAutoStart(!autoStart)
  }, [autoStart])

  return (
    <>
      <div className="drag-area"></div>
      <div className="bg-image" id="bg-image"></div>
      <div className="bg-overlay"></div>

      <div className="win-controls">
        <div className="win-dot" onClick={minimizeToTray}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </div>
        <div className="win-dot close" onClick={() => window.electronAPI?.sendQuitApp()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </div>
      </div>

      <main className="main-view">
        <div className="timer-container">
          <svg className="progress-svg">
            <circle className="progress-bg" cx="290" cy="290" r="270" />
            <circle 
              className="progress-fill" 
              id="progress-circle" 
              cx="290" 
              cy="290" 
              r="270"
              style={{
                strokeDasharray: `${2 * Math.PI * 270} ${2 * Math.PI * 270}`,
                strokeDashoffset: 2 * Math.PI * 270 - (progress / 100) * 2 * Math.PI * 270,
              }}
            />
          </svg>
          <div className="timer-text" id="timer">{formatTime(timeRemaining)}</div>
        </div>
        
        <div className="status-badge">
          <span 
            id="status-dot" 
            style={{
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: isPaused ? '#fbbf24' : '#4ade80', 
              boxShadow: `0 0 10px ${isPaused ? '#fbbf24' : '#4ade80'}`,
            }}
          ></span>
          <span id="status-text">{isPaused ? 'Timer paused' : 'Next break in...'}</span>
        </div>

        <div className="controls-bar">
          <button className="action-btn" onClick={resetTimer} title="Reset">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
          
          <button className="action-btn primary" id="pause-btn" onClick={togglePause}>
            <span id="pause-icon">
              {isPaused ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              )}
            </span>
            <span id="pause-label">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button className="action-btn" onClick={() => {
            setIntervalInput(initialTime / 60000)
            setDurationInput(breakDuration)
            setIsSettingsOpen(true)
          }} title="Settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </main>

      {/* Settings Overlay */}
      <div className={`settings-overlay ${isSettingsOpen ? 'active' : ''}`} id="settings-view">
        <div className="settings-content">
          <h2 className="settings-header">Settings</h2>
          
          <div className="form-group">
            <label className="label">Break Interval (Minutes)</label>
            <input 
              type="number" 
              className="input" 
              id="interval-input" 
              value={intervalInput}
              onChange={(e) => setIntervalInput(parseInt(e.target.value))}
              placeholder="20" 
              min="1" 
              max="120"
            />
          </div>

          <div className="form-group">
            <label className="label">Rest Duration (Seconds)</label>
            <input 
              type="number" 
              className="input" 
              id="duration-input" 
              value={durationInput}
              onChange={(e) => setDurationInput(parseInt(e.target.value))}
              placeholder="20" 
              min="5" 
              max="120"
            />
          </div>

          <div className="form-group">
            <label className="label">Auto-Start Timer</label>
            <div 
              style={{
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px', 
                padding: '16px 20px', 
                background: 'rgba(255,255,255,0.05)', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '16px', 
                cursor: 'pointer',
              }} 
              onClick={toggleAutoStart}
            >
              <div 
                id="auto-start-toggle" 
                style={{
                  width: '52px', 
                  height: '28px', 
                  borderRadius: '14px', 
                  background: autoStart ? '#4ade80' : 'rgba(255,255,255,0.2)', 
                  position: 'relative', 
                  transition: 'all 0.3s ease',
                }}
              >
                <div 
                  id="toggle-knob" 
                  style={{
                    width: '22px', 
                    height: '22px', 
                    borderRadius: '50%', 
                    background: 'white', 
                    position: 'absolute', 
                    top: '3px', 
                    [autoStart ? 'right' : 'left']: '3px',
                    transition: 'all 0.3s ease', 
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                ></div>
              </div>
              <span style={{ color: '#88a088', fontSize: '0.9rem' }}>Start timer automatically on launch</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
            <button className="action-btn primary" onClick={saveSettings} style={{ flex: 1, height: '60px' }}>Apply</button>
            <button className="action-btn" onClick={() => setIsSettingsOpen(false)} style={{ width: '60px', height: '60px' }}>✕</button>
          </div>
        </div>
      </div>

      {/* Break Overlay */}
      <div className={`break-overlay ${isBreakActive ? 'active' : ''}`} id="break-view">
        <div className="break-card">
          <div className="leaf-icon">🌿</div>
          <h1 className="break-title">Time to Rest Your Eyes</h1>
          <p style={{ fontSize: '1.5rem', opacity: 0.7, marginBottom: '20px' }}>Look at something 20 feet away...</p>
          <div className="break-timer" id="break-timer">{breakTimeLeft}</div>
          <button className="action-btn primary" onClick={completeBreak} style={{ margin: '0 auto', width: '240px', height: '64px' }}>
            I'm Refreshed
          </button>
        </div>
      </div>
    </>
  )
}

export default App
