import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch } from 'react-redux'
import { login as loginAction } from '../store/authSlice'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const getDeviceId = async (): Promise<string> => {
  if (window.electronAPI) {
    return await window.electronAPI.getMachineId()
  }
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
      dispatch(loginAction({ user: userData, token: access_token }))
      onClose()
    } catch (error) {
      console.error('Login failed:', error)
      alert('Login failed. Please check if the backend server is running.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="login-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 30 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[440px] rounded-[32px] overflow-hidden shadow-2xl"
        >
        {/* Gradient border effect */}
        <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-accent/30 via-transparent to-accent/10 p-px">
          <div className="w-full h-full rounded-[32px] bg-[#0a0f0a]" />
        </div>

        <div className="relative p-10 flex flex-col items-center text-center">
          {/* Ambient glow */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-80 bg-accent/8 blur-[100px] rounded-full pointer-events-none" />

          {/* Logo */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center shadow-[0_0_60px_rgba(74,222,128,0.15)]">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a0f0a" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>

          {/* Brand */}
          <h1 className="text-2xl font-light text-white tracking-tight mb-1">
            antiburnout<span className="text-accent font-normal">.ai</span>
          </h1>
          <p className="text-white/30 text-sm mb-8">Prevent digital burnout. Stay well.</p>

          {/* Device login button */}
          {isAuthenticating ? (
            <div className="w-full h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center gap-3 text-accent/70 text-sm font-medium">
              <div className="w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
              Connecting your device...
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="w-full h-14 rounded-2xl bg-accent/15 border border-accent/25 text-accent text-sm font-medium hover:bg-accent/25 hover:border-accent/40 transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer active:scale-[0.98]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Login with this device
            </button>
          )}

          <p className="text-white/20 text-xs mt-4 leading-relaxed">
            No password needed. Your device is your identity.
          </p>

          {/* Features */}
          <div className="mt-8 pt-6 border-t border-white/5 w-full grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <span className="text-[10px] text-white/25 font-medium uppercase tracking-wider">Instant</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <span className="text-[10px] text-white/25 font-medium uppercase tracking-wider">Encrypted</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </div>
              <span className="text-[10px] text-white/25 font-medium uppercase tracking-wider">Private</span>
            </div>
          </div>
        </div>
      </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  )
}

export default LoginModal
