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
    <div className={`settings-overlay ${isOpen ? 'active' : ''}`} id="login-modal" style={{ zIndex: 9999 }}>
      <div className="settings-content">
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{
            width: '100px',
            height: '100px',
            margin: '0 auto 30px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '50px',
            boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)'
          }}>
            👁️
          </div>
          
          <h2 className="settings-header" style={{ fontSize: '32px', marginBottom: '10px' }}>Welcome to Save Eyes</h2>
          <p style={{ color: '#88a088', marginBottom: '40px', fontSize: '16px' }}>
            One-click login to protect your vision
          </p>

          {isAuthenticating ? (
            <div style={{ padding: '20px', color: '#4ade80' }}>
              <p style={{ fontSize: '18px' }}>🔄 Authenticating...</p>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="action-btn primary"
              style={{ width: '100%', height: '70px', fontSize: '18px', fontWeight: 600 }}
            >
              🔐 Login with Device
            </button>
          )}

          <p style={{ color: '#666', fontSize: '13px', marginTop: '30px', lineHeight: '1.8' }}>
            ✨ One account per device<br/>
            ⚡ Instant authentication<br/>
            🔒 Secure & private
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginModal
