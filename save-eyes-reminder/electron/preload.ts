import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Listen for events from main process
  onTimerUpdate: (callback: (event: any, time: number) => void) => 
    ipcRenderer.on('timer-update', callback),
  onTimerReset: (callback: () => void) => 
    ipcRenderer.on('timer-reset', callback),
  onBreakTime: (callback: (event: any, data: any) => void) => 
    ipcRenderer.on('break-time', callback),
  onSettingsUpdated: (callback: (event: any, data: any) => void) => 
    ipcRenderer.on('settings-updated', callback),
  
  // Send events to main process
  sendPauseTimer: () => ipcRenderer.send('pause-timer'),
  sendResumeTimer: () => ipcRenderer.send('resume-timer'),
  sendResetTimer: () => ipcRenderer.send('reset-timer'),
  sendTimerBreakComplete: () => ipcRenderer.send('timer-break-complete'),
  sendUpdateTimerSetting: (settings: { interval: number; duration: number; autoStart: boolean }) => 
    ipcRenderer.send('update-timer-setting', settings),
  sendMinimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  sendQuitApp: () => ipcRenderer.send('quit-app'),
})
