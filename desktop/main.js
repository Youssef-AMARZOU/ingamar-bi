const { app, BrowserWindow, dialog, shell } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

let mainWindow = null
let backendProcess = null
const BACKEND_PORT = 5000
const FRONTEND_PORT = 3000

function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend')
  }
  return path.join(__dirname, '..', 'backend')
}

function getPythonPath() {
  if (app.isPackaged) {
    const venvPython = path.join(getBackendPath(), 'venv', 'Scripts', 'python.exe')
    if (fs.existsSync(venvPython)) return venvPython
    return 'python'
  }
  return 'python'
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const backendDir = getBackendPath()
    const python = getPythonPath()

    const env = {
      ...process.env,
      FLASK_APP: 'app:create_app',
      FLASK_ENV: 'production',
      GROQ_API_KEY: process.env.GROQ_API_KEY || '',
      INGAMAR_DB_URI: process.env.INGAMAR_DB_URI || `sqlite://${path.join(app.getPath('userData'), 'ingamar.db')}`,
    }

    backendProcess = spawn(python, ['-m', 'flask', 'run', '--host=127.0.0.1', '--port', String(BACKEND_PORT)], {
      cwd: backendDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend: ${data}`)
      if (data.toString().includes('Running on')) resolve()
    })

    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend Error: ${data}`)
      if (data.toString().includes('Running on')) resolve()
    })

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err)
      reject(err)
    })

    backendProcess.on('exit', (code) => {
      console.log(`Backend exited with code ${code}`)
    })

    setTimeout(() => resolve(), 5000)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'INGAMAR BI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'icon.png'),
  })

  mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(async () => {
  try {
    await startBackend()
    createWindow()
  } catch (err) {
    dialog.showErrorBox('Startup Error', `Failed to start INGAMAR BI: ${err.message}`)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
})
