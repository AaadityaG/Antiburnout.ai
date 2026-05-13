import { rename } from 'fs/promises'
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
    console.error('Error renaming files:', err.message)
  }
}

renameFiles()
