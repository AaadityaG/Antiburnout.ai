export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  onTimerUpdate: (callback: (event: any, time: number) => void) => void
  onTimerReset: (callback: () => void) => void
  onBreakTime: (callback: (event: any, data: any) => void) => void
  onSettingsUpdated: (callback: (event: any, data: any) => void) => void
  sendPauseTimer: () => void
  sendResumeTimer: () => void
  sendResetTimer: () => void
  sendTimerBreakComplete: () => void
  sendUpdateTimerSetting: (settings: { interval: number; duration: number; autoStart: boolean }) => void
  sendMinimizeToTray: () => void
  sendQuitApp: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
