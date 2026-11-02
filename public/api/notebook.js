// Notes page notebook: sections, each with free notes, crosshair codes, links and chat snippets.
// Stored in userData/notebook.json as { sections: [...] }. The page saves the whole notebook (it's small).
const LIMITS = { sections: 60, name: 40, notes: 3000, items: 100, label: 60, code: 400, url: 500, snippet: 300 };
const COLORS = ['accent', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];
const ICONS = ['note', 'target', 'map', 'star', 'flag', 'book', 'zap', 'users'];

const str = (v, max) => String(v ?? '').slice(0, max);
const id = v => str(v, 40) || Math.random().toString(36).slice(2, 10);
const list = (v, fn) => (Array.isArray(v) ? v : []).slice(0, LIMITS.items).map(fn);

function clean(s) {
    return {
        id: id(s.id),
        name: str(s.name, LIMITS.name).trim() || 'Untitled',
        color: COLORS.includes(s.color) ? s.color : 'accent',
        icon: ICONS.includes(s.icon) ? s.icon : 'note',
        notes: str(s.notes, LIMITS.notes),
        crosshairs: list(s.crosshairs, c => ({ id: id(c.id), name: str(c.name, LIMITS.label), code: str(c.code, LIMITS.code) })),
        links: list(s.links, l => ({ id: id(l.id), title: str(l.title, LIMITS.label), url: str(l.url, LIMITS.url) })),
        snippets: list(s.snippets, t => ({ id: id(t.id), text: str(t.text, LIMITS.snippet) })),
        updatedAt: Number(s.updatedAt) || Date.now(),
    };
}

const fresh = () => ({ sections: [clean({ id: 'general', name: 'General' })] });

module.exports = ({ riot, handle }) => {
    const load = () => {
        const d = riot.readStore('notebook', null);
        return d?.sections?.length ? d : fresh();
    };
    handle('notebook:get', async () => load());
    handle('notebook:save', async (doc) => {
        const sections = (doc?.sections || []).slice(0, LIMITS.sections).map(clean);
        const saved = sections.length ? { sections } : fresh();
        riot.writeStore('notebook', saved);
        return saved;
    });
    handle('notebook:reset', async () => {
        const d = fresh();
        riot.writeStore('notebook', d);
        return d;
    });
};
