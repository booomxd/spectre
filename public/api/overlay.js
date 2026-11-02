// Always-on-top transparent overlay window (loads the app at #/overlay).

const path = require('path');

module.exports = ({ riot, handle, emit, app, BrowserWindow, isDev }) => {
    let win = null;

    const defaults = { width: 340, height: 460, x: null, y: 80 };
    const saved = () => ({ ...defaults, ...riot.readStore('overlay', {}) });
    const state = () => ({ open: !!win && !win.isDestroyed() });

    function save() {
        if (!win || win.isDestroyed()) return;
        const [x, y] = win.getPosition();
        const [width, height] = win.getSize();
        riot.writeStore('overlay', { x, y, width, height });
    }

    function open() {
        if (win && !win.isDestroyed()) return;
        const s = saved();
        win = new BrowserWindow({
            width: s.width, height: s.height, x: s.x ?? undefined, y: s.y,
            frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
            resizable: true, minWidth: 260, minHeight: 200, focusable: true,
            webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: !isDev },
        });
        win.setAlwaysOnTop(true, 'screen-saver');
        win.setMenu(null);
        if (isDev) win.loadURL('http://localhost:5173/#/overlay');
        else win.loadFile(path.join(__dirname, '..', '..', 'build', 'index.html'), { hash: '/overlay' });
        win.on('moved', save);
        win.on('resized', save);
        win.on('closed', () => { win = null; emit('overlay:state', state()); });
        emit('overlay:state', state());
    }

    function close() {
        if (win && !win.isDestroyed()) { save(); win.close(); }
        win = null;
        emit('overlay:state', state());
    }

    handle('overlay:state', () => state());
    handle('overlay:toggle', () => { state().open ? close() : open(); return state(); });
    handle('overlay:close', () => { close(); return state(); });
};
