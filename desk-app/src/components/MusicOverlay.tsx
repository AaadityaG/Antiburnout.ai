import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

interface Video {
  video_id: string
  title: string
  channel: string
  thumbnail: string
}

interface MoodOption {
  id: string
  label: string
  emoji: string
  description: string
}

const MOODS: MoodOption[] = [
  { id: 'stressed', label: 'Stressed', emoji: '😰', description: 'Rain sounds to calm your mind' },
  { id: 'anxious', label: 'Anxious', emoji: '😟', description: 'Soft piano for peace' },
  { id: 'tired', label: 'Tired', emoji: '😴', description: 'Nature sounds to recharge' },
  { id: 'sad', label: 'Sad', emoji: '😔', description: 'Gentle melodies to comfort' },
  { id: 'focus', label: 'Need Focus', emoji: '🎯', description: 'Lo-fi beats for concentration' },
  { id: 'happy', label: 'Happy', emoji: '😊', description: 'Uplifting acoustic vibes' },
  { id: 'sleep', label: 'Sleep', emoji: '🌙', description: 'Deep calm for restful sleep' },
  { id: 'meditate', label: 'Meditate', emoji: '🧘', description: 'Zen peace for mindfulness' },
]

interface MusicOverlayProps {
  isOpen: boolean
  onClose: () => void
  currentTrack: Video | null
  onPlayTrack: (track: Video) => void
}

function MusicOverlay({ isOpen, onClose, currentTrack, onPlayTrack }: MusicOverlayProps) {
  const [selectedMood, setSelectedMood] = useState<MoodOption | null>(null)
  const [tracks, setTracks] = useState<Video[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const isPlaying = (track: Video) => currentTrack?.video_id === track.video_id

  const fetchMoodMusic = async (mood: MoodOption) => {
    setSelectedMood(mood)
    setLoading(true)
    setTracks([])
    try {
      const res = await axios.get(`${API_URL}/music/mood/${mood.id}`, { params: { max_results: 8 } })
      setTracks(res.data.videos)
      if (res.data.videos.length > 0 && !currentTrack) {
        onPlayTrack(res.data.videos[0])
      }
    } catch (err) {
      console.error('Failed to fetch music:', err)
    } finally {
      setLoading(false)
    }
  }

  const searchMusic = async () => {
    if (!searchQuery.trim()) return
    setSelectedMood(null)
    setLoading(true)
    setTracks([])
    try {
      const res = await axios.get(`${API_URL}/music/search`, { params: { q: searchQuery.trim(), max_results: 8 } })
      setTracks(res.data.videos)
    } catch (err) {
      console.error('Failed to search music:', err)
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    setSelectedMood(null)
    setTracks([])
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="music-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[600px] max-h-[85vh] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
        >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-white/5 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {selectedMood && (
                <button
                  className="w-9 h-9 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary cursor-pointer"
                  onClick={goBack}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
              )}
              <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
                <span className="text-xl">🎵</span>
              </div>
              <div>
                <h2 className="text-2xl font-extralight text-white tracking-tight">
                  {currentTrack ? 'Now Playing' : 'Calm Music'}
                </h2>
                <p className="text-xs text-green-200/50 mt-0.5">
                  {currentTrack ? currentTrack.channel : selectedMood ? selectedMood.description : 'Pick your mood'}
                </p>
              </div>
            </div>
            <button
              className="w-9 h-9 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary cursor-pointer"
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          {/* Search bar */}
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50"
              placeholder="Search any artist, song, or genre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchMusic()}
            />
            <button
              onClick={searchMusic}
              disabled={!searchQuery.trim() || loading}
              className="px-4 py-2.5 rounded-xl bg-accent/15 border border-accent/25 text-accent text-sm font-medium hover:bg-accent/25 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Search
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {tracks.length === 0 ? (
            /* Mood Grid */
            <div className="p-8">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mb-4" />
                  <p className="text-sm text-white/40">Finding the right vibes...</p>
                </div>
              ) : (
                <motion.div
                  className="grid grid-cols-2 gap-3"
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
                >
                  {MOODS.map((mood) => (
                    <motion.button
                      key={mood.id}
                      variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                      transition={{ duration: 0.3 }}
                      whileHover={{ scale: 1.03, backgroundColor: 'rgba(74,222,128,0.1)' }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => fetchMoodMusic(mood)}
                      className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-accent/25 transition-colors text-left cursor-pointer group"
                    >
                      <span className="text-3xl block mb-3">{mood.emoji}</span>
                      <h3 className="text-sm font-medium text-white/90">{mood.label}</h3>
                      <p className="text-[10px] text-green-200/50 mt-1 leading-relaxed">{mood.description}</p>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </div>
          ) : (
            /* Track List */
            <div>
              {/* Now Playing mini */}
              {currentTrack && (
                <div className="px-6 pt-5 pb-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Now Playing</p>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-accent/10 border border-accent/20">
                    <img
                      src={currentTrack.thumbnail}
                      alt={currentTrack.title}
                      className="w-14 h-10 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
                      <p className="text-xs text-white/40 truncate">{currentTrack.channel}</p>
                    </div>
                    <div className="shrink-0 flex gap-0.5">
                      <div className="w-0.5 h-3 bg-accent rounded-full animate-pulse" />
                      <div className="w-0.5 h-4 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                      <div className="w-0.5 h-2 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Track List */}
              <div className="px-6 py-3">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">{currentTrack ? 'Up Next' : 'Results'}</p>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  </div>
                ) : (
                  <motion.div
                    className="space-y-1.5"
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
                  >
                    {tracks.map((track) => (
                      <motion.button
                        key={track.video_id}
                        variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
                        transition={{ duration: 0.25 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onPlayTrack(track)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                          isPlaying(track)
                            ? 'bg-accent/15 border border-accent/25'
                            : 'hover:bg-white/[0.04] border border-transparent'
                        }`}
                      >
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-12 h-9 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white/80 truncate">{track.title}</p>
                          <p className="text-[10px] text-white/30 mt-0.5 truncate">{track.channel}</p>
                        </div>
                        {isPlaying(track) && (
                          <div className="shrink-0 flex gap-0.5">
                            <div className="w-0.5 h-3 bg-accent rounded-full animate-pulse" />
                            <div className="w-0.5 h-4 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                            <div className="w-0.5 h-2 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Mood Quick Switch */}
              <div className="px-6 pb-6">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Switch Mood</p>
                <div className="flex gap-2 flex-wrap">
                  {MOODS.map((mood) => (
                    <button
                      key={mood.id}
                      onClick={() => fetchMoodMusic(mood)}
                      className={`px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        selectedMood?.id === mood.id
                          ? 'bg-accent/20 border border-accent/30 text-accent'
                          : 'bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/[0.08]'
                      }`}
                    >
                      <span>{mood.emoji}</span>
                      <span>{mood.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  )
}

export default MusicOverlay
