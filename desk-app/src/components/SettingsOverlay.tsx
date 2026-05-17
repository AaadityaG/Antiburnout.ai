import { useState, useEffect } from 'react'

interface SettingsOverlayProps {
  isOpen: boolean
  onClose: () => void
  initialInterval: number
  initialDuration: number
  onApply: (interval: number, duration: number) => void
}

function SettingsOverlay({ isOpen, onClose, initialInterval, initialDuration, onApply }: SettingsOverlayProps) {
  const [localInterval, setLocalInterval] = useState(initialInterval)
  const [localDuration, setLocalDuration] = useState(initialDuration)

  useEffect(() => {
    if (isOpen) {
      setLocalInterval(initialInterval)
      setLocalDuration(initialDuration)
    }
  }, [isOpen, initialInterval, initialDuration])

  const handleApply = () => {
    onApply(localInterval, localDuration)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4 transition-all duration-500 opacity-100 animate-in fade-in zoom-in-95">
      <div className="w-full max-w-[500px]  border border-white/10 rounded-[32px] p-10 shadow-2xl">
        <h2 className="text-4xl font-extralight text-white text-center mb-10">Settings</h2>
        
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-green-200/50">Break Interval (Minutes)</label>
            <input 
              type="number" 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white text-lg focus:outline-none focus:border-accent cursor-text"
              value={localInterval}
              onChange={(e) => setLocalInterval(parseInt(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-widest text-green-200/50">Rest Duration (Seconds)</label>
            <input 
              type="number" 
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white text-lg focus:outline-none focus:border-accent cursor-text"
              value={localDuration}
              onChange={(e) => setLocalDuration(parseInt(e.target.value))}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-10">
          <button className="flex-1 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white font-medium hover:bg-accent hover:text-primary transition-all duration-300 cursor-pointer" onClick={handleApply}>Apply</button>
          <button className="w-14 h-14 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-all duration-300 cursor-pointer" onClick={onClose}>✕</button>
        </div>
      </div>
    </div>
  )
}

export default SettingsOverlay
