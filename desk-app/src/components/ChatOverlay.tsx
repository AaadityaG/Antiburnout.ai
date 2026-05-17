import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import type { RootState, AppDispatch } from '../store'
import { fetchSessions, fetchSessionMessages, deleteSession, clearAllHistory, setCurrentSessionId, clearCurrentSession } from '../store/chatSlice'
import axios from 'axios'
import ConfirmDialog from './ConfirmDialog'

const API_URL = import.meta.env.VITE_API_URL

interface ChatOverlayProps {
  isOpen: boolean
  onClose: () => void
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface HistoryMessage {
  id: string
  message: string
  response: string
  model: string
  created_at: string
}

function ChatOverlay({ isOpen, onClose }: ChatOverlayProps) {
  const dispatch = useDispatch<AppDispatch>()
  const { token, user } = useSelector((state: RootState) => state.auth)
  const { sessions, currentSession, isLoading } = useSelector((state: RootState) => state.chat)
  
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: '👋 Hi! I\'m your AntiBurnout assistant. How can I help you today?' }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedModelKey, setSelectedModelKey] = useState<string>('')
  const [showHistory, setShowHistory] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
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
  // Load chat sessions when component opens
  useEffect(() => {
    if (isOpen && token) {
      console.log('[ChatOverlay] Fetching sessions...')
      dispatch(fetchSessions(token)).then((result) => {
        console.log('[ChatOverlay] Sessions loaded:', result.payload)
      }).catch((error) => {
        console.error('[ChatOverlay] Failed to fetch sessions:', error)
      })
    }
  }, [isOpen, token, dispatch])
  
  const loadSessionMessages = async (sessionId: string) => {
    if (!token) return
    
    try {
      const session = await dispatch(fetchSessionMessages({ token, sessionId })).unwrap()
      
      // Convert session messages to chat format
      const chatMessages = session.messages.flatMap((msg: any) => [
        { role: 'user' as const, content: msg.message },
        { role: 'assistant' as const, content: msg.response }
      ])
      
      setMessages(chatMessages)
      setActiveSessionId(sessionId)
      setShowHistory(false)
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
            setMessages([{ role: 'assistant', content: '👋 Hi! I\'m your AntiBurnout assistant. How can I help you today?' }])
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
          setMessages([{ role: 'assistant', content: '👋 Hi! I\'m your AntiBurnout assistant. How can I help you today?' }])
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
  
  // Auto-select first model if none selected
  if (!selectedModelKey && modelKeys.length > 0) {
    setSelectedModelKey(modelKeys[0])
  }
  
  // Get current model name
  const currentModel = selectedModelKey ? availableModels[selectedModelKey]?.model : 'AI'

  const handleSend = async () => {
    if (!input.trim() || !token) return

    const userMessage = input.trim()
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setInput('')
    setIsTyping(true)

    try {
      // Build conversation history (last 10 messages)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      // Call backend API with session_id
      const response = await axios.post(`${API_URL}/chat/send`, {
        message: userMessage,
        conversation_history: conversationHistory,
        model_key: selectedModelKey,
        session_id: activeSessionId || undefined  // Send session_id if exists
      }, {
        params: { token }
      })

      // Add AI response
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.data.response
      }])
      
      // Update active session ID from response (new session created)
      if (response.data.session_id && !activeSessionId) {
        setActiveSessionId(response.data.session_id)
        // Refresh sessions list
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
    setMessages([{ role: 'assistant', content: '👋 Hi! I\'m your AntiBurnout assistant. How can I help you today?' }])
    setActiveSessionId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4 transition-all duration-500 opacity-100 animate-in fade-in zoom-in-95">
      <div className="w-full max-w-[800px]  border border-white/10 rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <header className="px-8 pt-6 pb-4 flex justify-between items-center border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-xl">🤖</span>
            </div>
            <div className=' flex flex-col items-start'>
              <h2 className="text-xl font-light text-white tracking-tight">AntiBurnout Assistant</h2>
              <p className="text-xs text-green-200/50">Powered by {currentModel}</p>
            </div>
            
            {modelKeys.length > 1 && (
              <select
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent transition-all cursor-pointer"
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
            
            {/* History Button */}
            <button
              className="w-10 h-10 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-all duration-300 cursor-pointer"
              onClick={() => setShowHistory(!showHistory)}
              title="View Chat History"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
            </button>
            
            {/* New Chat Button */}
            <button
              className="w-10 h-10 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-all duration-300 cursor-pointer"
              onClick={startNewChat}
              title="Start New Chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
          <button 
            className="w-10 h-10 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-all duration-300 cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        {/* Chat History Panel */}
        {showHistory ? (
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-light text-white">Chat History</h3>
              <button
                className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                onClick={handleClearHistory}
                disabled={sessions.length === 0}
              >
                Clear All History
              </button>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="text-green-200/50">Loading history...</div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-green-200/40">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                <p className="mt-4 text-sm">No chat history yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-accent/30 transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-2 items-center">
                        <span className="text-[10px] text-accent font-medium">{session.message_count} messages</span>
                        <span className="text-[10px] text-green-200/40">•</span>
                        <span className="text-[10px] text-green-200/40">
                          {new Date(session.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSession(session.id)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <p className="text-sm text-white line-clamp-2 mb-1">{session.first_message}</p>
                    <p className="text-xs text-green-200/60 line-clamp-1">{session.last_message}</p>
                    <div 
                      className="mt-3 pt-3 border-t border-white/5 flex justify-center"
                      onClick={() => loadSessionMessages(session.id)}
                    >
                      <span className="text-xs text-accent/80 hover:text-accent transition-colors">Load Conversation</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Messages */
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 custom-scrollbar">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[70%] px-5 py-3 rounded-2xl text-start
                  ${msg.role === 'user' 
                    ? 'bg-accent/20 border border-accent/30 text-white' 
                    : 'bg-white/5 border border-white/10 text-green-200/80'
                  }
                `}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 px-5 py-3 rounded-2xl">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-green-200/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-green-200/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-green-200/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Input */}
        <div className="px-8 py-6 border-t border-white/5">
          <div className="flex gap-3">
            <input
              type="text"
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white text-sm focus:outline-none focus:border-accent transition-all placeholder:text-white/20"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
            />
            <button
              className="h-12 px-6 rounded-full bg-glass glass-blur border border-white/20 text-white font-medium hover:bg-accent hover:text-primary transition-all duration-300 cursor-pointer disabled:opacity-50"
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
            >
              Send
            </button>
          </div>
          <p className="text-[10px] text-green-200/30 mt-3 text-center">
            AI responses are generated based on your profile and break patterns
          </p>
        </div>
      </div>
    </div>
    
      {/* Confirmation Dialog */}
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
