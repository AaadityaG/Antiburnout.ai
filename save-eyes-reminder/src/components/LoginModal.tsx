import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { login as loginAction } from '../store/authSlice'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Get unique machine ID from Electron or fallback for browser
const getDeviceId = async (): Promise<string> => {
  if (window.electronAPI) {
    return await window.electronAPI.getMachineId()
  }
  // Fallback for browser testing - use stored ID
  let deviceId = localStorage.getItem('device_id')
  if (!deviceId) {
    deviceId = 'browser_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('device_id', deviceId)
  }
  return deviceId
}

function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const dispatch = useDispatch()

  const handleLogin = async () => {
    setIsAuthenticating(true)
    try {
      const deviceId = await getDeviceId()
      const deviceName = navigator.platform || 'Unknown Device'

      const response = await axios.post(`${API_URL}/auth/device`, {
        device_id: deviceId,
        device_name: deviceName,
      })

      const { access_token, user: userData } = response.data
      
      // Dispatch Redux login action
      dispatch(loginAction({ user: userData, token: access_token }))
      
      // Close modal after successful login
      onClose()
    } catch (error) {
      console.error('Login failed:', error)
      alert('Login failed. Please check if the backend server is running.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="w-full max-w-[480px] bg-glass-heavy border border-white/10 rounded-[40px] p-10 shadow-2xl relative overflow-hidden group">
        
        {/* Background Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/20 blur-[80px] group-hover:bg-accent/30 transition-all duration-700"></div>
        
        <div className="relative flex flex-col items-center text-center">
          <div className="w-24 h-24 mb-8 rounded-3xl bg-gradient-to-br from-primary to-accent/50 flex items-center justify-center text-5xl shadow-[0_10px_40px_rgba(74,222,128,0.2)] animate-breathe">
            👁️
          </div>
          
          <h2 className="text-4xl font-extralight text-white tracking-tight mb-3">Save Eyes</h2>
          <p className="text-green-200/50 text-base font-light mb-10">
            One-click login to protect your vision
          </p>

          {isAuthenticating ? (
            <div className="h-[70px] flex items-center justify-center gap-3 text-accent font-medium">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
              <span>Authenticating...</span>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="w-full h-[70px] bg-white text-bg-dark text-lg font-bold rounded-2xl hover:bg-accent transition-all duration-300 shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
            >
              <span>🔐</span> Login with Device
            </button>
          )}

          <div className="mt-10 pt-10 border-t border-white/5 w-full grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Fast</span>
              <span className="text-lg">⚡</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Secure</span>
              <span className="text-lg">🔒</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Private</span>
              <span className="text-lg">✨</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginModal

