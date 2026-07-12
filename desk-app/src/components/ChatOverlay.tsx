import { useState, useEffect, useRef, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import type { RootState, AppDispatch } from '../store'
import { fetchSessions, fetchSessionMessages, deleteSession, clearAllHistory } from '../store/chatSlice'
import axios from 'axios'
import ConfirmDialog from './ConfirmDialog'

const API_URL = import.meta.env.VITE_API_URL 

interface ChatOverlayProps {
  isOpen: boolean
  onClose: () => void
}

function ChatOverlay({ isOpen, onClose }: ChatOverlayProps) {
  const dispatch = useDispatch<AppDispatch>()
  const { token } = useSelector((state: RootState) => state.auth)
  const { sessions, isLoading } = useSelector((state: RootState) => state.chat)
  const user = useSelector((state: RootState) => state.auth.user)
  
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; recommendations?: any[]; tools_used?: string[] }>>([
    { role: 'assistant', content: '👋 Hi! I\'m your Wellness Agent. How can I help you today?' }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedModelKey, setSelectedModelKey] = useState<string>('')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    variant: 'primary' | 'danger'
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'primary'
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && token) {
      dispatch(fetchSessions(token))
    }
  }, [isOpen, token, dispatch])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const loadSessionMessages = async (sessionId: string) => {
    if (!token) return
    try {
      const session = await dispatch(fetchSessionMessages({ token, sessionId })).unwrap()
      const chatMessages = session.messages.flatMap((msg: any) => [
        { role: 'user' as const, content: msg.message },
        { role: 'assistant' as const, content: msg.response }
      ])
      setMessages(chatMessages)
      setActiveSessionId(sessionId)
    } catch (error) {
      console.error('Failed to load session:', error)
    }
  }

  const handleDeleteSession = (sessionId: string) => {
    if (!token) return
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Conversation',
      message: 'Are you sure you want to delete this conversation? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await dispatch(deleteSession({ token, sessionId })).unwrap()
          if (activeSessionId === sessionId) {
            setMessages([{ role: 'assistant', content: '👋 Hi! I\'m your Wellness Agent. How can I help you today?' }])
            setActiveSessionId(null)
          }
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Failed to delete session:', error)
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        }
      }
    })
  }

  const handleClearHistory = () => {
    if (!token) return
    setConfirmDialog({
      isOpen: true,
      title: 'Clear All History',
      message: 'Are you sure you want to clear all chat history? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await dispatch(clearAllHistory(token)).unwrap()
          setMessages([{ role: 'assistant', content: '👋 Hi! I\'m your Wellness Agent. How can I help you today?' }])
          setActiveSessionId(null)
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        } catch (error) {
          console.error('Failed to clear history:', error)
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        }
      }
    })
  }

  const availableModels = user?.ai_providers || {}
  const modelKeys = Object.keys(availableModels)

  if (!selectedModelKey && modelKeys.length > 0) {
    setSelectedModelKey(modelKeys[0])
  }

  const currentModel = selectedModelKey ? availableModels[selectedModelKey]?.model : 'AI'

  const handleSend = async (overrideMessage?: string) => {
    const msgToSend = overrideMessage || input.trim()
    if (!msgToSend || !token) return

    const userMessage = msgToSend
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setInput('')
    setIsTyping(true)

    try {
      const conversationHistory = messages
        .filter(msg => !msg.content.startsWith('👋'))
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }))

      // Get real system metrics from Electron
      let brightness: number | null = null
      let volume: number | null = null
      let nightModeEnabled: boolean = false
      
      if (window.electronAPI) {
        try {
          brightness = await window.electronAPI.getSystemBrightness()
        } catch (e) {
          console.log('Brightness not available:', e)
        }
        
        try {
          volume = await window.electronAPI.getSystemVolume()
        } catch (e) {
          console.log('Volume not available:', e)
        }
        
        try {
          nightModeEnabled = await window.electronAPI.getNightModeStatus()
        } catch (e) {
          console.log('Night mode not available:', e)
        }
      }

      console.log('Sending chat with system metrics:', { brightness, volume, nightModeEnabled })

      const response = await axios.post(`${API_URL}/chat/send`, {
        message: userMessage,
        conversation_history: conversationHistory,
        model_key: selectedModelKey,
        session_id: activeSessionId || undefined,
        brightness: brightness,
        volume: volume,
        is_night_mode_enabled: nightModeEnabled
      }, {
        params: { token }
      })

      console.log('Chat response received:', response.data)
      console.log('Recommendations:', response.data.recommendations)

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.data.response,
        recommendations: response.data.recommendations || [],
        tools_used: response.data.tools_used || []
      }])

      if (response.data.session_id && !activeSessionId) {
        setActiveSessionId(response.data.session_id)
        dispatch(fetchSessions(token))
      }
    } catch (error: any) {
      console.error('Chat error:', error)
      const errorMessage = error.response?.data?.detail || 'Sorry, I couldn\'t process that. Please try again.'
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${errorMessage}`
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const startNewChat = () => {
    setMessages([{ role: 'assistant', content: '👋 Hi! I\'m your Wellness Agent. How can I help you today?' }])
    setActiveSessionId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const q = searchQuery.toLowerCase()
    return sessions.filter(
      (s: any) =>
        s.first_message?.toLowerCase().includes(q) ||
        s.last_message?.toLowerCase().includes(q)
    )
  }, [sessions, searchQuery])

  const groupedSessions = useMemo(() => {
    const groups: Record<string, any[]> = {}
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    for (const s of filteredSessions) {
      const d = new Date(s.updated_at)
      let label: string
      if (d.toDateString() === today.toDateString()) {
        label = 'Today'
      } else if (d.toDateString() === yesterday.toDateString()) {
        label = 'Yesterday'
      } else {
        label = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      }
      if (!groups[label]) groups[label] = []
      groups[label].push(s)
    }
    return groups
  }, [filteredSessions])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4 transition-all duration-500 opacity-100 animate-in fade-in zoom-in-95">
        <div className="w-full max-w-[1100px] h-[90vh] max-h-[800px] border border-white/10 rounded-[32px] shadow-2xl flex overflow-hidden">
          {/* Sidebar - History */}
          <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-[width] duration-200 border-r border-white/5 flex flex-col overflow-hidden shrink-0`}>
            <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
              <h3 className="text-sm font-medium text-white/80 tracking-wide">History</h3>
              {sessions.length > 0 && (
                <button
                  className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg cursor-pointer"
                  onClick={handleClearHistory}
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 transition-[border-color]"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                </div>
              ) : Object.keys(groupedSessions).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/30">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
                  </svg>
                  <p className="mt-3 text-sm">{searchQuery ? 'No matching conversations' : 'No conversations yet'}</p>
                </div>
              ) : (
                Object.entries(groupedSessions).map(([dateLabel, dateSessions]) => (
                  <div key={dateLabel} className="mt-4 first:mt-0">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2 px-1">{dateLabel}</p>
                    <div className="space-y-1">
                      {(dateSessions as any[]).map((session: any) => (
                        <button
                          key={session.id}
                          onClick={() => loadSessionMessages(session.id)}
                          className={`w-full text-left p-3 rounded-xl cursor-pointer ${
                            activeSessionId === session.id
                              ? 'bg-accent/10 border border-accent/20'
                              : 'hover:bg-white/[0.04] border border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-white/80 truncate">{session.first_message || 'New conversation'}</p>
                              <p className="text-xs text-white/30 mt-1 truncate">{session.last_message || ''}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              <button
                                className="text-red-400/50 hover:text-red-300 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteSession(session.id)
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                              </button>
            </div>
          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  className="w-9 h-9 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary cursor-pointer shrink-0"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  title={sidebarOpen ? 'Hide history' : 'Show history'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                </button>

                <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                  <span className="text-base">🤖</span>
                </div>
                <div className="min-w-0 flex items-start flex-col">
                  <h2 className="text-lg font-medium text-white truncate">Wellness Agent</h2>
                  <p className="text-xs text-green-200/40 truncate">{currentModel}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {modelKeys.length > 1 && (
                  <select
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent cursor-pointer"
                    value={selectedModelKey}
                    onChange={(e) => setSelectedModelKey(e.target.value)}
                  >
                    {modelKeys.map(key => (
                      <option key={key} value={key} className="bg-bg-dark">
                        {availableModels[key]?.model}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  className="w-9 h-9 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary cursor-pointer"
                  onClick={startNewChat}
                  title="New Chat"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>

                <button
                  className="w-9 h-9 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary cursor-pointer"
                  onClick={onClose}
                >
                  ✕
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
              {messages.length === 1 && messages[0].role === 'assistant' && messages[0].content.startsWith('👋') ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-8">
                  <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5">
                    <span className="text-3xl">💬</span>
                  </div>
                  <h3 className="text-xl font-light text-white/80 mb-2">Start a conversation</h3>
                  <p className="text-sm text-white/30 max-w-xs leading-relaxed mb-6">
                    Ask me anything about your break patterns, productivity tips, or just have a chat.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-md">
                    {[
                      'Check my current settings',
                      'I\'m feeling tired',
                      'Suggest a break activity',
                      'How\'s my activity today?',
                      'Reduce my eye strain',
                      'I need a wellness tip',
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSend(prompt)}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/50 hover:text-white/80 hover:bg-white/10 hover:border-white/20 cursor-pointer transition-all"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${idx > 0 ? 'motion-safe:animate-[fadeIn_0.2s_ease-out]' : ''}`}>
                      <div className={`max-w-[80%] px-6 py-4 rounded-2xl text-base leading-relaxed text-left whitespace-pre-wrap ${msg.role === 'user' ? 'bg-accent/15 border border-accent/25 text-white rounded-br-md' : 'bg-white/[0.04] border border-white/[0.06] text-green-200/80 rounded-bl-md'}`}>
                        {msg.content}

                        {/* Tool usage indicators */}
                        {msg.tools_used && msg.tools_used.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/[0.06]">
                            {msg.tools_used.map((tool: string) => (
                              <span key={tool} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20 text-[11px] text-accent/80 font-medium">
                                {tool === 'check_system_settings' && '⚙️ Settings checked'}
                                {tool === 'get_user_activity' && '📊 Activity fetched'}
                                {tool === 'get_user_break_settings' && '⏰ Schedule fetched'}
                                {tool === 'get_break_tip' && '💡 Tip generated'}
                                {!['check_system_settings', 'get_user_activity', 'get_user_break_settings', 'get_break_tip'].includes(tool) && `🔧 ${tool}`}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Render executable recommendations */}
                        {msg.recommendations && msg.recommendations.length > 0 && (
                          <div className="mt-4 space-y-3">
                            <div className="text-xs font-semibold text-white/60 uppercase tracking-wide">Recommended Actions:</div>
                            {msg.recommendations.filter((rec: any) => rec.action_type === 'execute').map((rec: any) => (
                              <div key={rec.id} className="p-4 rounded-xl bg-white/5 border border-white/10 transition-all">
                                <div className="flex items-start gap-3 mb-3">
                                  <span className="text-2xl">
                                    {rec.type === 'brightness' ? '☀️' : rec.type === 'volume' ? '🔊' : rec.type === 'night_mode' ? '🌙' : '⏸️'}
                                  </span>
                                  <div className="flex-1">
                                    <div className="text-sm font-semibold text-white/90">{rec.title}</div>
                                    <div className="text-xs text-white/60 mt-1">{rec.message}</div>
                                  </div>
                                </div>
                                {rec.execute_params && (
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-accent/20 border border-accent/30 text-accent hover:bg-accent/30 cursor-pointer transition-all"
                                      onClick={async (e) => {
                                        const btn = e.currentTarget
                                        try {
                                          if (window.electronAPI) {
                                            let result = { success: false }
                                            switch (rec.type) {
                                              case 'brightness':
                                                result = await window.electronAPI.setSystemBrightness(rec.execute_params.target_brightness)
                                                break
                                              case 'volume':
                                                result = await window.electronAPI.setSystemVolume(rec.execute_params.target_volume)
                                                break
                                              case 'night_mode':
                                                result = await window.electronAPI.setNightMode(rec.execute_params.enabled, rec.execute_params.intensity)
                                                break
                                            }
                                            if (result.success) {
                                              btn.innerHTML = '✅ Applied!'
                                              btn.className = 'flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-green-500/20 border border-green-500/30 text-green-400 cursor-default'
                                              // Disable reject button
                                              const parent = btn.parentElement
                                              if (parent) {
                                                const rejectBtn = parent.querySelector('button:last-child') as HTMLButtonElement
                                                if (rejectBtn) {
                                                  rejectBtn.disabled = true
                                                  rejectBtn.className = 'flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                                                }
                                              }
                                            }
                                          }
                                        } catch (error) {
                                          console.error('Failed to execute:', error)
                                          btn.innerHTML = '❌ Failed'
                                          setTimeout(() => { btn.innerHTML = '✨ Execute' }, 2000)
                                        }
                                      }}
                                    >
                                      ✨ Execute
                                    </button>
                                    <button
                                      className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 border border-white/20 text-white/70 hover:bg-white/15 cursor-pointer transition-all"
                                      onClick={(e) => {
                                        const btn = e.currentTarget
                                        btn.innerHTML = '🗑️ Dismissed'
                                        btn.className = 'flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-white/40 cursor-default'
                                        // Disable execute button
                                        const parent = btn.parentElement
                                        if (parent) {
                                          const execBtn = parent.querySelector('button:first-child') as HTMLButtonElement
                                          if (execBtn) {
                                            execBtn.disabled = true
                                            execBtn.className = 'flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                                          }
                                        }
                                      }}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white/[0.04] border border-white/[0.06] px-5 py-3.5 rounded-2xl rounded-bl-md">
                        <div className="flex gap-1.5">
                          <div className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-white/5">
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-base text-white focus:outline-none focus:border-accent/50 placeholder:text-white/20"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                />
                <button
                  className="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-white/60 flex items-center justify-center hover:bg-white/10 hover:text-white cursor-pointer shrink-0 transition-all"
                  onClick={startNewChat}
                  title="New Chat"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
                <button
                  className="h-12 rounded-full bg-glass glass-blur border border-white/20 text-white font-medium px-6 hover:bg-accent hover:text-primary cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  )
}

export default ChatOverlay
