import { useState, useEffect, useCallback } from 'react'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message?: string
  duration?: number
}

interface ToastProps {
  toasts: ToastMessage[]
  onRemove: (id: string) => void
}

function Toast({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 z-[10001] flex flex-col gap-3 max-w-sm">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastCard({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onRemove(toast.id), 300)
    }, toast.duration || 3000)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onRemove])

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return '✓'
      case 'error': return '✕'
      case 'info': return 'ℹ'
    }
  }

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-green-500/10',
          border: 'border-green-500/30',
          icon: 'text-green-400',
          title: 'text-green-400'
        }
      case 'error':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          icon: 'text-red-400',
          title: 'text-red-400'
        }
      case 'info':
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30',
          icon: 'text-blue-400',
          title: 'text-blue-400'
        }
    }
  }

  const colors = getColors()

  return (
    <div
      className={`
        ${colors.bg} ${colors.border} border rounded-xl p-4 shadow-2xl backdrop-blur-xl
        transition-all duration-300 cursor-pointer
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
      onClick={() => {
        setIsExiting(true)
        setTimeout(() => onRemove(toast.id), 300)
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`text-xl font-bold ${colors.icon}`}>{getIcon()}</div>
        <div className="flex-1">
          <h4 className={`text-sm font-semibold ${colors.title} mb-1`}>{toast.title}</h4>
          {toast.message && (
            <p className="text-xs text-green-200/60 leading-relaxed">{toast.message}</p>
          )}
        </div>
        <button className="text-white/30 hover:text-white/60 transition-colors cursor-pointer">
          ✕
        </button>
      </div>
    </div>
  )
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => [...prev, { ...toast, id }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const success = useCallback((title: string, message?: string, duration?: number) => {
    addToast({ type: 'success', title, message, duration })
  }, [addToast])

  const error = useCallback((title: string, message?: string, duration?: number) => {
    addToast({ type: 'error', title, message, duration })
  }, [addToast])

  const info = useCallback((title: string, message?: string, duration?: number) => {
    addToast({ type: 'info', title, message, duration })
  }, [addToast])

  return {
    toasts,
    removeToast,
    success,
    error,
    info
  }
}

export default Toast
