import { useState } from 'react'
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

function ChatOverlay({ isOpen, onClose }: ChatOverlayProps) {
  const { token, user } = useSelector((state: RootState) => state.auth)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: '👋 Hi! I\'m your AntiBurnout assistant. How can I help you today?' }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedModelKey, setSelectedModelKey] = useState<string>('')
  
  // Get available models from user's AI providers
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
          </div>
          <button 
            className="w-10 h-10 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-all duration-300 cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        {/* Messages */}
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
