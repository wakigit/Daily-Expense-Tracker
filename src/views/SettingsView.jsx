import { ROAST_DEFAULTS } from '../lib/roastContract';
import { useState } from 'react';
import { money } from '../lib/format';
import { THEMES, PALETTE } from '../themes/themes';
import Icon from '../components/Icon';

export default function SettingsView({
  roastPrefs = ROAST_DEFAULTS, onRoastPrefs = () => {},
  themeId, onTheme,
  motion, onMotion,
  appName, onAppName,
  cats, budDraft, onBudDraft, onSaveBudgets, saved,
  delCatId, onAskDelCat, onDelCat,
  newCat, onNewCat, onAddCat,
  /* Defaulted rather than required: a view that throws when one prop is
     forgotten takes the whole screen down, and this one is far from the
     code that supplies it. */
  sample = {},
}) {
  const sampleState = {
    loaded: false, rowCount: 0, ownRows: 0, hasBudgets: false,
    canRestoreBudgets: false, months: '', onLoad: () => {}, onRemove: () => {},
    ...sample,
  };
  /* 'idle' | 'confirm-load' | 'confirm-remove'. Loading over existing data and
     removing data are both one tap from being regretted, so each asks once —
     and the asking names what will happen to what is already there. */
  const [ask, setAsk] = useState('idle');
  const draftTotal = cats.reduce((s, c) => s + (Number(budDraft[c.id]) || 0), 0);

  return (
    <>
      {/* ── Theme ── */}
      <section className="card set--theme" style={{ '--i': 0 }}>
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
      <section className="card set--motion" style={{ '--i': 1 }}>
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

      <section className="card set--roast">
        <h2 className="display card-title">Your personal roaster</h2>
        <p className="settings-roast-hint">A short joke after each new expense. Sends that purchase and a few spending summaries to OpenAI, never your full ledger or notes. Preferences stay on this device and are included only when enabled.</p>
        {[
          ['enabled', 'Roast new purchases', 'On by default. Turn off to stop requests and dismiss the current roast.'],
          ['singapore', 'Singapore references', 'Optional local references, mostly natural English.'],
          ['smu', 'SMU student references', 'Optional BOSS bidding and class participation references when relevant.'],
        ].map(([key, label, hint]) => <button key={key} type="button" role="switch" aria-checked={roastPrefs[key]} onClick={() => onRoastPrefs({ ...roastPrefs, [key]: !roastPrefs[key] })} className="switch-row">
          <span><span className="switch-label">{label}</span><span className="switch-hint">{hint}</span></span>
          <span className={`switch${roastPrefs[key] ? ' on' : ''}`} aria-hidden="true"><span className="switch-knob" /></span>
        </button>)}
        <div className="field"><label htmlFor="roast-name">Preferred name (optional)</label><input id="roast-name" type="text" maxLength={40} value={roastPrefs.name} placeholder="Leave blank to skip" onChange={ev => onRoastPrefs({ ...roastPrefs, name: ev.target.value })} /></div>
      </section>

      {/* ── App name ── */}
      <section className="card set--name" style={{ '--i': 2 }}>
        <h2 className="display card-title">App name</h2>
        <div className="field">
          <label htmlFor="s-name">Your name for this app</label>
          <input
            id="s-name"
            type="text"
            placeholder="TallyAI"
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
      <section className="card set--budgets" style={{ '--i': 3 }}>
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
              placeholder="0"
              value={budDraft[c.id] ?? ''}
              onChange={(ev) => onBudDraft(c.id, ev.target.value)}
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
          <span className="display money" style={{ fontSize: '1rem', color: 'var(--tx)' }}>{money(draftTotal)}</span>
        </div>

        <button onClick={onSaveBudgets} className="btn-primary btn-block">
          {saved ? 'Saved' : 'Save budgets'}
        </button>
      </section>

      {/* ── Sample data ── */}
      <section className="card set--sample" style={{ '--i': 5 }}>
        <h2 className="display card-title">Sample data</h2>

        {sampleState.loaded ? (
          <>
            <p className="set-note">
              <strong>Sample data is loaded.</strong> {sampleState.rowCount} invented
              transactions across {sampleState.months}. Your saved budgets determine the current status, including any personal spending.
              None of it is real.
            </p>
            {sampleState.ownRows > 0 && (
              <p className="set-note">
                Your own {sampleState.ownRows}{' '}
                {sampleState.ownRows === 1 ? 'entry is' : 'entries are'} still here and
                will be kept.
              </p>
            )}

            {ask === 'confirm-remove' ? (
              <div className="danger-zone">
                <p className="set-note">
                  Remove the {sampleState.rowCount} sample entries
                  {sampleState.canRestoreBudgets
                    ? ' and restore unchanged sample budgets, keeping your later budget edits?'
                    : ' and leave the budgets as they are?'}{' '}
                  {sampleState.ownRows > 0
                    ? 'Nothing you entered yourself is touched.'
                    : 'Your budget edits are kept.'}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-danger"
                    onClick={() => { sampleState.onRemove(); setAsk('idle'); }}>
                    Remove sample data
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setAsk('idle')}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => setAsk('confirm-remove')}>
                Remove sample data
              </button>
            )}
          </>
        ) : (
          <>
            <p className="set-note">
              Fills the app with an invented Singapore student's spending — this
              month so far and the whole of last month, across seven spending categories.
              Sample budgets are calculated for about 76% usage this month in an empty app.
              Budgets are shared between months; last month's status depends on its actual total.
            </p>
            <p className="set-note set-note--quiet">
              Demonstration figures only. Nothing here comes from a real account,
              card or statement, and it can be removed again without touching
              anything you have entered. Compatible categories are reused; missing sample categories are added. Removal keeps categories you edited or used for personal entries.
            </p>

            {ask === 'confirm-load' ? (
              <div className="danger-zone">
                <p className="set-note">
                  You already have {sampleState.ownRows}{' '}
                  {sampleState.ownRows === 1 ? 'entry' : 'entries'}
                  {sampleState.hasBudgets ? ' and a set of budgets' : ''}. Your entries
                  will be kept alongside the sample
                  {sampleState.hasBudgets
                    ? '. Sample-category budgets will temporarily replace matching budgets; other budgets are kept. Removal restores unchanged budgets and keeps later edits.'
                    : '.'}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-primary"
                    onClick={() => { sampleState.onLoad(); setAsk('idle'); }}>
                    Load it anyway
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setAsk('idle')}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  // Only ask when there is something to lose.
                  if (sampleState.ownRows > 0 || sampleState.hasBudgets) setAsk('confirm-load');
                  else sampleState.onLoad();
                }}
              >
                Load sample data
              </button>
            )}
          </>
        )}
      </section>

      {/* ── Categories ── */}
      <section className="card set--cats" style={{ '--i': 4 }}>
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

      {/* The credit used to sit under every screen, including Home, where it
          competed with the wallpaper. Here it is findable but out of the way. */}
      <p className="footer-credit">made by @wakii___</p>
    </>
  );
}
