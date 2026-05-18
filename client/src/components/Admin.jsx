import { useEffect, useState } from 'react';
import { api } from '../api.js';

/**
 * Tiny admin page at /admin. Adds a new breed to the catalog via
 * POST /api/items behind the X-Admin-Key header. The key is remembered
 * in localStorage so you only type it once per browser.
 *
 * No router lib — the App component renders this when the path matches.
 */
const KEY_STORAGE = 'swipevote.adminKey';

export default function Admin() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(KEY_STORAGE) || '');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState({ type: 'idle' });
  const [items, setItems] = useState(null);
  const [previewBroken, setPreviewBroken] = useState(false);

  const loadItems = async () => {
    try {
      const list = await api.items();
      setItems(list);
    } catch (e) {
      console.error('items load failed', e);
    }
  };

  useEffect(() => { loadItems(); }, []);
  useEffect(() => { localStorage.setItem(KEY_STORAGE, adminKey); }, [adminKey]);
  useEffect(() => { setPreviewBroken(false); }, [imageUrl]);

  const submit = async (e) => {
    e.preventDefault();
    if (!label.trim() || !imageUrl.trim() || !adminKey) {
      setStatus({ type: 'error', msg: 'Label, image URL, and admin key are required.' });
      return;
    }
    setStatus({ type: 'submitting' });
    try {
      const r = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim(),
          image_url: imageUrl.trim(),
        }),
      });
      if (r.status === 401) {
        setStatus({ type: 'error', msg: 'Admin key rejected (401). Check the value and try again.' });
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setStatus({ type: 'error', msg: j.error || `${r.status} ${r.statusText}` });
        return;
      }
      const { id } = await r.json();
      setStatus({ type: 'success', id });
      setLabel(''); setDescription(''); setImageUrl('');
      loadItems();
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    }
  };

  const recent = items ? items.slice().reverse().slice(0, 8) : [];

  return (
    <div className="admin">
      <header className="admin__header">
        <a className="admin__back" href="/">← Back to the app</a>
        <div className="admin__kicker">Editor · Volume 01</div>
        <h1 className="admin__title">Publish a <em>Breed</em></h1>
        <p className="admin__byline">
          {items
            ? <>{items.length} breeds currently in circulation. Add another to the lineup.</>
            : 'Loading the catalog…'}
        </p>
      </header>

      <form className="admin__form" onSubmit={submit} autoComplete="off">
        <label className="admin__field">
          <span className="admin__label">Admin key</span>
          <input
            type="password"
            value={adminKey}
            onChange={e => setAdminKey(e.target.value)}
            placeholder="X-Admin-Key header value"
          />
          <span className="admin__hint">
            Default in dev: <code>swipe-admin</code> (override via the <code>ADMIN_KEY</code> env var on the server). Stored in this browser's local storage so you only type it once.
          </span>
        </label>

        <label className="admin__field">
          <span className="admin__label">Breed name <span className="admin__req">*</span></span>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Catalan Sheepdog"
            maxLength={80}
            required
          />
        </label>

        <label className="admin__field">
          <span className="admin__label">Tagline</span>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="A loyal herder from the Pyrenees."
            maxLength={200}
          />
        </label>

        <label className="admin__field">
          <span className="admin__label">Image URL <span className="admin__req">*</span></span>
          <input
            type="url"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://…"
            required
          />
          {imageUrl && /^https?:\/\//.test(imageUrl) && !previewBroken && (
            <img
              className="admin__preview"
              src={imageUrl}
              alt="preview"
              onError={() => setPreviewBroken(true)}
            />
          )}
          {previewBroken && (
            <span className="admin__hint admin__hint--err">Couldn't load that image. Double-check the URL.</span>
          )}
        </label>

        <div className="admin__actions">
          <button
            type="submit"
            className="btn btn--text"
            disabled={status.type === 'submitting'}
          >
            {status.type === 'submitting' ? 'Publishing…' : 'Publish breed →'}
          </button>
          {status.type === 'success' && (
            <span className="admin__status admin__status--ok">
              ✓ Published as Edition №{String(status.id).padStart(3, '0')}.
            </span>
          )}
          {status.type === 'error' && (
            <span className="admin__status admin__status--err">{status.msg}</span>
          )}
        </div>
      </form>

      <section className="admin__recent">
        <h2 className="admin__h2">Most recent in the catalog</h2>
        {recent.length === 0 ? (
          <p className="admin__empty">No items yet.</p>
        ) : (
          <ul className="admin__list">
            {recent.map(it => (
              <li className="admin__row" key={it.id}>
                <img src={it.image_url} alt="" className="admin__thumb" loading="lazy" />
                <div>
                  <div className="admin__name">{it.label}</div>
                  <div className="admin__id">Edition №{String(it.id).padStart(3, '0')}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
