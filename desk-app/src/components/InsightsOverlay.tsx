import { useEffect, useMemo, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchActivityHistory } from '../store/activitySlice'
import type { RootState, AppDispatch } from '../store'

interface InsightsOverlayProps {
  isOpen: boolean
  onClose: () => void
}

function InsightsOverlay({ isOpen, onClose }: InsightsOverlayProps) {
  const dispatch = useDispatch<AppDispatch>()
  const { token } = useSelector((state: RootState) => state.auth)
  const { history, isLoading } = useSelector((state: RootState) => state.activity)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    console.log('[Insights] isOpen:', isOpen, 'token:', !!token, 'history length:', history.length)
    if (isOpen && token) {
      dispatch(fetchActivityHistory({ token, days: 7 }))
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [isOpen, token, dispatch])

  const stats = useMemo(() => {
    console.log('[Insights] Computing stats from history:', history)
    if (!history || history.length === 0) {
      console.log('[Insights] No history data')
      return null
    }

    const totalScreenTime = history.reduce((sum, day) => sum + day.total_session_duration, 0)
    const totalBreaks = history.reduce((sum, day) => sum + day.total_breaks_taken, 0)
    const totalSkipped = history.reduce((sum, day) => sum + day.total_breaks_skipped, 0)
    const totalSessions = history.reduce((sum, day) => sum + day.sessions_count, 0)
    const avgDailyTime = totalScreenTime / history.length
    const breakCompletionRate = totalBreaks / (totalBreaks + totalSkipped) * 100

    const sortedByTime = [...history].sort((a, b) => b.total_session_duration - a.total_session_duration)
    const bestDay = sortedByTime[sortedByTime.length - 1]
    const worstDay = sortedByTime[0]

    return {
      totalScreenTime,
      totalBreaks,
      totalSkipped,
      totalSessions,
      avgDailyTime,
      breakCompletionRate,
      bestDay,
      worstDay,
      dailyData: [...history].reverse()
    }
  }, [history])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const getMaxDuration = () => {
    if (!stats?.dailyData || stats.dailyData.length === 0) return 1
    return Math.max(...stats.dailyData.map(d => d.total_session_duration))
  }

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return 'text-green-300'
    if (rate >= 50) return 'text-yellow-300'
    return 'text-rose-300'
  }

  const getCompletionBg = (rate: number) => {
    if (rate >= 80) return 'border-green-400/20 bg-green-500/10'
    if (rate >= 50) return 'border-yellow-400/20 bg-yellow-500/10'
    return 'border-rose-400/20 bg-rose-500/10'
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 bg-glass-heavy glass-blur-heavy z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-[750px] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/20 flex items-center justify-center backdrop-blur-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan-300">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
                <path d="M22 12A10 10 0 0 0 12 2v10z"/>
              </svg>
            </div>
            <div className='flex items-start gap-0.5 flex-col justify-start'>
              <h2 className="text-2xl font-extralight text-white tracking-tight">Insights</h2>
              <p className="text-[11px] text-green-200/40 mt-0.5 font-medium">Your wellness analytics</p>
            </div>
          </div>
          <button
            className="w-9 h-9 rounded-full bg-glass glass-blur border border-white/20 text-white flex items-center justify-center hover:bg-accent hover:text-primary cursor-pointer"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-6 custom-scrollbar" style={{ maxHeight: 'calc(90vh - 160px)', overflowY: 'auto' }}>
          {isLoading ? (
            <div className="text-center text-white/40 py-16">
              <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm">Loading insights...</p>
            </div>
          ) : !stats ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center mx-auto mb-5">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan-300/50">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
                  <path d="M22 12A10 10 0 0 0 12 2v10z"/>
                </svg>
              </div>
              <p className="text-sm text-white/40">No activity data yet</p>
              <p className="text-xs text-white/30 mt-2">Start using the app to see your insights</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="group p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-400/20 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-300">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-extralight text-white mb-1">{formatDuration(stats.totalScreenTime)}</div>
                  <div className="text-[10px] text-green-200/50 uppercase tracking-wider font-medium">Total Screen Time</div>
                </div>
                <div className="group p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-400/20 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-300">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-extralight text-white mb-1">{stats.totalSessions}</div>
                  <div className="text-[10px] text-green-200/50 uppercase tracking-wider font-medium">Total Sessions</div>
                </div>
                <div className="group p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-400/20 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-300">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-extralight text-white mb-1">{formatDuration(stats.avgDailyTime)}</div>
                  <div className="text-[10px] text-green-200/50 uppercase tracking-wider font-medium">Avg Daily</div>
                </div>
                <div className={`group p-5 rounded-2xl border ${getCompletionBg(stats.breakCompletionRate)} hover:scale-[1.02] transition-all duration-300`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={getCompletionColor(stats.breakCompletionRate)}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                    </div>
                  </div>
                  <div className={`text-3xl font-extralight mb-1 ${getCompletionColor(stats.breakCompletionRate)}`}>{Math.round(stats.breakCompletionRate)}%</div>
                  <div className="text-[10px] uppercase tracking-wider font-medium opacity-60">Break Completion</div>
                </div>
              </div>

              {/* Daily Chart */}
              <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-light text-white tracking-tight mb-0.5">Daily Screen Time</h3>
                    <p className="text-[10px] text-green-200/30">Last 7 days breakdown</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400" />
                    <span className="text-[10px] text-green-200/50 font-medium">Duration</span>
                  </div>
                </div>
                <div className="space-y-4">
                  {stats.dailyData.map((day, idx) => {
                    const percentage = (day.total_session_duration / getMaxDuration()) * 100
                    return (
                      <div key={idx} className="group space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-white/60 font-medium">{formatDate(day.date)}</span>
                          <span className="text-white/40 font-mono text-[11px]">{formatDuration(day.total_session_duration)}</span>
                        </div>
                        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden backdrop-blur-sm">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500/80 to-cyan-400/80 rounded-full transition-all duration-700 group-hover:from-blue-400 group-hover:to-cyan-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Break Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="group p-5 rounded-2xl border border-green-400/20 bg-green-500/[0.08] hover:bg-green-500/[0.12] transition-all duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-green-400/20 border border-green-300/30 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-300">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-extralight text-green-300 mb-1">{stats.totalBreaks}</div>
                  <div className="text-[10px] text-green-200/50 uppercase tracking-wider font-medium">Breaks Taken</div>
                </div>
                <div className="group p-5 rounded-2xl border border-rose-400/20 bg-rose-500/[0.08] hover:bg-rose-500/[0.12] transition-all duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-400/20 border border-rose-300/30 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-300">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                    </div>
                  </div>
                  <div className="text-3xl font-extralight text-rose-300 mb-1">{stats.totalSkipped}</div>
                  <div className="text-[10px] text-rose-200/50 uppercase tracking-wider font-medium">Breaks Skipped</div>
                </div>
              </div>

              {/* Best/Worst Days */}
              <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="flex items-center gap-2 mb-5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-300">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  <h3 className="text-sm font-light text-white tracking-tight">Performance Highlights</h3>
                </div>
                <div className="flex justify-between items-stretch gap-6">
                  <div className="flex-1 p-4 rounded-xl bg-green-500/5 border border-green-400/10">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-green-400/20 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-300">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                      </div>
                      <span className="text-[10px] text-green-200/60 uppercase tracking-wider font-medium">Most Productive</span>
                    </div>
                    <div className="text-xs text-white/60 mb-1.5">{formatDate(stats.bestDay.date)}</div>
                    <div className="text-xl font-light text-white">{formatDuration(stats.bestDay.total_session_duration)}</div>
                  </div>
                  <div className="flex-1 p-4 rounded-xl bg-rose-500/5 border border-rose-400/10">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-rose-400/20 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-rose-300">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                      <span className="text-[10px] text-rose-200/60 uppercase tracking-wider font-medium">Least Productive</span>
                    </div>
                    <div className="text-xs text-white/60 mb-1.5">{formatDate(stats.worstDay.date)}</div>
                    <div className="text-xl font-light text-white">{formatDuration(stats.worstDay.total_session_duration)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-white/5">
          <button 
            className="w-full h-12 rounded-full bg-glass glass-blur border border-white/20 text-white font-medium hover:bg-accent hover:text-primary cursor-pointer transition-all"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default InsightsOverlay
