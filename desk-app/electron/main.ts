import { app, BrowserWindow, Tray, Menu, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import AutoLaunch from 'auto-launch'
import { execSync } from 'child_process'
import crypto from 'crypto'
// __dirname and __filename are available as globals in CommonJS

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let breakTimer: NodeJS.Timeout | null = null
let timeRemaining = 30 * 60 * 1000
let initialTime = 30 * 60 * 1000
let breakDuration = 20
let autoStart = true  // Start timer by default
let isPaused = false
let isMinimized = false
let isQuitting = false
let settingsReceived = false  // Track if we've received settings from backend

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json')

const isDev = process.env.NODE_ENV === 'development'

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      if (config.breakInterval) {
        initialTime = config.breakInterval * 60 * 1000
        timeRemaining = initialTime
      }
      if (config.breakDuration) breakDuration = config.breakDuration
      if (config.autoStart !== undefined) autoStart = config.autoStart
    }
  } catch (err) {
    console.error('Failed to load config:', err)
  }
}

function saveConfig() {
  try {
    const config = {
      breakInterval: initialTime / 60000,
      breakDuration: breakDuration,
      autoStart: autoStart,
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  } catch (err) {
    console.error('Failed to save config:', err)
  }
}

loadConfig()

function getMachineId(): string {
  try {
    let machineId = ''
    
    if (process.platform === 'win32') {
      // Windows: Get machine GUID from registry
      machineId = execSync(
        'powershell -command "(Get-ItemProperty HKLM:\\SOFTWARE\\Microsoft\\Cryptography).MachineGuid"',
        { encoding: 'utf8' }
      ).trim()
    } else if (process.platform === 'darwin') {
      // macOS: Get hardware UUID
      machineId = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID', 
        { encoding: 'utf8' }
      ).split('"')[3]
    } else {
      // Linux: Get machine ID
      machineId = execSync('cat /var/lib/dbus/machine-id', { encoding: 'utf8' }).trim()
    }
    
    // Hash it for privacy
    return crypto.createHash('sha256').update(machineId).digest('hex').substring(0, 32)
  } catch (error) {
    console.error('Failed to get machine ID:', error)
    // Fallback to a stored UUID
    const configPath = path.join(app.getPath('userData'), 'machine-id.json')
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8')).machineId
    }
    const fallbackId = crypto.randomUUID()
    fs.writeFileSync(configPath, JSON.stringify({ machineId: fallbackId }))
    return fallbackId
  }
}

const autoLauncher = new AutoLaunch({
  name: 'AntiBurnout',
  isHidden: true,
})

autoLauncher.enable().catch((err: unknown) => {
  console.error('Auto-launch failed:', err)
})

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function createWindow() {
  const iconPath = path.join(__dirname, '../public/icon.png')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    resizable: true,
    frame: false,
    title: 'AntiBurnout',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.setIcon(iconPath)
  mainWindow.setMenuBarVisibility(false)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
    
    mainWindow?.webContents.send('settings-updated', {
      interval: initialTime / 60000,
      duration: breakDuration
    })
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
      isMinimized = true
      return false
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function quitApp() {
  isQuitting = true
  saveConfig()
  
  if (breakTimer) {
    clearInterval(breakTimer)
    breakTimer = null
  }
  
  if (mainWindow) {
    mainWindow.removeAllListeners('close')
    mainWindow.destroy()
    mainWindow = null
  }
  
  if (tray) {
    tray.destroy()
    tray = null
  }
  
  app.quit()
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png')
  
  if (!fs.existsSync(iconPath)) {
    console.error('Icon file not found at:', iconPath)
    return
  }
  
  tray = new Tray(iconPath)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open AntiBurnout',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
        }
      },
    },
    {
      label: 'Reset Timer',
      click: () => {
        resetTimer()
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Exit',
      click: () => {
        quitApp()
      },
    },
  ])

  tray.setToolTip('AntiBurnout - Next break in ' + formatTime(timeRemaining))
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show()
    }
  })
}

function startBreakTimer() {
  if (breakTimer) {
    clearInterval(breakTimer)
  }

  console.log('Starting timer with initialTime:', initialTime)

  breakTimer = setInterval(() => {
    if (!isPaused) {
      timeRemaining -= 1000

      if (tray) {
        tray.setToolTip('AntiBurnout - Next break in ' + formatTime(timeRemaining))
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('timer-update', timeRemaining)
      }

      if (timeRemaining <= 0) {
        if (breakTimer) {
          clearInterval(breakTimer)
          breakTimer = null
        }
        openBreakWindow()
      }
    }
  }, 1000)
}

function openBreakWindow() {
  if (mainWindow) {
    if (isMinimized) {
      mainWindow.show()
      isMinimized = false
    }
    mainWindow.focus()
    mainWindow.webContents.send('break-time', {
      message: 'Time to rest your eyes!',
      instruction: 'Look at something 20 feet away for 20 seconds',
      duration: breakDuration,
    })
  }
}

function resetTimer() {
  timeRemaining = initialTime
  isPaused = false
  startBreakTimer()
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('timer-reset')
  }
  
  if (tray) {
    tray.setToolTip(`AntiBurnout - Timer reset! Next break in ${Math.round(initialTime / 60000)}:00`)
  }
}

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.on('pause-timer', () => {
  isPaused = true
})

ipcMain.on('resume-timer', () => {
  isPaused = false
})

ipcMain.on('reset-timer', () => {
  resetTimer()
})

ipcMain.on('timer-break-complete', () => {
  timeRemaining = initialTime
  startBreakTimer()
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('timer-reset')
  }
})

ipcMain.on('update-timer-setting', (event, { interval, duration, autoStart: newAutoStart }) => {
  console.log('Updating settings:', { interval, duration, autoStart: newAutoStart })
  initialTime = interval * 60 * 1000
  timeRemaining = initialTime
  breakDuration = duration
  if (newAutoStart !== undefined) autoStart = newAutoStart
  saveConfig()
  
  // Mark that we've received settings from backend
  settingsReceived = true
  
  // Start or restart the timer with new settings
  startBreakTimer()
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-updated', { interval, duration, autoStart })
  }
})

ipcMain.on('minimize-to-tray', () => {
  console.log('Minimize to tray called')
  if (mainWindow) {
    mainWindow.hide()
    isMinimized = true
    console.log('Window hidden, isMinimized:', isMinimized)
  }
})

ipcMain.on('quit-app', () => {
  quitApp()
})

ipcMain.handle('get-machine-id', () => {
  return getMachineId()
})

app.whenReady().then(() => {
  createWindow()
  createTray()
  
  // Don't start timer yet - wait for settings from backend
  // Timer will start when frontend sends settings after login

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  saveConfig()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
