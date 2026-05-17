import { useState, useCallback, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { login as loginAction, logout as logoutAction, updateAIProviders } from '../store/authSlice'
import type { RootState, AppDispatch } from '../store'
import axios from 'axios'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from '../context/ToastContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const OPENROUTER_MODELS = [
  { id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B (Free)', provider: 'Meta', isFree: true },
  { id: 'google/gemma-7b-it:free', name: 'Gemma 7B (Free)', provider: 'Google', isFree: true },
  { id: 'microsoft/phi-3-medium-128k-instruct:free', name: 'Phi-3 Medium (Free)', provider: 'Microsoft', isFree: true },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', isFree: false },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', isFree: false },
  { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', provider: 'Google', isFree: false },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'Meta', isFree: false },
]

const CUSTOM_MODEL_OPTION = { id: 'custom', name: 'Custom Model (Advanced)', provider: 'Custom', isFree: false }

function ProfileOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dispatch = useDispatch<AppDispatch>()
  const { user, token } = useSelector((state: RootState) => state.auth)
  const { success, error } = useToast()
  
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [showAIAddForm, setShowAIAddForm] = useState(false)
  const [aiProviderInput, setAiProviderInput] = useState({ provider: 'openrouter', model: '', api_key: '' })
  const [showCustomModelInput, setShowCustomModelInput] = useState(false)
  const [customModelId, setCustomModelId] = useState('')
  
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<string>('')

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '')
      setProfileEmail(user.email || '')
    }
  }, [user])

  const hasChanges = useMemo(() => {
    if (!user) return false
    return profileName !== (user.name || '') || profileEmail !== (user.email || '')
  }, [user, profileName, profileEmail])

  const hasProviders = user?.ai_providers && Object.keys(user.ai_providers).length > 0

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
      success('Profile Updated', 'Your profile has been saved successfully')
    } catch (error) {
      console.error('Failed to save profile:', error)
      error('Update Failed', 'Could not save your profile. Please try again.')
    } finally {
      setIsSavingProfile(false)
    }
  }, [token, profileName, profileEmail, dispatch])

  const saveAIProvider = useCallback(async () => {
    if (!token || !aiProviderInput.api_key) {
      error('Missing API Key', 'Please provide your OpenRouter API key')
      return
    }
    
    setIsSavingProfile(true)
    try {
      const selectedModels = showCustomModelInput && customModelId 
        ? [customModelId]
        : [
            'openai/gpt-4o-mini',
            'anthropic/claude-3-haiku',
            'meta-llama/llama-3.1-70b-instruct'
          ]
      
      const aiProviders: any = {}
      selectedModels.forEach((model, index) => {
        const key = showCustomModelInput && customModelId ? 'custom' : `model_${index + 1}`
        aiProviders[key] = {
          provider: 'openrouter',
          model: model,
          api_key: aiProviderInput.api_key
        }
      })
      
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
      
      setAiProviderInput({ provider: 'openrouter', model: '', api_key: '' })
      setShowAIAddForm(false)
      setShowCustomModelInput(false)
      setCustomModelId('')
      success('AI Providers Connected', `${selectedModels.length} models added successfully. You can switch between them while chatting!`)
    } catch (err) {
      console.error('Failed to save AI provider:', err)
      error('Connection Failed', 'Could not save AI providers')
    } finally {
      setIsSavingProfile(false)
    }
  }, [token, aiProviderInput, dispatch, success, error, showCustomModelInput, customModelId])

  const deleteAIProvider = useCallback((providerKey: string) => {
    setProviderToDelete(providerKey)
    setShowDeleteDialog(true)
  }, [])

  const confirmDeleteProvider = useCallback(async () => {
    if (!token || !providerToDelete) return

    setIsSavingProfile(true)
    setShowDeleteDialog(false)
    try {
      const aiProviders = {
        [providerToDelete]: {
          provider: '',
          model: '',
          api_key: ''
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
      success('Provider Removed', 'AI provider has been removed')
    } catch (err) {
      console.error('Failed to delete AI provider:', err)
      error('Delete Failed', 'Could not remove AI provider')
    } finally {
      setIsSavingProfile(false)
      setProviderToDelete('')
    }
  }, [token, providerToDelete, dispatch])

  const handleLogout = useCallback(() => {
    setShowLogoutDialog(true)
  }, [])

  const confirmLogout = useCallback(() => {
    dispatch(logoutAction())
    setShowLogoutDialog(false)
    onClose()
  }, [dispatch, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4">
      <div className="w-full max-w-[900px] border border-white/10 rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <header className="px-10 pt-8 pb-6 flex justify-between items-center border-b border-white/5">
          <div className="flex flex-col items-start">
            <h2 className="text-3xl font-extralight text-white tracking-tight">Profile Settings</h2>
            <p className="text-sm text-green-200/50 mt-1 font-light">Edit your account</p>
          </div>
          <button 
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center cursor-pointer"
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
                  {!hasProviders && !showAIAddForm && (
                    <button 
                      className="text-xs font-semibold px-4 py-1.5 rounded-full border border-accent text-accent hover:bg-accent hover:text-primary cursor-pointer"
                      onClick={() => setShowAIAddForm(true)}
                    >
                      + Add Provider
                    </button>
                  )}
                </div>

                {showAIAddForm && (
                  <div className="p-5 bg-white/5 border border-white/10 rounded-2xl mb-6">
                    <div className="mb-4 p-3 bg-accent/10 border border-accent/20 rounded-xl">
                      <p className="text-xs text-green-200/70">🔑 Paste your OpenRouter API key below. This will automatically add 4 models (including free options) that you can switch between while chatting!</p>
                      <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline mt-1 inline-block">Get your free API key →</a>
                    </div>
                    
                    <div className="flex flex-col gap-2 mb-6">
                      <label className="text-[10px] uppercase tracking-wider text-green-200/50">OpenRouter API Key</label>
                      <input 
                        type="password"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-accent"
                        value={aiProviderInput.api_key}
                        onChange={(e) => setAiProviderInput({ ...aiProviderInput, api_key: e.target.value })}
                        placeholder="sk-or-v1-..."
                      />
                      <p className="text-[10px] text-green-200/40">Models to be added: GPT-4o Mini, Claude 3 Haiku, Llama 3.1 70B</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        className="flex-1 h-10 rounded-full bg-glass glass-blur border border-white/20 text-white font-medium hover:bg-accent hover:text-primary cursor-pointer disabled:opacity-50"
                        onClick={saveAIProvider}
                        disabled={isSavingProfile || !aiProviderInput.api_key}
                      >
                        {isSavingProfile ? 'Saving...' : 'Connect All Models'}
                      </button>
                      <button 
                        className="w-10 h-10 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary cursor-pointer"
                        onClick={() => {
                          setShowAIAddForm(false)
                          setShowCustomModelInput(false)
                          setCustomModelId('')
                          setAiProviderInput({ provider: 'openrouter', model: '', api_key: '' })
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {hasProviders ? (
                    Object.entries(user.ai_providers as Record<string, any>).map(([key, provider]) => (
                      <div key={key} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl flex justify-between items-center hover:border-accent/30">
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium text-white">OpenRouter</span>
                          <span className="text-[10px] font-mono text-green-200/40 mt-0.5">{provider.model}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            className="w-8 h-8 rounded-full bg-glass glass-blur border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/50 flex items-center justify-center cursor-pointer"
                            onClick={() => deleteAIProvider(key)}
                            title="Remove provider"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
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

            {/* Right Column: Personal Details */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[20px] flex-1">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-6">Personal Details</h3>
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-wider text-green-200/50">Name (Optional)</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white text-lg font-light focus:outline-none focus:border-accent placeholder:text-white/10"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="name"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-wider text-green-200/50">Email (Optional)</label>
                    <input 
                      type="email" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white text-lg font-light focus:outline-none focus:border-accent placeholder:text-white/10"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer Actions */}
        <footer className="px-10 py-6 border-t border-white/5 flex items-center justify-between">
          <button 
            className="h-14 rounded-full bg-glass glass-blur border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/50 font-medium px-8 cursor-pointer"
            onClick={handleLogout}
          >
            Logout
          </button>
          <button 
            className="h-14 rounded-full bg-glass glass-blur border border-white/20 text-white font-medium hover:bg-accent hover:text-primary px-8 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={saveProfile} 
            disabled={isSavingProfile || !hasChanges}
          >
            {isSavingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </footer>
      </div>

      <ConfirmDialog
        isOpen={showLogoutDialog}
        title="Logout Session"
        message="Are you sure you want to logout? You'll need to login again to use the app."
        confirmText="Logout"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutDialog(false)}
      />

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Remove AI Provider"
        message="Are you sure you want to remove this AI provider? This action cannot be undone."
        confirmText="Remove"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDeleteProvider}
        onCancel={() => {
          setShowDeleteDialog(false)
          setProviderToDelete('')
        }}
      />
    </div>
  )
}

export default ProfileOverlay
