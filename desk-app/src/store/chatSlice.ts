import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

interface ChatMessage {
  message: string
  response: string
  model: string
  provider_key?: string
  timestamp: string
}

interface ChatSession {
  id: string
  message_count: number
  first_message: string
  last_message: string
  models_used: string[]
  created_at: string
  updated_at: string
}

interface SessionDetail {
  id: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

interface ChatState {
  sessions: ChatSession[]
  currentSession: SessionDetail | null
  currentSessionId: string | null
  isLoading: boolean
  error: string | null
  searchResults: SearchResult[]
  isSearching: boolean
}

export interface SearchResult {
  content: string
  session_id: string
  timestamp: string
  score: number
}

const initialState: ChatState = {
  sessions: [],
  currentSession: null,
  currentSessionId: null,
  isLoading: false,
  error: null,
  searchResults: [],
  isSearching: false
}

// Async thunks
export const fetchSessions = createAsyncThunk(
  'chat/fetchSessions',
  async (token: string) => {
    console.log('[chatSlice] Fetching sessions with token:', token.substring(0, 20) + '...')
    const response = await axios.get(`${API_URL}/chat/history/`, {
      params: { token, limit: 20 }
    })
    console.log('[chatSlice] Sessions response:', response.data)
    return response.data
  }
)

export const fetchSessionMessages = createAsyncThunk(
  'chat/fetchSessionMessages',
  async ({ token, sessionId }: { token: string; sessionId: string }) => {
    const response = await axios.get(`${API_URL}/chat/history/${sessionId}`, {
      params: { token }
    })
    return response.data
  }
)

export const deleteSession = createAsyncThunk(
  'chat/deleteSession',
  async ({ token, sessionId }: { token: string; sessionId: string }) => {
    await axios.delete(`${API_URL}/chat/history/${sessionId}`, {
      params: { token }
    })
    return sessionId
  }
)

export const clearAllHistory = createAsyncThunk(
  'chat/clearAllHistory',
  async (token: string) => {
    const response = await axios.delete(`${API_URL}/chat/history/clear`, {
      params: { token }
    })
    return response.data
  }
)

export const searchChatHistory = createAsyncThunk(
  'chat/searchChatHistory',
  async ({ token, query, k }: { token: string; query: string; k?: number }) => {
    const response = await axios.post(`${API_URL}/chat/history/search`, {
      query,
      k: k || 5
    }, {
      params: { token }
    })
    return response.data
  }
)

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setCurrentSessionId: (state, action) => {
      state.currentSessionId = action.payload
    },
    clearCurrentSession: (state) => {
      state.currentSession = null
      state.currentSessionId = null
    },
    clearSearchResults: (state) => {
      state.searchResults = []
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch sessions
      .addCase(fetchSessions.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.isLoading = false
        state.sessions = action.payload
        console.log('[chatSlice] Sessions stored in Redux:', action.payload.length)
      })
      .addCase(fetchSessions.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to fetch sessions'
      })
      // Fetch session messages
      .addCase(fetchSessionMessages.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchSessionMessages.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentSession = action.payload
      })
      .addCase(fetchSessionMessages.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || 'Failed to fetch session'
      })
      // Delete session
      .addCase(deleteSession.fulfilled, (state, action) => {
        state.sessions = state.sessions.filter(s => s.id !== action.payload)
        if (state.currentSessionId === action.payload) {
          state.currentSession = null
          state.currentSessionId = null
        }
      })
      // Clear all history
      .addCase(clearAllHistory.fulfilled, (state) => {
        state.sessions = []
        state.currentSession = null
        state.currentSessionId = null
      })
      // Search chat history
      .addCase(searchChatHistory.pending, (state) => {
        state.isSearching = true
      })
      .addCase(searchChatHistory.fulfilled, (state, action) => {
        state.isSearching = false
        state.searchResults = action.payload.results || []
      })
      .addCase(searchChatHistory.rejected, (state) => {
        state.isSearching = false
        state.searchResults = []
      })
  }
})

export const { setCurrentSessionId, clearCurrentSession, clearSearchResults } = chatSlice.actions
export default chatSlice.reducer
