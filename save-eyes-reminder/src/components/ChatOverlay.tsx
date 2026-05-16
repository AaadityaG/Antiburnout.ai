import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
  const { token, user } = useSelector((state: RootState) => state.auth)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: '👋 Hi! I\'m your AntiBurnout assistant. How can I help you today?' }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedModelKey, setSelectedModelKey] = useState<string>('')
  const [chatHistory, setChatHistory] = useState<HistoryMessage[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  // Load chat history when component opens
  useEffect(() => {
    if (isOpen && token && !showHistory) {
      loadChatHistory()
    }
  }, [isOpen, token])
  
  const loadChatHistory = async () => {
    if (!token) return
    
    setIsLoadingHistory(true)
    try {
      const response = await axios.get(`${API_URL}/chat/history/`, {
        params: { token, limit: 50 }
      })
      setChatHistory(response.data)
      console.log(`Loaded ${response.data.length} chat history messages`)
    } catch (error) {
      console.error('Failed to load chat history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }
  
  const loadHistoryConversation = (historyItem: HistoryMessage) => {
    setMessages([
      { role: 'user', content: historyItem.message },
      { role: 'assistant', content: historyItem.response }
    ])
    setShowHistory(false)
  }
  
  const clearHistory = async () => {
    if (!token) return
    
    if (!window.confirm('Are you sure you want to clear all chat history?')) return
    
    try {
      await axios.delete(`${API_URL}/chat/history/clear`, {
        params: { token }
      })
      setChatHistory([])
      alert('Chat history cleared')
    } catch (error) {
      console.error('Failed to clear history:', error)
      alert('Failed to clear history')
    }
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

      // Call backend API
      const response = await axios.post(`${API_URL}/chat/send`, {
        message: userMessage,
        conversation_history: conversationHistory,
        model_key: selectedModelKey  // Send selected model
      }, {
        params: { token }
      })

      // Add AI response
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.data.response
      }])
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4 transition-all duration-500 opacity-100 animate-in fade-in zoom-in-95">
      <div className="w-full max-w-[800px] bg-glass-heavy border border-white/10 rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
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
                onClick={clearHistory}
                disabled={chatHistory.length === 0}
              >
                Clear All History
              </button>
            </div>
            
            {isLoadingHistory ? (
              <div className="flex justify-center py-12">
                <div className="text-green-200/50">Loading history...</div>
              </div>
            ) : chatHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-green-200/40">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                <p className="mt-4 text-sm">No chat history yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {chatHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-accent/30 transition-all cursor-pointer group"
                    onClick={() => loadHistoryConversation(item)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] text-accent font-medium">{item.model}</span>
                      <span className="text-[10px] text-green-200/40">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-white line-clamp-2 mb-1">{item.message}</p>
                    <p className="text-xs text-green-200/60 line-clamp-1">{item.response}</p>
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
  )
}

export default ChatOverlay
