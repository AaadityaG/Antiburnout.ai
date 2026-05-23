import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface ActivityDay {
  date: string
  total_session_duration: number
  total_breaks_taken: number
  total_breaks_skipped: number
  sessions_count: number
}

interface ActivityState {
  todaySessions: number
  todayDuration: number
  todaySkipped: number
  history: ActivityDay[]
  isLoading: boolean
  error: string | null
}

const initialState: ActivityState = {
  todaySessions: 0,
  todayDuration: 0,
  todaySkipped: 0,
  history: [],
  isLoading: false,
  error: null
}

export const saveSession = createAsyncThunk(
  'activity/saveSession',
  async ({
    token,
    sessionDuration,
    targetDuration,
    completed,
    skipped
  }: {
    token: string
    sessionDuration: number
    targetDuration: number
    completed: boolean
    skipped: boolean
  }) => {
    console.log('[Activity] Saving session:', {
      sessionDuration,
      targetDuration,
      completed,
      skipped
    })
    const response = await axios.post(
      `${API_URL}/activity/session`,
      {
        session_duration: sessionDuration,
        target_duration: targetDuration,
        completed,
        skipped
      },
      { params: { token } }
    )
    return response.data
  }
)

export const fetchTodayActivity = createAsyncThunk(
  'activity/fetchToday',
  async (token: string) => {
    console.log('[Activity] Fetching today activity...')
    const response = await axios.get(`${API_URL}/activity/today`, {
      params: { token }
    })
    return response.data
  }
)

export const fetchActivityHistory = createAsyncThunk(
  'activity/fetchHistory',
  async ({ token, days = 7 }: { token: string; days?: number }) => {
    console.log(`[Activity] Fetching activity history for ${days} days...`)
    const response = await axios.get(`${API_URL}/activity/history`, {
      params: { token, days }
    })
    return response.data
  }
)

export const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {
    clearActivity: (state) => {
      state.todaySessions = 0
      state.todayDuration = 0
      state.todaySkipped = 0
      state.history = []
      state.isLoading = false
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(saveSession.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(saveSession.fulfilled, (state, action) => {
        state.isLoading = false
        console.log('[Activity] Session saved:', action.payload)
      })
      .addCase(saveSession.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to save session'
        console.error('[Activity] Failed to save session:', action.error)
      })
      .addCase(fetchTodayActivity.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchTodayActivity.fulfilled, (state, action) => {
        state.isLoading = false
        state.todaySessions = action.payload.sessions_count || 0
        state.todayDuration = action.payload.total_session_duration || 0
        state.todaySkipped = action.payload.total_breaks_skipped || 0
      })
      .addCase(fetchTodayActivity.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to fetch activity'
      })
      .addCase(fetchActivityHistory.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchActivityHistory.fulfilled, (state, action) => {
        state.isLoading = false
        state.history = action.payload
      })
      .addCase(fetchActivityHistory.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to fetch history'
      })
  }
})

export const { clearActivity } = activitySlice.actions
export default activitySlice.reducer