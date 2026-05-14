import { useState } from 'react'
import axios from 'axios'

const API_URL = 'http://localhost:8000'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: (user: any, token: string) => void
}

// Generate unique device ID
const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('device_id')
  if (!deviceId) {
    deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('device_id', deviceId)
  }
  return deviceId
}

function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const handleLogin = async () => {
    setIsAuthenticating(true)
    try {
      const deviceId = getDeviceId()
      const deviceName = navigator.platform || 'Unknown Device'

      const response = await axios.post(`${API_URL}/auth/device`, {
        device_id: deviceId,
        device_name: deviceName,
      })

      const { access_token, user: userData } = response.data
      
      onLoginSuccess(userData, access_token)
    } catch (error) {
      console.error('Login failed:', error)
      alert('Login failed. Please check if the backend server is running.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className={`settings-overlay ${isOpen ? 'active' : ''}`} id="login-modal">
      <div className="settings-content">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
          }}>
            🔐
          </div>
          
          <h2 className="settings-header">Login Required</h2>
          <p style={{ color: '#88a088', marginBottom: '30px' }}>
            This feature requires authentication
          </p>

          {isAuthenticating ? (
            <div style={{ padding: '20px', color: '#4ade80' }}>
              <p>🔄 Logging you in...</p>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="action-btn primary"
              style={{ width: '100%', height: '60px', marginBottom: '15px' }}
            >
              Login with Device
            </button>
          )}

          <button 
            className="action-btn primary" 
            onClick={onClose}
            style={{ width: '100%', height: '60px' }}
          >
            Cancel
          </button>

          <p style={{ color: '#666', fontSize: '12px', marginTop: '20px', lineHeight: '1.6' }}>
            ✨ One account per device<br/>
            🚀 Fast & secure authentication
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginModal
