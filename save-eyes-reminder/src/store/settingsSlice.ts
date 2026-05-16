import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface SettingsState {
  breakInterval: number
  breakDuration: number
  autoStart: boolean
  isLoading: boolean
  error: string | null
}

const initialState: SettingsState = {
  breakInterval: 30,
  breakDuration: 20,
  autoStart: true,
  isLoading: false,
  error: null
}

// Async thunks
export const fetchSettings = createAsyncThunk(
  'settings/fetchSettings',
  async (token: string) => {
    const response = await axios.get(`${API_URL}/settings/user`, {
      params: { token }
    })
    return response.data
  }
)

export const updateSettings = createAsyncThunk(
  'settings/updateSettings',
  async ({ token, settings }: { token: string; settings: { break_interval: number; break_duration: number; auto_start: boolean } }) => {
    const response = await axios.put(`${API_URL}/settings/user`, settings, {
      params: { token }
    })
    return response.data
  }
)

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    clearSettings: (state) => {
      state.breakInterval = 30
      state.breakDuration = 20
      state.autoStart = true
      state.isLoading = false
      state.error = null
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
      })
      .addCase(updateSettings.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to update settings'
      })
  }
})

export const { clearSettings } = settingsSlice.actions
export default settingsSlice.reducer
