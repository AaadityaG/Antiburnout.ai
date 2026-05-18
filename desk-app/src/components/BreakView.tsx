import { useSelector } from 'react-redux'
import type { RootState } from '../store'

interface BreakViewProps {
  isActive: boolean
  timeLeft: number
  onEnd: () => void
}

function BreakView({ isActive, timeLeft, onEnd }: BreakViewProps) {
  const { currentTip, isLoading } = useSelector((state: RootState) => state.tips)

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      eyes: '👁️',
      stress: '🧘',
      posture: '🧍',
      mindfulness: '🧠',
      hydration: '💧',
      movement: '🚶'
    }
    return icons[category] || '💡'
  }

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      eyes: 'text-blue-300',
      stress: 'text-purple-300',
      posture: 'text-orange-300',
      mindfulness: 'text-cyan-300',
      hydration: 'text-blue-200',
      movement: 'text-green-300'
    }
    return colors[category] || 'text-accent'
  }

  if (!isActive) return null

  return (
    <div className="fixed inset-0 bg-bg-dark z-1000 flex justify-center items-center transition-opacity duration-1000 opacity-100">
      <div className="text-center animate-in zoom-in-95 duration-1000 max-w-3xl mx-auto px-8">
        <div className="text-8xl mb-8 drop-shadow-[0_0_20px_var(--color-accent)]">🌿</div>
        <h2 className="text-6xl font-extralight mb-6 text-accent tracking-tight">Time to Rest</h2>
        <div className="font-mono text-[10rem] font-extralight my-10 text-white leading-none tracking-tighter">
          {timeLeft}
        </div>
        <p className="text-green-200/40 tracking-[0.3em] uppercase text-xs mb-12">Focus on the horizon • Blink often</p>
        
        {/* Tip Recommendation Section */}
        {currentTip && (
          <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-glass glass-blur border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="text-3xl">{getCategoryIcon(currentTip.category)}</span>
                <span className={`text-xs font-bold uppercase tracking-[0.2em] ${getCategoryColor(currentTip.category)}`}>
                  {currentTip.category}
                </span>
                <span className="text-white/40">•</span>
                <span className="text-white/60 text-xs">{currentTip.duration}</span>
              </div>
              
              <h3 className="text-2xl font-light text-white mb-2">{currentTip.tip}</h3>
              <p className="text-white/70 text-base leading-relaxed">
                {currentTip.instruction}
              </p>
            </div>
          </div>
        )}

        {isLoading && !currentTip && (
          <div className="mb-10 text-white/50 text-sm animate-pulse">
            Preparing your wellness tip...
          </div>
        )}

        <button 
          className="px-10 h-16 rounded-full bg-glass glass-blur border border-white/20 text-white font-medium text-lg hover:bg-accent hover:text-primary transition-all duration-300 cursor-pointer shadow-2xl active:scale-[0.98]"
          onClick={onEnd}
        >
          I'm Refreshed 
        </button>
      </div>
    </div>
  )
}

export default BreakView
