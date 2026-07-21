import { contextBridge, ipcRenderer } from 'electron'

interface BreakTimeData {
  message: string
  instruction: string
  duration: number
}

interface SettingsData {
  interval: number
  duration: number
  autoStart: boolean
}

interface TimerSetting {
  interval: number
  duration: number
  autoStart: boolean
}

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),
  getSystemBrightness: () => ipcRenderer.invoke('get-system-brightness'),
  getSystemVolume: () => ipcRenderer.invoke('get-system-volume'),
  
  setSystemBrightness: (brightness: number) => ipcRenderer.invoke('set-system-brightness', brightness),
  setSystemVolume: (volume: number) => ipcRenderer.invoke('set-system-volume', volume),
  
  
  // Listen for events from main process
  onTimerUpdate: (callback: (time: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, time: number) => callback(time)
    ipcRenderer.on('timer-update', listener)
    return () => ipcRenderer.removeListener('timer-update', listener)
  },
  
  onTimerReset: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('timer-reset', listener)
    return () => ipcRenderer.removeListener('timer-reset', listener)
  },
  
  onBreakTime: (callback: (data: BreakTimeData) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: BreakTimeData) => callback(data)
    ipcRenderer.on('break-time', listener)
    return () => ipcRenderer.removeListener('break-time', listener)
  },
  
  onSettingsUpdated: (callback: (data: SettingsData) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: SettingsData) => callback(data)
    ipcRenderer.on('settings-updated', listener)
    return () => ipcRenderer.removeListener('settings-updated', listener)
  },
  
  // Send events to main process
  sendPauseTimer: () => ipcRenderer.send('pause-timer'),
  sendResumeTimer: () => ipcRenderer.send('resume-timer'),
  sendResetTimer: () => ipcRenderer.send('reset-timer'),
  sendTimerBreakComplete: () => ipcRenderer.send('timer-break-complete'),
  sendUpdateTimerSetting: (settings: TimerSetting) => 
    ipcRenderer.send('update-timer-setting', settings),
  sendMinimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  sendQuitApp: () => ipcRenderer.send('quit-app'),
})
