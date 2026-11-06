// Spectre's own releases on GitHub: patch notes, update checks and one-click updates.
// Installed copies download the new installer, verify it and run it (it closes Spectre, installs and relaunches).
// Portable copies and dev builds just link to the release page.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const axios = require('axios');

// SPECTRE_UPDATE_REPO=owner/name points update checks at another repo (testing an update without a public release).
const REPO = /^[\w.-]+\/[\w.-]+$/.test(process.env.SPECTRE_UPDATE_REPO || '') ? process.env.SPECTRE_UPDATE_REPO : 'booomxd/spectre';
const CHECK_EVERY = 6 * 60 * 60 * 1000;

// "2.10.0" > "2.9.1"
function newer(a, b) {
    const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    return false;
}

module.exports = ({ handle, emit, app, isDev }) => {
    // Installed by the NSIS installer (has an uninstaller next to the exe), as opposed to the portable zip.
    const installed = !isDev && fs.existsSync(path.join(path.dirname(process.execPath), 'Uninstall Spectre.exe'));
    const current = () => app.getVersion();

    let cache = { at: 0, list: null };
    async function releases(force) {
        if (!force && cache.list && Date.now() - cache.at < 10 * 60 * 1000) return cache.list;
        const res = await axios.get(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Spectre' }, timeout: 10000,
        });
        const list = res.data.filter(r => !r.draft && !r.prerelease).map(r => {
            const exe = (r.assets || []).find(a => /setup.*\.exe$/i.test(a.name));
            return {
                version: r.tag_name.replace(/^v/, ''), name: r.name || r.tag_name, date: r.published_at, notes: r.body || '', url: r.html_url,
                installer: exe ? { name: exe.name, url: exe.browser_download_url, size: exe.size, digest: exe.digest || null } : null,
            };
        });
        cache = { at: Date.now(), list };
        return list;
    }

    let status = { current: null, available: false };
    async function check() {
        const latest = (await releases(true))[0];
        const available = !!latest && newer(latest.version, current());
        status = {
            current: current(), latest: latest?.version || null, available, url: latest?.url || null,
            canInstall: available && installed && !!latest.installer,
        };
        if (available) emit('update:status', status);
        return status;
    }

    let installing = false;
    async function install() {
        if (installing) throw new Error('Already updating');
        const latest = (await releases())[0];
        if (!status.canInstall || !latest?.installer) throw new Error('No update to install');
        installing = true;
        try {
            const dir = path.join(os.tmpdir(), 'spectre-update');
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, latest.installer.name);
            const res = await axios.get(latest.installer.url, { responseType: 'stream', timeout: 30000, headers: { 'User-Agent': 'Spectre' } });
            const total = latest.installer.size || +res.headers['content-length'] || 0;
            const hash = crypto.createHash('sha256');
            let got = 0, lastPct = -1;
            await new Promise((resolve, reject) => {
                const out = fs.createWriteStream(file);
                res.data.on('data', chunk => {
                    hash.update(chunk); got += chunk.length;
                    const pct = total ? Math.floor(got / total * 100) : null;
                    if (pct !== lastPct) { lastPct = pct; emit('update:progress', { pct }); }
                });
                res.data.on('error', reject);
                out.on('error', reject);
                out.on('finish', resolve);
                res.data.pipe(out);
            });
            // GitHub publishes a sha256 for release assets; refuse a download that doesn't match it.
            const want = latest.installer.digest?.replace(/^sha256:/, '');
            if (want && hash.digest('hex') !== want) { fs.rmSync(file, { force: true }); throw new Error('Download was corrupted, please try again'); }
            spawn(file, [], { detached: true, stdio: 'ignore' }).unref();
            setTimeout(() => app.quit(), 800);
            return true;
        } catch (e) {
            installing = false;
            throw e;
        }
    }

    handle('spectre:releases', () => releases());
    handle('update:status', () => (status.current ? status : check()));
    handle('update:check', () => check());
    handle('update:install', () => install());

    setTimeout(() => check().catch(() => { }), 8000);
    setInterval(() => check().catch(() => { }), CHECK_EVERY);
};
