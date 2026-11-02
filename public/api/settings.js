// App settings (one JSON store) plus small app helpers used by the Settings page.
const DEFAULTS = {
    launchAtLogin: false,
    minimizeToTray: false,
    overlay: { opacity: 0.9, scale: 1 },
    discord: {
        enabled: false, showMode: true, showMap: true, showAgent: false, agentImage: false, showRank: true, showPeak: false,
        showLevel: false, showParty: true, showScore: true, showElapsed: true, showLobby: true,
    },
    startPage: 'dashboard',
    spectrePresence: true,
};

// Stored values merged over the defaults (one level deep for the nested groups).
function load(riot) {
    const s = riot.readStore('settings', {}) || {};
    return {
        ...DEFAULTS, ...s,
        overlay: { ...DEFAULTS.overlay, ...s.overlay },
        discord: { ...DEFAULTS.discord, ...s.discord },
    };
}

module.exports = ({ riot, handle, emit, app }) => {
    handle('settings:get', () => load(riot));

    handle('settings:set', (patch = {}) => {
        const cur = load(riot);
        const next = {
            ...cur, ...patch,
            overlay: { ...cur.overlay, ...patch.overlay },
            discord: { ...cur.discord, ...patch.discord },
        };
        riot.writeStore('settings', next);
        if ('launchAtLogin' in patch) {
            try { app.setLoginItemSettings({ openAtLogin: !!next.launchAtLogin }); } catch (e) { }
        }
        emit('settings:changed', next);
        return next;
    });

    handle('app:info', () => ({
        version: app.getVersion(),
        dataPath: app.getPath('userData'),
        electron: process.versions.electron || null,
        platform: process.platform,
    }));

    handle('app:openDataFolder', async () => {
        const err = await require('electron').shell.openPath(app.getPath('userData'));
        if (err) throw new Error(err);
    });

    // Clears the browser cache and the in-memory caches; saved settings, memos etc. are kept.
    handle('app:clearCache', async () => {
        const { session } = require('electron');
        await session.defaultSession.clearCache();
        await session.defaultSession.clearStorageData({ storages: ['cachestorage', 'shadercache', 'serviceworkers'] });
        return true;
    });
};
module.exports.load = load;
module.exports.DEFAULTS = DEFAULTS;
