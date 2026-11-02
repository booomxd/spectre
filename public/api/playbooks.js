// Strategy playbooks: folders (playbooks) of strategies, each with steps of board items.
const fs = require('fs');
const axios = require('axios');

module.exports = (ctx) => {
    const { riot, handle } = ctx;
    const load = () => { const d = riot.readStore('playbooks', []); return Array.isArray(d) ? d : []; };

    handle('playbooks:list', () => load());

    // Upsert a whole playbook by id.
    handle('playbooks:save', (pb) => {
        if (!pb?.id) throw new Error('Playbook id missing');
        const all = load();
        const i = all.findIndex(p => p.id === pb.id);
        if (i >= 0) all[i] = pb; else all.push(pb);
        riot.writeStore('playbooks', all);
        return { id: pb.id, savedAt: Date.now() };
    });

    handle('playbooks:delete', (id) => {
        riot.writeStore('playbooks', load().filter(p => p.id !== id));
        return true;
    });

    // Saves a PNG data URL through a native save dialog.
    handle('playbooks:exportPng', async ({ dataUrl, name } = {}) => {
        const { dialog } = require('electron');
        const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl || '');
        if (!m) throw new Error('Invalid image data');
        const safe = String(name || 'strategy').replace(/[\/:*?"<>|]+/g, '-').slice(0, 80);
        const win = ctx.getMainWindow();
        const res = await dialog.showSaveDialog(win, {
            title: 'Export strategy image',
            defaultPath: safe + '.png',
            filters: [{ name: 'PNG image', extensions: ['png'] }],
        });
        if (res.canceled || !res.filePath) return { canceled: true };
        fs.writeFileSync(res.filePath, Buffer.from(m[1], 'base64'));
        return { saved: true, path: res.filePath };
    });

    // valorant-api.com images have no CORS headers, so fetch them here as data URLs to keep the export canvas untainted.
    handle('playbooks:imageData', async (urls) => {
        const out = {};
        await Promise.all([...new Set(urls || [])].filter(u => /^https:\/\/media\.valorant-api\.com\//.test(u)).map(async (u) => {
            try {
                const r = await axios.get(u, { responseType: 'arraybuffer', timeout: 15000 });
                out[u] = 'data:' + (r.headers['content-type'] || 'image/png') + ';base64,' + Buffer.from(r.data).toString('base64');
            } catch (e) { /* missing image: renderer draws a placeholder */ }
        }));
        return out;
    });
};
