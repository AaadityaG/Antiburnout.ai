# AntiBurnout

A desktop application built with Electron and React that reminds you to take regular breaks to rest your eyes using the 20-20-20 rule (every 20 minutes, look at something 20 feet away for 20 seconds).

## 🏗️ Architecture

### How Electron Works with React

This application uses a **three-process architecture**:

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐         ┌──────────────────────┐  │
│  │  Main Process    │◄───────►│  Preload Script      │  │
│  │  (Node.js)       │   IPC   │  (Context Bridge)    │  │
│  │                  │         └──────────────────────┘  │
│  │  • Window mgmt   │                    ▲              │
│  │  • System tray   │                    │ IPC          │
│  │  • File system   │                    │              │
│  │  • Auto-launch   │                    │              │
│  │  • Timer logic   │                    │              │
│  └──────────────────┘                    │              │
│                                          │              │
│                               ┌──────────────────────┐  │
│                               │  Renderer Process    │  │
│                               │  (React + Chromium)  │  │
│                               │                      │  │
│                               │  • UI components     │  │
│                               │  • Timer display     │  │
│                               │  • Settings panel    │  │
│                               │  • Break overlay     │  │
│                               └──────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**1. Main Process** (`electron/main.ts`)
- Runs in a Node.js environment
- Manages native desktop features: windows, system tray, file system, auto-launch
- Controls the break timer logic
- Handles application lifecycle

**2. Renderer Process** (`src/App.tsx`)
- Your React application running in a Chromium browser window
- Displays the UI: timer, controls, settings, break notifications
- Cannot directly access Node.js APIs (security isolation)

**3. Preload Script** (`electron/preload.ts`)
- Secure bridge between Main and Renderer processes
- Uses `contextBridge` to safely expose specific IPC methods to React
- Runs before the React app loads

### Why Compile TypeScript First?

Electron's main process runs on Node.js, which **doesn't understand TypeScript natively**. The compilation pipeline:

```
Development:
  electron/main.ts ──┐
                     ├─► tsc (TypeScript compiler) ──► electron-dist/main.js
  electron/preload.ts┘                                     │
                                                           ▼
                                                   rename-electron.mjs
                                                           │
                                                           ▼
                                                  electron-dist/main.cjs
                                                       (CommonJS)

Production Build:
  src/*.tsx ──► Vite ──► dist/ (bundled React app)
```

**Key Points:**
- TypeScript must be compiled to JavaScript
- Electron main process requires **CommonJS** modules (`.cjs`), not ES modules
- The `rename-electron.mjs` script renames `.js` to `.cjs` after compilation
- React code is bundled separately by Vite into the `dist/` folder

### Communication Flow (IPC)

**IPC = Inter-Process Communication**

```
React Component
     │
     │ window.electronAPI.sendPauseTimer()
     ▼
preload.ts (contextBridge)
     │
     │ ipcRenderer.send('pause-timer')
     ▼
Main Process (main.ts)
     │
     │ ipcMain.on('pause-timer', handler)
     ▼
Timer paused in main process
     │
     │ mainWindow.webContents.send('timer-update', time)
     ▼
preload.ts (contextBridge)
     │
     │ ipcRenderer.on('timer-update', callback)
     ▼
React Component updates UI
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18 or higher ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)

Verify installation:
```bash
node --version
npm --version
```

### Installation

```bash
# Clone or navigate to the project
cd "save-eyes-reminder"

# Install dependencies
npm install
```

## 🛠️ Development

### Run in Development Mode

```bash
npm run electron:dev
```

**What this command does:**
1. Compiles Electron TypeScript files to `electron-dist/`
2. Renames `.js` to `.cjs` for CommonJS compatibility
3. Starts Vite dev server on `http://localhost:5173`
4. Waits for Vite to be ready
5. Launches Electron app in development mode
6. Opens Chrome DevTools automatically

**Development workflow:**
- React files (`src/`) → Hot reload automatically (no restart needed)
- Electron files (`electron/`) → Requires manual restart of `npm run electron:dev`

### Run in Development Mode with Watch (Recommended)

```bash
npm run electron:dev:watch
```

**This is the preferred development command!** It automatically recompiles Electron files when you make changes to the `electron/` folder, so you don't need to manually restart. Both React and Electron files will hot-reload.

### React-Only Development (UI testing)

```bash
npm run dev
```

Opens the React app in your browser at `http://localhost:5173`. Note: Electron APIs won't work in browser mode.

## 📦 Building for Production

### Build for Current Platform

```bash
npm run electron:build
```

### Build for Specific Platforms

```bash
# Windows (NSIS installer)
npm run electron:build:win

# macOS (DMG)
npm run electron:build:mac

# Linux (AppImage)
npm run electron:build:linux
```

**What happens during build:**
1. Compiles Electron TypeScript files
2. Bundles React app with Vite (production mode)
3. Runs `electron-builder` to create platform-specific installer
4. Outputs to `release/` directory

**Build outputs:**
- Windows: `release/Save Eyes Reminder Setup X.X.X.exe`
- macOS: `release/Save Eyes Reminder X.X.X.dmg`
- Linux: `release/Save Eyes Reminder X.X.X.AppImage`

### Build Configuration

Platform-specific settings are in [package.json](file:///c:/Code%20Projects/save%20eyes%20reminder%20react/save-eyes-reminder/package.json#L45-L73) under the `build` key:
- App ID and product name
- Icon paths
- Installer formats (NSIS, DMG, AppImage)

## 📁 Project Structure

```
save-eyes-reminder/
├── electron/                    # Electron source files (TypeScript)
│   ├── main.ts                  # Main process - window, tray, timer logic
│   └── preload.ts               # Preload script - IPC bridge
│
├── electron-dist/               # Compiled Electron files (CommonJS)
│   ├── main.cjs                 # Compiled main process
│   └── preload.cjs              # Compiled preload script
│
├── src/                         # React application
│   ├── App.tsx                  # Main React component
│   ├── App.css                  # Component styles
│   ├── main.tsx                 # React entry point
│   ├── index.css                # Global styles
│   └── types/
│       └── electron.d.ts        # TypeScript types for electronAPI
│
├── dist/                        # Built React app (generated by Vite)
│
├── release/                     # Production builds (generated by electron-builder)
│
├── public/                      # Static assets (icons, etc.)
│
├── package.json                 # Dependencies and scripts
├── vite.config.ts               # Vite configuration
├── tsconfig.electron.json       # TypeScript config for Electron
├── tsconfig.app.json            # TypeScript config for React
└── rename-electron.mjs          # Script to rename .js to .cjs
```

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start React dev server only (browser) |
| `npm run electron:dev` | Start full Electron app in development mode |
| `npm run electron:dev:watch` | **Recommended:** Start Electron app with auto-recompilation |
| `npm run electron:compile` | Compile Electron TypeScript files |
| `npm run electron:watch` | Watch and auto-compile Electron files |
| `npm run electron:build` | Build for current platform |
| `npm run electron:build:win` | Build Windows installer |
| `npm run electron:build:mac` | Build macOS DMG |
| `npm run electron:build:linux` | Build Linux AppImage |
| `npm run build` | Build React app only |
| `npm run preview` | Preview built React app |
| `npm run lint` | Run ESLint |

## 🐛 Troubleshooting

### Electron app won't start

**Problem**: Error about missing `electron-dist/main.cjs`

**Solution**:
```bash
npm run electron:compile
```

### Port 5173 already in use

**Problem**: Vite dev server fails to start

**Solution**: Kill the process using port 5173 or change the port in `vite.config.ts`:
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:5173 | xargs kill
```

### Auto-launch permission denied

**Problem**: Console error about auto-launch failing

**Solution**: This is non-critical. The app will still work. On Windows, run as administrator once to grant permissions.

### Icon not showing in system tray

**Problem**: Tray icon missing or shows default icon

**Solution**: Ensure icon file exists at `public/icon.png`:
```bash
ls public/icon.png
```

### Build fails with missing files

**Problem**: `electron-builder` can't find files

**Solution**: Run full build sequence:
```bash
npm run electron:compile
npm run build
npm run electron:build
```

### TypeScript compilation errors

**Problem**: Errors in `electron/` folder

**Solution**:
```bash
# Clean and recompile
rm -rf electron-dist
npm run electron:compile
```

## 📝 Key Concepts for React Developers

### 1. Security: Context Isolation

React **cannot** directly access Node.js APIs. All communication must go through the preload script using IPC. This prevents security vulnerabilities.

### 2. State Synchronization

Timer state lives in the **main process** (Node.js), not React. React only displays the state and sends commands. This ensures the timer continues even if the UI crashes.

### 3. Lifecycle Management

- Main process controls window lifecycle (open, close, minimize to tray)
- React component mounts when window opens, unmounts when window closes
- Configuration persists via JSON file in user data directory

### 4. Development vs Production

- **Development**: React loads from `http://localhost:5173` (hot reload enabled)
- **Production**: React loads from `dist/index.html` (static files)

See `electron/main.ts` line 89-94 for the logic that switches between modes.

## 🤝 Contributing

1. Make changes to React files → See instant updates
2. Make changes to Electron files → Restart `npm run electron:dev`
3. Test thoroughly before building
4. Build for your target platform before distributing

## 📄 License

Private project - All rights reserved
