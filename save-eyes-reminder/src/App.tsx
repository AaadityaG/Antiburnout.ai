import { useState, useEffect, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { login as loginAction, logout as logoutAction } from './store/authSlice'
import { fetchSettings, updateSettings, clearSettings } from './store/settingsSlice'
import type { RootState, AppDispatch } from './store'
import './App.css'
import axios from 'axios'
import LoginModal from './components/LoginModal'

const API_URL = import.meta.env.VITE_API_URL

function App() {
  const [timeRemaining, setTimeRemaining] = useState(30 * 60 * 1000)
  const [isPaused, setIsPaused] = useState(false)
  const [isBreakActive, setIsBreakActive] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [breakTimeLeft, setBreakTimeLeft] = useState(20)
  const [intervalInput, setIntervalInput] = useState(30)
  const [durationInput, setDurationInput] = useState(20)
  
  // Redux state
  const dispatch = useDispatch<AppDispatch>()
  const { user, token, isAuthenticated } = useSelector((state: RootState) => state.auth)
  const { breakInterval, breakDuration, autoStart } = useSelector((state: RootState) => state.settings)
  const [showLoginModal, setShowLoginModal] = useState(!isAuthenticated)
  
  // Premium features state
  const [isInsightsOpen, setIsInsightsOpen] = useState(false)
  
  // Profile form
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Format time as MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Check for existing session on app start
  useEffect(() => {
    // Redux already loads from localStorage on init
    setShowLoginModal(!isAuthenticated)
  }, [isAuthenticated])

  // Fetch user settings when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      dispatch(fetchSettings(token))
    }
  }, [isAuthenticated, token, dispatch])

  // Calculate progress percentage
  const initialTime = breakInterval * 60 * 1000
  const progress = ((initialTime - timeRemaining) / initialTime) * 100

  // Handle timer updates from main process
  useEffect(() => {
    if (!window.electronAPI) {
      console.error('electronAPI not available!')
      return
    }

    // Setup IPC listeners and store cleanup functions
    const cleanupTimerUpdate = window.electronAPI.onTimerUpdate((time) => {
      setTimeRemaining(time)
    })

    const cleanupTimerReset = window.electronAPI.onTimerReset(() => {
      setTimeRemaining(initialTime)
      setIsPaused(false)
    })

    const cleanupBreakTime = window.electronAPI.onBreakTime((data) => {
      if (data.duration) setBreakTimeLeft(data.duration)
      setIsBreakActive(true)
    })

    const cleanupSettingsUpdated = window.electronAPI.onSettingsUpdated((data) => {
      setTimeRemaining(data.interval * 60 * 1000)
    })
    
    // Cleanup IPC listeners on unmount
    return () => {
      cleanupTimerUpdate()
      cleanupTimerReset()
      cleanupBreakTime()
      cleanupSettingsUpdated()
    }
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
    window.electronAPI?.sendMinimizeToTray()
  }, [])

  const saveSettings = useCallback(() => {
    if (intervalInput >= 1 && durationInput >= 5) {
      // Update Electron main process
      window.electronAPI?.sendUpdateTimerSetting({
        interval: intervalInput,
        duration: durationInput,
        autoStart,
      })
      
      // Update backend if authenticated
      if (token) {
        dispatch(updateSettings({
          token,
          settings: {
            break_interval: intervalInput,
            break_duration: durationInput,
            auto_start: autoStart
          }
        }))
      }
      
      setIsSettingsOpen(false)
    }
  }, [intervalInput, durationInput, autoStart, token, dispatch])

  const toggleAutoStart = useCallback(() => {
    // Will be handled when saving settings
  }, [])

  const openProfile = useCallback(() => {
    if (user) {
      setProfileName(user.name || '')
      setProfileEmail(user.email || '')
    }
    setIsProfileOpen(true)
  }, [user])

  const saveProfile = useCallback(async () => {
    if (!token) return
    
    setIsSavingProfile(true)
    try {
      const response = await axios.put(`${API_URL}/auth/profile`, {
        name: profileName,
        email: profileEmail,
      }, {
        params: { token }
      })

      const updatedUser = response.data
      dispatch(loginAction({ user: updatedUser, token }))
      setIsProfileOpen(false)
    } catch (error) {
      console.error('Failed to save profile:', error)
      alert('Failed to save profile. Please try again.')
    } finally {
      setIsSavingProfile(false)
    }
  }, [token, profileName, profileEmail, dispatch])

  const logout = useCallback(() => {
    dispatch(logoutAction())
    dispatch(clearSettings())
    
    // Reset UI state
    setProfileName('')
    setProfileEmail('')
    setIsProfileOpen(false)
    
    // Show login modal
    setShowLoginModal(true)
  }, [dispatch])

  const openInsights = useCallback(() => {
    setIsInsightsOpen(true)
  }, [])

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

          <button className="action-btn" onClick={openProfile} title="Profile">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </button>

          <button className="action-btn" onClick={openInsights} title="Insights">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
              <path d="M22 12A10 10 0 0 0 12 2v10z"/>
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

      {/* Login Modal Component */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      {/* Insights Overlay (Premium Feature) */}
      <div className={`settings-overlay ${isInsightsOpen ? 'active' : ''}`} id="insights-view">
        <div className="settings-content">
          <h2 className="settings-header">Insights</h2>
          
          <div style={{
            padding: '30px',
            textAlign: 'center',
            color: '#88a088',
          }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>📊</div>
            <h3 style={{ color: 'white', marginBottom: '10px' }}>Usage Analytics</h3>
            <p>Track your break patterns and eye health trends</p>
            <p style={{ marginTop: '20px', fontSize: '13px' }}>Coming Soon...</p>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
            <button 
              className="action-btn" 
              onClick={() => setIsInsightsOpen(false)} 
              style={{ width: '60px', height: '60px' }}
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Profile Overlay */}
      <div className={`settings-overlay ${isProfileOpen ? 'active' : ''}`} id="profile-view">
        <div className="settings-content">
          <h2 className="settings-header">User Profile</h2>
          
          <div style={{
            padding: '20px',
            background: 'rgba(74, 222, 128, 0.1)',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            borderRadius: '16px',
            marginBottom: '30px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '20px' }}>✓</span>
              <p style={{ color: '#4ade80', margin: 0, fontSize: '14px', fontWeight: 600 }}>Authenticated</p>
            </div>
            <p style={{ color: '#88a088', margin: 0, fontSize: '12px' }}>
              Your device is securely authenticated
            </p>
          </div>
          
          <div className="form-group">
            <label className="label">Name (Optional)</label>
            <input 
              type="text" 
              className="input" 
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>

          <div className="form-group">
            <label className="label">Email (Optional)</label>
            <input 
              type="email" 
              className="input" 
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>

          <p style={{ color: '#88a088', fontSize: '13px', marginTop: '20px' }}>
            Adding your name and email helps you identify your profile across devices.
          </p>

          <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
            <button 
              className="action-btn primary" 
              onClick={saveProfile} 
              disabled={isSavingProfile}
              style={{ flex: 1, height: '60px' }}
            >
              {isSavingProfile ? 'Saving...' : 'Save Profile'}
            </button>
            <button 
              className="action-btn" 
              onClick={() => setIsProfileOpen(false)} 
              style={{ width: '60px', height: '60px' }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginTop: '30px', paddingTop: '30px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button 
              onClick={logout}
              style={{
                width: '100%',
                padding: '14px',
                background: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid rgba(244, 67, 54, 0.3)',
                borderRadius: '12px',
                color: '#f44336',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(244, 67, 54, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(244, 67, 54, 0.1)'
              }}
            >
              Logout
            </button>
            <p style={{ color: '#88a088', fontSize: '12px', marginTop: '10px', textAlign: 'center' }}>
              You'll need to login again to use the app
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
