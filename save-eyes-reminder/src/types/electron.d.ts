export interface BreakTimeData {
  message: string
  instruction: string
  duration: number
}

export interface SettingsData {
  interval: number
  duration: number
  autoStart: boolean
}

export interface TimerSetting {
  interval: number
  duration: number
  autoStart: boolean
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  onTimerUpdate: (callback: (time: number) => void) => () => void
  onTimerReset: (callback: () => void) => () => void
  onBreakTime: (callback: (data: BreakTimeData) => void) => () => void
  onSettingsUpdated: (callback: (data: SettingsData) => void) => () => void
  sendPauseTimer: () => void
  sendResumeTimer: () => void
  sendResetTimer: () => void
  sendTimerBreakComplete: () => void
  sendUpdateTimerSetting: (settings: TimerSetting) => void
  sendMinimizeToTray: () => void
  sendQuitApp: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
