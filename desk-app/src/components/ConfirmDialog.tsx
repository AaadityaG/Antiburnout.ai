import { useEffect } from 'react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  useEffect(() => {
    if (isOpen) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel()
      }
      window.addEventListener('keydown', handleEsc)
      return () => window.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <div className="relative w-full max-w-md bg-glass-heavy border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-light text-white mb-3">{title}</h3>
        <p className="text-sm text-green-200/60 mb-8 leading-relaxed">{message}</p>
        
        <div className="flex gap-3">
          <button
            className="flex-1 h-12 rounded-full bg-glass glass-blur border border-white/20 text-white font-medium hover:bg-white/10 transition-all duration-300 cursor-pointer"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            className={`flex-1 h-12 rounded-full font-medium transition-all duration-300 cursor-pointer ${
              confirmVariant === 'danger'
                ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300'
                : 'bg-glass glass-blur border border-white/20 text-white hover:bg-accent hover:text-primary'
            }`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
