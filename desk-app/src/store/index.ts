import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import settingsReducer from './settingsSlice'
import chatReducer from './chatSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    settings: settingsReducer,
    chat: chatReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
