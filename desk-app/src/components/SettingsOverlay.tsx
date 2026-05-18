import { useState, useEffect } from 'react'
import { fromTotalSeconds, toTotalSeconds } from '../store/settingsSlice'
import { useToast } from '../context/ToastContext'

interface SettingsOverlayProps {
  isOpen: boolean
  onClose: () => void
  initialInterval: number  // in seconds
  initialDuration: number  // in seconds
  enableSound: boolean
  onApply: (interval: number, duration: number, enableSound: boolean) => void  // expects seconds
}

interface TimeInput {
  hours: number
  minutes: number
  seconds: number
}

function clamp(val: string, min: number, max: number): number {
  const n = parseInt(val)
  if (isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}

function SettingsOverlay({ isOpen, onClose, initialInterval, initialDuration, enableSound: initialEnableSound, onApply }: SettingsOverlayProps) {
  const toast = useToast()
  const initialIntervalTime = fromTotalSeconds(initialInterval)
  const initialDurationTime = fromTotalSeconds(initialDuration)

  const [intervalTime, setIntervalTime] = useState<TimeInput>(initialIntervalTime)
  const [durationTime, setDurationTime] = useState<TimeInput>(initialDurationTime)
  const [enableSound, setEnableSound] = useState(initialEnableSound)

  useEffect(() => {
    if (isOpen) {
      setIntervalTime(fromTotalSeconds(initialInterval))
      setDurationTime(fromTotalSeconds(initialDuration))
      setEnableSound(initialEnableSound)
    }
  }, [isOpen, initialInterval, initialDuration, initialEnableSound])

  const handleApply = () => {
    const intervalSeconds = toTotalSeconds(intervalTime.hours, intervalTime.minutes, intervalTime.seconds)
    const durationSeconds = toTotalSeconds(durationTime.hours, durationTime.minutes, durationTime.seconds)

    // Validation: minimum 30 seconds
    if (intervalSeconds < 30 || durationSeconds < 30) {
      toast.error('Invalid Duration', 'Both break interval and break duration must be at least 30 seconds.')
      return
    }

    console.log('SettingsOverlay - Applying settings:', { 
      intervalTime, 
      durationTime, 
      finalInterval: intervalSeconds, 
      finalDuration: durationSeconds,
      enableSound
    })

    onApply(intervalSeconds, durationSeconds, enableSound)
    onClose()
  }

  const formatPreview = (t: TimeInput) => {
    const parts: string[] = []
    if (t.hours > 0) parts.push(`${t.hours}h`)
    if (t.minutes > 0) parts.push(`${t.minutes}m`)
    if (t.seconds > 0) parts.push(`${t.seconds}s`)
    return parts.length > 0 ? parts.join(' ') : '0s'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4 transition-all duration-500 opacity-100 animate-in fade-in zoom-in-95">
      <div className="w-full max-w-[600px] border border-white/10 rounded-[32px] shadow-2xl">
        <div className="px-10 pt-8 pb-6 flex items-center justify-between border-b border-white/5">
          <div>
            <h2 className="text-3xl font-extralight text-white tracking-tight">Settings</h2>
            <p className="text-xs text-green-200/50 mt-1">Customize your timers</p>
          </div>
          <button
            className="w-9 h-9 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="px-10 pt-8 pb-6">
          {/* Break Interval */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-200/50">Break Interval</label>
              <span className="text-xs text-accent/60 font-medium">{formatPreview(intervalTime)}</span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-green-200/30 block text-center mb-2">Hours</label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-center text-xl font-light focus:outline-none focus:border-accent cursor-text"
                  value={intervalTime.hours}
                  onChange={(e) => setIntervalTime(prev => ({ ...prev, hours: clamp(e.target.value, 0, 99) }))}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-green-200/30 block text-center mb-2">Minutes</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-center text-xl font-light focus:outline-none focus:border-accent cursor-text"
                  value={intervalTime.minutes}
                  onChange={(e) => setIntervalTime(prev => ({ ...prev, minutes: clamp(e.target.value, 0, 59) }))}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-green-200/30 block text-center mb-2">Seconds</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-center text-xl font-light focus:outline-none focus:border-accent cursor-text"
                  value={intervalTime.seconds}
                  onChange={(e) => setIntervalTime(prev => ({ ...prev, seconds: clamp(e.target.value, 0, 59) }))}
                />
              </div>
            </div>
          </div>

          {/* Rest Duration */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-200/50">Rest Duration</label>
              <span className="text-xs text-accent/60 font-medium">{formatPreview(durationTime)}</span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-green-200/30 block text-center mb-2">Hours</label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-center text-xl font-light focus:outline-none focus:border-accent cursor-text"
                  value={durationTime.hours}
                  onChange={(e) => setDurationTime(prev => ({ ...prev, hours: clamp(e.target.value, 0, 99) }))}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-green-200/30 block text-center mb-2">Minutes</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-center text-xl font-light focus:outline-none focus:border-accent cursor-text"
                  value={durationTime.minutes}
                  onChange={(e) => setDurationTime(prev => ({ ...prev, minutes: clamp(e.target.value, 0, 59) }))}
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-green-200/30 block text-center mb-2">Seconds</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-center text-xl font-light focus:outline-none focus:border-accent cursor-text"
                  value={durationTime.seconds}
                  onChange={(e) => setDurationTime(prev => ({ ...prev, seconds: clamp(e.target.value, 0, 59) }))}
                />
              </div>
            </div>
          </div>

          {/* Sound Toggle */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-200/50">Countdown Sound</label>
              <span className="text-xs text-accent/60 font-medium">{enableSound ? 'Enabled' : 'Disabled'}</span>
            </div>
            <button
              className={`w-full h-14 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between px-6 ${
                enableSound 
                  ? 'bg-accent/10 border-accent/30' 
                  : 'bg-white/5 border-white/10'
              }`}
              onClick={() => setEnableSound(!enableSound)}
            >
              <span className="text-sm text-white/70">Play tone at last second</span>
              <div className={`w-12 h-6 rounded-full transition-all duration-300 relative ${
                enableSound ? 'bg-primary' : 'bg-white/20'
              }`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${
                  enableSound ? 'left-7' : 'left-1'
                }`} />
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-6 border-t border-white/5 flex items-center justify-between">
          <p className="text-[10px] text-green-200/30">
            Interval: {formatPreview(intervalTime)} → Duration: {formatPreview(durationTime)}
          </p>
          <button
            className="h-14 rounded-full bg-glass glass-blur border border-white/20 text-white font-medium px-10 hover:bg-accent hover:text-primary cursor-pointer"
            onClick={handleApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsOverlay
