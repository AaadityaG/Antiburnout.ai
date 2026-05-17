import { useState } from 'react'

interface MusicOverlayProps {
  isOpen: boolean
  onClose: () => void
}

interface MoodOption {
  id: string
  label: string
  emoji: string
  videoId: string
  description: string
}

const MOODS: MoodOption[] = [
  { id: 'stressed', label: 'Stressed', emoji: '😰', videoId: 'HGx2pVqPp00', description: 'Rain sounds to calm your mind' },
  { id: 'anxious', label: 'Anxious', emoji: '😟', videoId: '4zP1IHhFzNk', description: 'Soft piano for peace' },
  { id: 'tired', label: 'Tired', emoji: '😴', videoId: '2Vv-BfVoq4g', description: 'Nature sounds to recharge' },
  { id: 'sad', label: 'Sad', emoji: '😔', videoId: 'DWcJFNfaw9c', description: 'Gentle melodies to comfort' },
  { id: 'focus', label: 'Need Focus', emoji: '🎯', videoId: 'jfKfPfyJRdk', description: 'Lo-fi beats for concentration' },
  { id: 'happy', label: 'Happy', emoji: '😊', videoId: '5eSlRY2ZO0s', description: 'Uplifting acoustic vibes' },
]

function MusicOverlay({ isOpen, onClose }: MusicOverlayProps) {
  const [selectedMood, setSelectedMood] = useState<MoodOption | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const handleSelectMood = (mood: MoodOption) => {
    setSelectedMood(mood)
    setIsPlaying(true)
  }

  const stopMusic = () => {
    setSelectedMood(null)
    setIsPlaying(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4 transition-all duration-500 opacity-100 animate-in fade-in zoom-in-95">
      <div className="w-full max-w-[600px] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
              <span className="text-xl">🎵</span>
            </div>
            <div>
              <h2 className="text-2xl font-extralight text-white tracking-tight">Calm Music</h2>
              <p className="text-xs text-green-200/50 mt-0.5">Pick your mood</p>
            </div>
          </div>
          <button
            className="w-9 h-9 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {!selectedMood ? (
          /* Mood Grid */
          <div className="p-8">
            <div className="grid grid-cols-2 gap-4">
              {MOODS.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => handleSelectMood(mood)}
                  className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-accent/10 hover:border-accent/25 transition-all text-left cursor-pointer group"
                >
                  <span className="text-3xl block mb-3">{mood.emoji}</span>
                  <h3 className="text-sm font-medium text-white/90">{mood.label}</h3>
                  <p className="text-[10px] text-green-200/50 mt-1 leading-relaxed">{mood.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Now Playing */
          <div className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <button
                className="w-10 h-10 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary cursor-pointer"
                onClick={stopMusic}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedMood.emoji}</span>
                <div>
                  <h3 className="text-base font-medium text-white">{selectedMood.label}</h3>
                  <p className="text-xs text-green-200/50">{selectedMood.description}</p>
                </div>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden bg-black/40 aspect-video">
              {isPlaying && (
                <iframe
                  src={`https://www.youtube.com/embed/${selectedMood.videoId}?autoplay=1&loop=1&playlist=${selectedMood.videoId}&controls=1&rel=0`}
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              )}
            </div>

            <div className="mt-4 flex items-center justify-center gap-4">
              {MOODS.filter(m => m.id !== selectedMood.id).slice(0, 4).map(m => (
                <button
                  key={m.id}
                  onClick={() => handleSelectMood(m)}
                  className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-accent/20 hover:border-accent/30 transition-all cursor-pointer group"
                  title={m.label}
                >
                  <span className="text-lg">{m.emoji}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MusicOverlay
