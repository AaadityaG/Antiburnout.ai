import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onTimerUpdate: (callback: (event: any, time: number) => void) => {
    const subscription = (_event: any, time: number) => callback(_event, time)
    ipcRenderer.on('timer-update', subscription)
    return () => {
      ipcRenderer.removeListener('timer-update', subscription)
    }
  },
  onTimerReset: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on('timer-reset', subscription)
    return () => {
      ipcRenderer.removeListener('timer-reset', subscription)
    }
  },
  onBreakTime: (callback: (event: any, data: any) => void) => {
    const subscription = (event: any, data: any) => callback(event, data)
    ipcRenderer.on('break-time', subscription)
    return () => {
      ipcRenderer.removeListener('break-time', subscription)
    }
  },
  onSettingsUpdated: (callback: (event: any, data: any) => void) => {
    const subscription = (event: any, data: any) => callback(event, data)
    ipcRenderer.on('settings-updated', subscription)
    return () => {
      ipcRenderer.removeListener('settings-updated', subscription)
    }
  },
  sendPauseTimer: () => ipcRenderer.send('pause-timer'),
  sendResumeTimer: () => ipcRenderer.send('resume-timer'),
  sendResetTimer: () => ipcRenderer.send('reset-timer'),
  sendTimerBreakComplete: () => ipcRenderer.send('timer-break-complete'),
  sendUpdateTimerSetting: (settings: { interval: number; duration: number; autoStart: boolean }) => 
    ipcRenderer.send('update-timer-setting', settings),
  sendMinimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  sendQuitApp: () => ipcRenderer.send('quit-app'),
})
