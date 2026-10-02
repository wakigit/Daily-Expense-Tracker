import { money } from '../lib/format';
import { THEMES, PALETTE } from '../themes/themes';
import Icon from '../components/Icon';

export default function SettingsView({
  themeId, onTheme,
  motion, onMotion,
  appName, onAppName,
  cats, budDraft, onBudDraft, onSaveBudgets, saved,
  delCatId, onAskDelCat, onDelCat,
  newCat, onNewCat, onAddCat,
}) {
  const draftTotal = cats.reduce((s, c) => s + (budDraft[c.id] || 0), 0);

  return (
    <>
      {/* ── Theme ── */}
      <section className="card" style={{ '--i': 0 }}>
        <h2 className="display card-title">Theme</h2>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <div
              key={t.id}
              className={`theme-card${themeId === t.id ? ' sel' : ''}`}
              onClick={() => onTheme(t.id)}
              role="radio"
              aria-checked={themeId === t.id}
              tabIndex={0}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onTheme(t.id); } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div
                  className="theme-orb"
                  style={{
                    background: `linear-gradient(135deg,${t.preview[0]},${t.preview[1]})`,
                    border: `2.5px solid ${t.vars['--accent']}`,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>
                    {t.name}
                  </p>
                  {themeId === t.id && (
                    <p style={{ fontSize: 11, color: t.vars['--accent'], margin: '2px 0 0' }}>Selected</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Motion ── */}
      <section className="card" style={{ '--i': 1 }}>
        <h2 className="display card-title">Motion</h2>
        <button
          type="button"
          role="switch"
          aria-checked={motion === 'on'}
          onClick={() => onMotion(motion === 'on' ? 'auto' : 'on')}
          className="switch-row"
        >
          <span>
            <span className="switch-label">Animate the wallpaper</span>
            <span className="switch-hint">
              Your device has Reduce Motion turned on, which stops the scene. Turn
              this on to let it move anyway.
            </span>
          </span>
          <span className={`switch${motion === 'on' ? ' on' : ''}`} aria-hidden="true">
            <span className="switch-knob" />
          </span>
        </button>
      </section>

      {/* ── App name ── */}
      <section className="card" style={{ '--i': 2 }}>
        <h2 className="display card-title">App name</h2>
        <div className="field">
          <label htmlFor="s-name">Your name for this app</label>
          <input
            id="s-name"
            type="text"
            placeholder="Expense Tracker"
            value={appName}
            onChange={(ev) => onAppName(ev.target.value)}
            maxLength={30}
          />
        </div>
        <p style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: -4 }}>
          Updates the title shown at the top
        </p>
      </section>

      {/* ── Budgets ── */}
      <section className="card" style={{ '--i': 3 }}>
        <h2 className="display card-title">Monthly budgets</h2>
        {cats.map((c) => (
          <div key={c.id} className="field">
            <label htmlFor={`b-${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className="dot" style={{ width: 10, height: 10, background: c.color }} />
              {c.label}
            </label>
            <input
              id={`b-${c.id}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={budDraft[c.id] ?? 0}
              onChange={(ev) => onBudDraft(c.id, parseFloat(ev.target.value) || 0)}
            />
          </div>
        ))}

        <div style={{
          background: 'var(--chip)',
          borderRadius: 'var(--r-ctl)',
          padding: '12px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '1.2rem',
        }}>
          <span style={{ fontSize: 14, color: 'var(--tx-sub)' }}>Total monthly budget</span>
          <span className="display" style={{ fontSize: '1rem', color: 'var(--tx)' }}>{money(draftTotal)}</span>
        </div>

        <button onClick={onSaveBudgets} className="btn-primary btn-block">
          {saved ? 'Saved' : 'Save budgets'}
        </button>
      </section>

      {/* ── Categories ── */}
      <section className="card" style={{ '--i': 4 }}>
        <h2 className="display card-title">Categories</h2>

        {cats.map((c) => {
          const asking = delCatId === c.id;
          return (
            <div key={c.id} style={{ borderRadius: 13, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <div className="dot" style={{ width: 14, height: 14, background: c.color }} />
                  <span className="truncate" style={{ fontSize: 15 }}>{c.label}</span>
                </div>
                <button
                  onClick={() => onAskDelCat(asking ? null : c.id)}
                  className="icon-btn"
                  style={{ color: asking ? 'var(--st-over)' : 'var(--tx-muted)' }}
                  aria-label={`Delete ${c.label}`}
                ><Icon name="trash" size={16} /></button>
              </div>

              {asking && (
                <div className="danger-zone">
                  <p style={{ fontSize: 12, color: 'var(--st-over)', marginBottom: 8 }}>
                    "{c.label}" and all its expenses will be deleted.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onAskDelCat(null)} style={{ fontSize: 13, padding: '6px 14px', minHeight: 38 }}>
                      Cancel
                    </button>
                    <button
                      onClick={() => onDelCat(c.id)}
                      style={{ fontSize: 13, padding: '6px 14px', minHeight: 38, color: 'var(--st-over)', borderColor: 'var(--st-over)' }}
                    >
                      Yes, delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div style={{ borderTop: '1px solid var(--card-line)', marginTop: '1rem', paddingTop: '1rem' }}>
          <p style={{ fontSize: 13, color: 'var(--tx-sub)', marginBottom: 10, fontWeight: 500 }}>
            Add new category
          </p>
          <input
            type="text"
            placeholder="e.g. Gifts, Travel, Gym..."
            value={newCat.label}
            onChange={(ev) => onNewCat({ ...newCat, label: ev.target.value })}
            style={{ marginBottom: 10 }}
            aria-label="New category name"
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {PALETTE.map((col) => (
              <div
                key={col}
                onClick={() => onNewCat({ ...newCat, color: col })}
                className={`swatch${newCat.color === col ? ' sel' : ''}`}
                style={{ background: col }}
                role="radio"
                aria-checked={newCat.color === col}
                aria-label={`Colour ${col}`}
              />
            ))}
          </div>
          <button onClick={onAddCat} className="btn-primary btn-block">+ Add category</button>
        </div>
      </section>
    </>
  );
}
