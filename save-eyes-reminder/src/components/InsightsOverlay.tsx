interface InsightsOverlayProps {
  isOpen: boolean
  onClose: () => void
}

function InsightsOverlay({ isOpen, onClose }: InsightsOverlayProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4 transition-all duration-500 opacity-100 animate-in fade-in zoom-in-95">
      <div className="w-full max-w-[500px] bg-glass-heavy border border-white/10 rounded-[32px] p-10 shadow-2xl text-center">
        <h2 className="text-4xl font-extralight text-white mb-6">Insights</h2>
        <div className="text-6xl mb-6">📊</div>
        <p className="text-green-200/50 mb-10 text-lg">Coming Soon...<br/>Track your break history and eye health stats here.</p>
        <button className="w-full h-14 rounded-full bg-glass glass-blur border border-white/20 text-white font-medium hover:bg-accent hover:text-primary transition-all duration-300 cursor-pointer" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

export default InsightsOverlay
