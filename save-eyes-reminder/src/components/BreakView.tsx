interface BreakViewProps {
  isActive: boolean
  timeLeft: number
  onEnd: () => void
}

function BreakView({ isActive, timeLeft, onEnd }: BreakViewProps) {
  if (!isActive) return null

  return (
    <div className="fixed inset-0 bg-bg-dark z-[1000] flex justify-center items-center transition-opacity duration-1000 opacity-100">
      <div className="text-center animate-in zoom-in-95 duration-1000">
        <div className="text-8xl mb-8 drop-shadow-[0_0_20px_var(--color-accent)]">🌿</div>
        <h2 className="text-6xl font-extralight mb-6 text-accent tracking-tight">Time to Rest</h2>
        <div className="font-mono text-[10rem] font-extralight my-10 text-white leading-none tracking-tighter">
          {timeLeft}
        </div>
        <p className="text-green-200/40 tracking-[0.3em] uppercase text-xs mb-12">Focus on the horizon • Blink often</p>
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
