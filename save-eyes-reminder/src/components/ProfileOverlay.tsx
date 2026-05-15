import { useState, useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { login as loginAction, logout as logoutAction, updateAIProviders } from '../store/authSlice'
import type { RootState, AppDispatch } from '../store'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
  },
  google: {
    name: 'Google (Gemini)',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
  },
  mistral: {
    name: 'Mistral AI',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest']
  }
}

function ProfileOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dispatch = useDispatch<AppDispatch>()
  const { user, token } = useSelector((state: RootState) => state.auth)
  
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [showAIAddForm, setShowAIAddForm] = useState(false)
  const [aiProviderInput, setAiProviderInput] = useState({ provider: '', model: '', api_key: '' })

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '')
      setProfileEmail(user.email || '')
    }
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
      alert('Profile updated')
    } catch (error) {
      console.error('Failed to save profile:', error)
      alert('Failed to save profile')
    } finally {
      setIsSavingProfile(false)
    }
  }, [token, profileName, profileEmail, dispatch])

  const saveAIProvider = useCallback(async () => {
    if (!token || !aiProviderInput.provider || !aiProviderInput.model || !aiProviderInput.api_key) {
      alert('Please fill in all fields')
      return
    }
    
    setIsSavingProfile(true)
    try {
      const providerKey = aiProviderInput.provider
      const aiProviders = {
        [providerKey]: {
          provider: aiProviderInput.provider,
          model: aiProviderInput.model,
          api_key: aiProviderInput.api_key
        }
      }
      
      const response = await axios.put(`${API_URL}/auth/profile`, {
        ai_providers: aiProviders
      }, {
        params: { token }
      })

      const updatedUser = response.data
      dispatch(updateAIProviders({ 
        ai_providers: updatedUser.ai_providers,
        profile_completed: updatedUser.profile_completed
      }))
      
      setAiProviderInput({ provider: '', model: '', api_key: '' })
      setShowAIAddForm(false)
    } catch (error) {
      console.error('Failed to save AI provider:', error)
      alert('Failed to save AI provider')
    } finally {
      setIsSavingProfile(false)
    }
  }, [token, aiProviderInput, dispatch])

  const handleLogout = useCallback(() => {
    if (window.confirm('Are you sure you want to logout?')) {
      dispatch(logoutAction())
      onClose()
    }
  }, [dispatch, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4 transition-all duration-500 opacity-100 animate-in fade-in zoom-in-95">
      <div className="w-full max-w-[900px] bg-glass-heavy border border-white/10 rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <header className="px-10 pt-8 pb-6 flex justify-between items-center border-b border-white/5">
          <div className="flex flex-col items-start">
            <h2 className="text-3xl font-extralight text-white tracking-tight">Profile Settings</h2>
            <p className="text-sm text-green-200/50 mt-1 font-light">Edit your account </p>
          </div>
          <button 
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center transition-all duration-300 cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-10 py-8 custom-scrollbar">
          <div className="flex flex-col lg:flex-row gap-8 items-stretch">
            
            {/* Left Column: AI Providers */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[20px] h-full">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">AI Providers</h3>
                  {!showAIAddForm && (
                    <button 
                      className="text-xs font-semibold px-4 py-1.5 rounded-full border border-accent text-accent hover:bg-accent hover:text-primary transition-all duration-300"
                      onClick={() => setShowAIAddForm(true)}
                    >
                      + Add Provider
                    </button>
                  )}
                </div>

                {showAIAddForm && (
                  <div className="p-5 bg-white/5 border border-white/10 rounded-2xl mb-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase tracking-wider text-green-200/50">Provider</label>
                        <select 
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-accent transition-all"
                          value={aiProviderInput.provider}
                          onChange={(e) => setAiProviderInput({ ...aiProviderInput, provider: e.target.value, model: '' })}
                        >
                          <option value="" className="bg-bg-dark">Select...</option>
                          {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                            <option key={key} value={key} className="bg-bg-dark">{provider.name}</option>
                          ))}
                        </select>
                      </div>
                      {aiProviderInput.provider && (
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] uppercase tracking-wider text-green-200/50">Model</label>
                          <select 
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-accent transition-all"
                            value={aiProviderInput.model}
                            onChange={(e) => setAiProviderInput({ ...aiProviderInput, model: e.target.value })}
                          >
                            <option value="" className="bg-bg-dark">Select...</option>
                            {AI_PROVIDERS[aiProviderInput.provider as keyof typeof AI_PROVIDERS].models.map(model => (
                              <option key={model} value={model} className="bg-bg-dark">{model}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 mb-6">
                      <label className="text-[10px] uppercase tracking-wider text-green-200/50">API Key</label>
                      <input 
                        type="password"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-accent transition-all"
                        value={aiProviderInput.api_key}
                        onChange={(e) => setAiProviderInput({ ...aiProviderInput, api_key: e.target.value })}
                        placeholder="sk-..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <button 
                        className="flex-1 h-10 bg-white text-bg-dark font-bold rounded-xl hover:bg-accent transition-all disabled:opacity-50"
                        onClick={saveAIProvider}
                        disabled={isSavingProfile || !aiProviderInput.provider || !aiProviderInput.model || !aiProviderInput.api_key}
                      >
                        {isSavingProfile ? 'Saving...' : 'Connect'}
                      </button>
                      <button 
                        className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 flex items-center justify-center transition-all"
                        onClick={() => setShowAIAddForm(false)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {user?.ai_providers && Object.keys(user.ai_providers).length > 0 ? (
                    Object.entries(user.ai_providers).map(([key, provider]) => (
                      <div key={key} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl flex justify-between items-center group hover:border-accent/30 transition-all duration-300">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">{AI_PROVIDERS[key as keyof typeof AI_PROVIDERS]?.name || key}</span>
                          <span className="text-[10px] font-mono text-green-200/40 mt-0.5">{provider.model}</span>
                        </div>
                        <span className="text-[10px] font-bold text-accent uppercase tracking-wider">✓ Connected</span>
                      </div>
                    ))
                  ) : !showAIAddForm && (
                    <div className="py-10 flex flex-col items-center justify-center text-white/20 border border-dashed border-white/10 rounded-2xl">
                      <p className="text-xs italic tracking-wide">No active providers</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Info & Status */}
            <div className="flex-1 flex flex-col gap-6">
              

              <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[20px] flex-1">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-6">Personal Details</h3>
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-wider text-green-200/50">Name (Optional)</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white text-lg font-light focus:outline-none focus:border-accent transition-all placeholder:text-white/10"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="asdfasdf"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-wider text-green-200/50">Email (Optional)</label>
                    <input 
                      type="email" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white text-lg font-light focus:outline-none focus:border-accent transition-all placeholder:text-white/10"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-10">
                  <button 
                    className="flex-1 h-14 bg-white text-bg-dark font-bold text-base rounded-2xl hover:bg-accent transition-all shadow-lg active:scale-[0.98]"
                    onClick={saveProfile} 
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                  <button 
                    className="w-14 h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white flex items-center justify-center transition-all active:scale-[0.98]"
                    onClick={onClose}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <button 
                // className="text-[11px] font-medium text-red-500/60 hover:text-red-500 hover:underline transition-all w-fit mt-auto"
                    className="w-auto h-14 bg-white/5 hover:bg-red-200/10 cursor-pointer  text-red-500/60 hover:text-red-500 border border-white/10 rounded-2xl  flex items-center justify-center transition-all active:scale-[0.98]"

                onClick={handleLogout}
              >
                Logout Session
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default ProfileOverlay

