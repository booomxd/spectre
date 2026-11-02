// Patch notes list from playvalorant.com's public news page data (title, date, image, short blurb only).
const axios = require('axios');

const BASE = 'https://playvalorant.com';
const URL = BASE + '/en-us/news/tags/patch-notes/';
let cache = null;

function strip(html) {
    return String(html || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
}

async function fetchNotes() {
    const res = await axios.get(URL, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' }, responseType: 'text' });
    const m = String(res.data).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) throw new Error('Patch notes source changed (no page data)');
    const blades = JSON.parse(m[1]).props?.pageProps?.page?.blades || [];
    const items = blades.filter(b => Array.isArray(b.items)).flatMap(b => b.items);
    const out = items.map(i => {
        const link = i.action?.payload?.url || '';
        return {
            title: i.title,
            date: i.publishedAt || i.analytics?.publishDate || null,
            image: i.imageMedia?.url || i.media?.url || null,
            description: strip(i.description?.body),
            url: link.startsWith('http') ? link : BASE + link,
        };
    }).filter(n => n.title && n.url !== BASE);
    if (!out.length) throw new Error('No patch notes found');
    return out.sort((a, b) => new Date(b.date) - new Date(a.date));
}

module.exports = ({ handle }) => {
    handle('patchnotes:list', async (force) => {
        if (!cache || force) cache = fetchNotes().catch(e => { cache = null; throw e; });
        return cache;
    });
};
