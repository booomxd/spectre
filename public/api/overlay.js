// Always-on-top transparent overlay window (loads the app at #/overlay).
// Shown without stealing focus from the game, toggled from the app or a global hotkey, optionally click-through
// ("locked") and optionally shown automatically while you're in agent select or a match.

const path = require('path');
const { globalShortcut } = require('electron');
const settings = require('./settings');

module.exports = ({ riot, handle, emit, BrowserWindow, isDev, getMainWindow }) => {
    let win = null;

    const defaults = { width: 340, height: 480, x: null, y: 80 };
    const saved = () => ({ ...defaults, ...riot.readStore('overlay', {}) });
    const cfg = () => settings.load(riot).overlay;
    const alive = () => !!win && !win.isDestroyed();
    const visible = () => alive() && win.isVisible();
    const state = () => ({ open: visible(), locked: !!cfg().locked });

    function savePos() {
        if (!alive()) return;
        const [x, y] = win.getPosition();
        const [width, height] = win.getSize();
        riot.writeStore('overlay', { x, y, width, height });
    }

    // Click-through: the game gets every click while locked.
    const applyLock = () => { if (alive()) win.setIgnoreMouseEvents(!!cfg().locked); };

    function create() {
        const s = saved();
        win = new BrowserWindow({
            width: s.width, height: s.height, x: s.x ?? undefined, y: s.y, show: false,
            frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
            resizable: true, minWidth: 260, minHeight: 160, focusable: true,
            webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: !isDev },
        });
        win.setAlwaysOnTop(true, 'screen-saver');
        win.setMenu(null);
        if (isDev) win.loadURL('http://localhost:5173/#/overlay');
        else win.loadFile(path.join(__dirname, '..', '..', 'build', 'index.html'), { hash: '/overlay' });
        win.once('ready-to-show', () => { applyLock(); win.showInactive(); emit('overlay:state', state()); });
        win.on('moved', savePos);
        win.on('resized', savePos);
        win.on('show', () => emit('overlay:state', state()));
        win.on('hide', () => emit('overlay:state', state()));
        win.on('closed', () => { win = null; emit('overlay:state', state()); });
    }

    // Shown without taking focus, so the game keeps keyboard and mouse.
    function show() {
        if (!alive()) return create();
        applyLock();
        win.showInactive();
    }
    function hide() { if (visible()) { savePos(); win.hide(); } }
    const toggle = () => (visible() ? hide() : show());
    function destroy() { if (alive()) { savePos(); win.destroy(); } win = null; }

    function setLocked(locked) {
        const next = settings.update(riot, { overlay: { locked } });
        emit('settings:changed', next);
        emit('overlay:state', state());
    }

    // ---- global hotkeys ----
    let registered = [], paused = false, hotkeys = {};
    function registerHotkeys() {
        if (!globalShortcut) return; // not running inside Electron (scripts/try.js)
        registered.forEach(k => { try { globalShortcut.unregister(k); } catch (e) { } });
        registered = [];
        const c = cfg();
        hotkeys = {};
        for (const [name, key, fn] of [['toggle', c.hotkey, toggle], ['lock', c.lockHotkey, () => setLocked(!cfg().locked)]]) {
            let ok = null;
            if (key && !paused) {
                try { ok = globalShortcut.register(key, fn); } catch (e) { ok = false; }
                if (ok) registered.push(key);
            }
            hotkeys[name] = { key: key || '', ok };
        }
        emit('overlay:hotkeys', hotkeys);
    }

    settings.onChange((next, patch) => {
        if (!patch.overlay) return;
        if ('hotkey' in patch.overlay || 'lockHotkey' in patch.overlay) registerHotkeys();
        if ('locked' in patch.overlay) applyLock();
    });

    // ---- auto show while in agent select or a match ----
    let wasInMatch = false, autoShown = false;
    async function inMatch() {
        for (const p of ['core-game', 'pregame']) {
            try { if ((await riot.glz('get', `${p}/v1/players/${riot.state.puuid}`)).MatchID) return true; } catch (e) { }
        }
        return false;
    }
    async function autoTick() {
        if (!cfg().autoShow || !riot.state.connected) return;
        const now = await inMatch();
        // Only act when a match starts or ends, so hiding it by hand mid-match sticks.
        if (now && !wasInMatch && !visible()) { show(); autoShown = true; }
        if (!now && wasInMatch && autoShown) { hide(); autoShown = false; }
        wasInMatch = now;
    }
    setInterval(() => autoTick().catch(() => { }), 5000);

    registerHotkeys();
    // The overlay goes away with the app instead of keeping it alive on its own.
    getMainWindow?.()?.on('closed', destroy);

    handle('overlay:state', () => state());
    handle('overlay:toggle', () => { toggle(); return state(); });
    handle('overlay:close', () => { hide(); return state(); });
    handle('overlay:lock', locked => { setLocked(!!locked); return state(); });
    handle('overlay:hotkeys', () => hotkeys);
    // Paused while the Settings page records a new key, so pressing the current combo doesn't fire it.
    handle('overlay:pauseHotkeys', on => { paused = !!on; registerHotkeys(); return hotkeys; });
};
