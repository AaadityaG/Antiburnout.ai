import { rename, watch, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const electronDist = join(__dirname, 'electron-dist')

async function renameFiles() {
  try {
    await rename(join(electronDist, 'main.js'), join(electronDist, 'main.cjs'))
    await rename(join(electronDist, 'preload.js'), join(electronDist, 'preload.cjs'))
    console.log('✓ Renamed Electron files to .cjs')
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Files don't exist yet, wait for compilation
      return
    }
    if (err.code === 'EPERM') {
      // Files already renamed, skip
      return
    }
    console.error('Error renaming files:', err.message)
  }
}

// Check if running in watch mode
const isWatchMode = process.argv.includes('--watch')

if (isWatchMode) {
  console.log('Starting Electron file watcher...')
  await mkdir(electronDist, { recursive: true })
  await renameFiles()
  
  // Watch the electron-dist directory for changes
  const watcher = watch(electronDist, { recursive: false })
  
  for await (const event of watcher) {
    if (event.filename && (event.filename.endsWith('.js') || event.filename === 'main.js' || event.filename === 'preload.js')) {
      console.log(`Change detected: ${event.filename}`)
      // Small delay to ensure file write is complete
      setTimeout(() => renameFiles(), 100)
    }
  }
} else {
  await renameFiles()
}
