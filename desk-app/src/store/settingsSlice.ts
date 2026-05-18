import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface SettingsState {
  breakInterval: number  // in seconds
  breakDuration: number  // in seconds
  autoStart: boolean
  enableSound: boolean   // Enable countdown sound
  isLoading: boolean
  error: string | null
  fetched: boolean  // Track if settings have been fetched from backend
}

const initialState: SettingsState = {
  breakInterval: 1800,  // 30 minutes in seconds
  breakDuration: 90,    // 1 minute 30 seconds in seconds
  autoStart: true,
  enableSound: true,    // Sound enabled by default
  isLoading: false,
  error: null,
  fetched: false  // Not fetched yet
}

// Async thunks
export const fetchSettings = createAsyncThunk(
  'settings/fetchSettings',
  async (token: string) => {
    console.log('[Redux] Fetching settings from backend...')
    const response = await axios.get(`${API_URL}/settings/user`, {
      params: { token }
    })
    console.log('[Redux] Settings received:', response.data)
    return response.data
  }
)

export const updateSettings = createAsyncThunk(
  'settings/updateSettings',
  async ({ token, settings }: { token: string; settings: { break_interval: number; break_duration: number; auto_start: boolean; enable_sound: boolean } }) => {
    console.log('[Redux] Updating settings:', settings)
    const response = await axios.put(`${API_URL}/settings/user`, settings, {
      params: { token }
    })
    console.log('[Redux] Settings updated:', response.data)
    return response.data
  }
)

// Helper to convert hours, minutes, seconds to total seconds
export const toTotalSeconds = (hours: number, minutes: number, seconds: number): number => {
  return hours * 3600 + minutes * 60 + seconds
}

// Helper to convert total seconds to hours, minutes, seconds
export const fromTotalSeconds = (totalSeconds: number): { hours: number; minutes: number; seconds: number } => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { hours, minutes, seconds }
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    clearSettings: (state) => {
      state.breakInterval = 1800  // 30 minutes
      state.breakDuration = 90    // 1 minute 30 seconds
      state.autoStart = true
      state.enableSound = true
      state.isLoading = false
      state.error = null
      state.fetched = false  // Reset fetch flag
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch settings
      .addCase(fetchSettings.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.isLoading = false
        state.breakInterval = action.payload.break_interval
        state.breakDuration = action.payload.break_duration
        state.autoStart = action.payload.auto_start
        state.enableSound = action.payload.enable_sound
        state.fetched = true  // Mark that settings have been fetched from backend
        console.log('[Redux] State updated with settings:', {
          breakInterval: state.breakInterval,
          breakDuration: state.breakDuration,
          autoStart: state.autoStart,
          enableSound: state.enableSound
        })
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to fetch settings'
      })
      // Update settings
      .addCase(updateSettings.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.isLoading = false
        state.breakInterval = action.payload.break_interval
        state.breakDuration = action.payload.break_duration
        state.autoStart = action.payload.auto_start
        state.enableSound = action.payload.enable_sound
      })
      .addCase(updateSettings.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to update settings'
      })
  }
})

export const { clearSettings } = settingsSlice.actions
export default settingsSlice.reducer
