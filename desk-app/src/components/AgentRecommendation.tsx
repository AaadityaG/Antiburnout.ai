import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL 

interface Recommendation {
  id: string
  type: string
  title: string
  message: string
  priority: number
  action_type: string
  execute_endpoint?: string
  execute_params?: any
}

interface AgentRecommendationProps {
  onChatOpen: () => void
}

function AgentRecommendation({ onChatOpen }: AgentRecommendationProps) {
  const { token } = useSelector((state: RootState) => state.auth)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  // Fetch recommendation periodically with real system metrics
  useEffect(() => {
    if (!token || isDismissed) return

    const fetchRecommendation = async () => {
      try {
        const hour = new Date().getHours()
        
        // Get real system metrics from Electron
        let brightness: number | null = null
        let volume: number | null = null
        
        if (window.electronAPI) {
          try {
            brightness = await window.electronAPI.getSystemBrightness()
          } catch (e) {
            console.log('Brightness not available:', e)
          }
          
          try {
            console.log('Calling getSystemVolume...')
            volume = await window.electronAPI.getSystemVolume()
            console.log('Volume result:', volume)
          } catch (e) {
            console.log('Volume not available:', e)
          }
        }
        
        console.log('System metrics:', { brightness, volume, hour })

        const response = await axios.get(`${API_URL}/agent/recommendations`, {
          params: {
            token,
            current_hour: hour,
            brightness: brightness,
            volume: volume,
            consecutive_sessions: null // Would track from app state
          }
        })

        if (response.data.recommendation) {
          const rec = response.data.recommendation
          // Don't show if already dismissed
          if (!dismissedIds.has(rec.id)) {
            setRecommendation(rec)
          }
        } else {
          setRecommendation(null)
        }
      } catch (error) {
        console.error('Failed to fetch recommendation:', error)
      }
    }

    fetchRecommendation()
    // Check every 2 minutes for more responsive monitoring
    const interval = setInterval(fetchRecommendation, 2 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [token, isDismissed, dismissedIds])

  const handleExecute = async () => {
    if (!recommendation || !token) return

    console.log('Execute clicked:', recommendation.type, recommendation.execute_params)

    try {
      // Execute system control via Electron IPC
      if (window.electronAPI) {
        console.log('Electron API available, executing...')
        let result = { success: false }

        switch (recommendation.type) {
          case 'brightness':
            if (recommendation.execute_params?.target_brightness) {
              console.log('Setting brightness to:', recommendation.execute_params.target_brightness)
              result = await window.electronAPI.setSystemBrightness(
                recommendation.execute_params.target_brightness
              )
              console.log('Brightness result:', result)
            }
            break
          
          case 'volume':
            if (recommendation.execute_params?.target_volume) {
              console.log('Setting volume to:', recommendation.execute_params.target_volume)
              result = await window.electronAPI.setSystemVolume(
                recommendation.execute_params.target_volume
              )
              console.log('Volume result:', result)
            }
            break
          
          default:
            console.log('Unknown recommendation type:', recommendation.type)
        }

        if (result.success) {
          console.log('✅ System control executed successfully')
          // Mark as executed
          setDismissedIds(prev => new Set([...prev, recommendation.id]))
          setRecommendation(null)
        } else {
          console.error('❌ System control failed:', result)
        }
      } else {
        console.error('❌ Electron API not available')
      }
    } catch (error) {
      console.error('❌ Failed to execute recommendation:', error)
    }
  }

  const handleDismiss = () => {
    if (recommendation) {
      setDismissedIds(prev => new Set([...prev, recommendation.id]))
      setRecommendation(null)
    }
  }

  const handleDontShowAgain = () => {
    // Store in localStorage for this session type
    if (recommendation) {
      localStorage.setItem(`agent_dismissed_${recommendation.type}`, 'true')
      setDismissedIds(prev => new Set([...prev, recommendation.id]))
      setRecommendation(null)
    }
  }

  if (!recommendation) return null

  const getIcon = () => {
    switch (recommendation.type) {
      case 'brightness': return '☀️'
      case 'volume': return '🔊'
      case 'session_break': return '⏸️'
      default: return '💡'
    }
  }

  const getAccentColor = () => {
    switch (recommendation.type) {
      case 'brightness': return 'rgba(250, 204, 21, 0.15)'
      case 'volume': return 'rgba(244, 63, 94, 0.15)'
      case 'session_break': return 'rgba(16, 185, 129, 0.15)'
      default: return 'rgba(212, 252, 212, 0.15)'
    }
  }

  return (
    <div className="w-full max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div
        className="rounded-2xl border p-4 backdrop-blur-sm"
        style={{
          background: getAccentColor(),
          borderColor: 'rgba(255, 255, 255, 0.1)'
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
            <span className="text-lg">{getIcon()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white/90 tracking-wide mb-0.5">
              Wellness Agent
            </h4>
            <p className="text-[11px] font-medium text-white/70 leading-tight">
              {recommendation.title}
            </p>
          </div>
          <button
            className="text-white/30 hover:text-white/60 cursor-pointer shrink-0"
            onClick={handleDismiss}
            title="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Message */}
        <p className="text-xs text-white/60 leading-relaxed mb-3">
          {recommendation.message}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {recommendation.action_type === 'execute' ? (
            <>
              <button
                className="flex-1 h-8 rounded-lg text-[11px] font-medium cursor-pointer transition-all"
                style={{
                  background: 'rgba(212, 252, 212, 0.2)',
                  border: '1px solid rgba(212, 252, 212, 0.3)',
                  color: 'rgba(212, 252, 212, 0.9)'
                }}
                onClick={handleExecute}
              >
                ✨ Execute
              </button>
              <button
                className="h-8 px-3 rounded-lg text-[11px] font-medium cursor-pointer transition-all text-white/50 hover:text-white/70 hover:bg-white/5"
                onClick={handleDismiss}
              >
                Dismiss
              </button>
            </>
          ) : (
            <button
              className="flex-1 h-8 rounded-lg text-[11px] font-medium cursor-pointer transition-all text-white/50 hover:text-white/70 hover:bg-white/5"
              onClick={handleDismiss}
            >
              Got it
            </button>
          )}
          <button
            className="h-8 px-2 rounded-lg text-[10px] cursor-pointer transition-all text-white/30 hover:text-white/50 hover:bg-white/5"
            onClick={handleDontShowAgain}
            title="Don't show this type of recommendation again"
          >
            Hide these
          </button>
        </div>

        {/* Chat CTA */}
        <div className="mt-3 pt-3 border-t border-white/10">
          <button
            className="w-full h-7 rounded-lg text-[10px] font-medium cursor-pointer transition-all text-white/40 hover:text-white/60 hover:bg-white/5 flex items-center justify-center gap-1.5"
            onClick={onChatOpen}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Ask agent for all recommendations
          </button>
        </div>
      </div>
    </div>
  )
}

export default AgentRecommendation
