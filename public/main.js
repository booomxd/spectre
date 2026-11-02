const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const riot = require('./riot');

const isDev = !app.isPackaged;
var mainWindow;

app.on('window-all-closed', () => { app.quit(); });

// Wraps a handler so the renderer always gets { ok, data } or { ok: false, error }.
function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
        try { return { ok: true, data: await fn(...args) }; }
        catch (err) {
            console.log(`[${channel}]`, riot.errMsg(err));
            return { ok: false, error: riot.errMsg(err) };
        }
    });
}

// Push an event to the renderer (used for live updates).
function emit(channel, payload) {
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send(channel, payload));
}

const ctx = { riot, handle, emit, ipcMain, app, BrowserWindow, isDev, getMainWindow: () => mainWindow };

function loadModules() {
    const dir = path.join(__dirname, 'api');
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
        try { require(path.join(dir, file))(ctx); console.log('Loaded module', file); }
        catch (err) { console.log('Module failed', file, err.stack); }
    }
}

// Keep trying to connect until the Riot Client is up, and tell the renderer when it changes.
async function connectLoop() {
    if (!riot.state.connected) {
        try { emit('riot:status', await riot.connect()); }
        catch (e) { emit('riot:status', riot.status()); }
    }
    setTimeout(connectLoop, riot.state.connected ? 60000 : 5000);
}

handle('riot:status', () => riot.status());
handle('riot:connect', () => riot.connect());
handle('app:openExternal', url => shell.openExternal(url));
handle('win:minimize', () => mainWindow.minimize());
handle('win:maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
handle('win:close', () => mainWindow.close());

app.whenReady().then(() => {
    riot.setStoreDir(path.join(app.getPath('userData'), 'store'));
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1040,
        minHeight: 680,
        frame: false,
        backgroundColor: '#0b0b0f',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: !isDev
        }
    });
    mainWindow.setMenu(null);
    loadModules();
    if (isDev) mainWindow.loadURL('http://localhost:5173');
    else mainWindow.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
    connectLoop();
});

process.on("unhandledRejection", async (reason) => {
    console.log(reason?.stack || reason);
});
