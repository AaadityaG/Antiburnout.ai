import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

interface TipData {
  tip: string
  category: string
  duration: string
  instruction: string
}

interface TipState {
  currentTip: TipData | null
  isLoading: boolean
  error: string | null
}

const initialState: TipState = {
  currentTip: null,
  isLoading: false,
  error: null
}

// Async thunk to fetch tip recommendation
export const fetchTipRecommendation = createAsyncThunk(
  'tips/fetchRecommendation',
  async (token: string, { rejectWithValue }) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const timeOfDay = getTimeOfDay()
      
      const response = await fetch(`${apiUrl}/tips/recommendation?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          time_of_day: timeOfDay
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch tip')
      }
      
      const data = await response.json()
      return data as TipData
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error')
    }
  }
)

const getTimeOfDay = (): string => {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

export const tipSlice = createSlice({
  name: 'tips',
  initialState,
  reducers: {
    clearTip: (state) => {
      state.currentTip = null
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTipRecommendation.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchTipRecommendation.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentTip = action.payload
      })
      .addCase(fetchTipRecommendation.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  }
})

export const { clearTip } = tipSlice.actions
export default tipSlice.reducer
