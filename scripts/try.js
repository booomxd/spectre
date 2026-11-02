// Dev helper: call any backend channel against the live Riot Client without launching Electron.
//   node scripts/try.js <channel> [jsonArg1] [jsonArg2] ...
//   node scripts/try.js --list
// Loads public/riot.js, connects, registers every public/api module with a fake ctx, then invokes the channel.
const path = require('path');
const fs = require('fs');
const os = require('os');
const riot = require('../public/riot');

const handlers = {};
const fakeApp = { getPath: () => path.join(os.tmpdir(), 'spectre-try'), setLoginItemSettings() { }, getLoginItemSettings: () => ({}) };
const ctx = {
    riot, app: fakeApp, isDev: true, BrowserWindow: function () { throw new Error('No windows in try.js') }, getMainWindow: () => null,
    ipcMain: { on() { }, handle() { } },
    handle: (ch, fn) => { handlers[ch] = fn; },
    emit: (ch, payload) => console.log('[emit]', ch, JSON.stringify(payload)?.slice(0, 300)),
};

(async () => {
    riot.setStoreDir(path.join(fakeApp.getPath(), 'store'));
    const dir = path.join(__dirname, '..', 'public', 'api');
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
        try { require(path.join(dir, f))(ctx); } catch (e) { console.log('Module failed', f, e.message); }
    }
    const [channel, ...rawArgs] = process.argv.slice(2);
    if (!channel || channel === '--list') { console.log(Object.keys(handlers).sort().join('\n')); process.exit(0); }
    await riot.connect();
    if (!handlers[channel]) { console.log('No handler', channel); process.exit(1); }
    const args = rawArgs.map(a => { try { return JSON.parse(a); } catch (e) { return a; } });
    try {
        const out = await handlers[channel](...args);
        const s = JSON.stringify(out, null, 1);
        console.log(s.length > 4000 ? s.slice(0, 4000) + `\n... (${s.length} chars)` : s);
    } catch (e) { console.log('ERROR', riot.errMsg(e)); }
    process.exit(0);
})();
