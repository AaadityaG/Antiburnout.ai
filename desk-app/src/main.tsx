import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import App from './App.tsx'
import { store } from './store'
import { ToastProvider } from './context/ToastContext'
import Toast from './components/Toast'
import { useToast } from './context/ToastContext'

function AppWithToast() {
  const { toasts, removeToast } = useToast()
  return (
    <>
      <App />
      <Toast toasts={toasts} onRemove={removeToast} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <ToastProvider>
        <AppWithToast />
      </ToastProvider>
    </Provider>
  </StrictMode>,
)
