import React from 'react';

const KEY = 'odak-pomodoro-v1';
const THEMES = {
  focus: { bg: 'oklch(0.972 0.012 55)', soft: 'oklch(0.9 0.06 40)', accent: 'oklch(0.62 0.19 33)' },
  short: { bg: 'oklch(0.972 0.014 165)', soft: 'oklch(0.9 0.05 165)', accent: 'oklch(0.56 0.11 165)' },
  long: { bg: 'oklch(0.968 0.014 265)', soft: 'oklch(0.88 0.05 265)', accent: 'oklch(0.52 0.14 268)' },
};
const MODE_META = {
  focus: { label: 'Odak', status: 'Odaklan', key: '1' },
  short: { label: 'Kısa mola', status: 'Kısa mola', key: '2' },
  long: { label: 'Uzun mola', status: 'Uzun mola', key: '3' },
};
const ORDER = ['focus', 'short', 'long'];
const R = 138, C = 2 * Math.PI * R;
const MUTED_TRACK = 'oklch(0.22 0.02 260 / 0.14)';
const pad = n => String(n).padStart(2, '0');
const today = () => new Date().toISOString().slice(0, 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const SHORTCUTS = [
  { label: 'Başlat / Duraklat', key: 'Boşluk' }, { label: 'Sıfırla', key: 'R' }, { label: 'Sonrakine geç', key: 'N' },
  { label: 'Mod değiştir', key: '1 · 2 · 3' }, { label: 'Yeni görev', key: 'T' }, { label: 'Ayarlar', key: 'S' }, { label: 'Pencereyi kapat', key: 'Esc' },
];

const CloseIcon = ({ size = 16, width = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
);

export default class App extends React.Component {
  inputRef = React.createRef();
  state = this.load();

  load() {
    const def = {
      settings: { focus: 25, short: 5, long: 15, every: 4, autoBreak: true, autoFocus: false, sound: true },
      mode: 'focus', running: false, endAt: 0, remaining: 25 * 60, cycle: 0,
      tasks: [
        { id: 1, title: 'Lineer cebir — 3. bölüm problemleri', est: 3, count: 1, done: false },
        { id: 2, title: 'HCI makalesini oku ve not çıkar', est: 2, count: 0, done: false },
        { id: 3, title: 'Kelime tekrarı', est: 1, count: 1, done: true },
      ],
      activeId: 1, stats: { day: today(), count: 0, minutes: 0 },
      draft: '', draftEst: 1, settingsOpen: false, helpOpen: false, toast: null,
    };
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s) {
        const st = { ...def, ...s, settingsOpen: false, helpOpen: false, toast: null, draft: '' };
        if (st.stats.day !== today()) st.stats = { day: today(), count: 0, minutes: 0 };
        if (st.running) {
          const rem = Math.ceil((st.endAt - Date.now()) / 1000);
          if (rem > 0) st.remaining = rem; else { st.running = false; st.remaining = st.settings[st.mode] * 60; }
        }
        return st;
      }
    } catch (e) {}
    return def;
  }
  save() {
    const { settingsOpen, helpOpen, toast, draft, ...rest } = this.state;
    try { localStorage.setItem(KEY, JSON.stringify(rest)); } catch (e) {}
  }

  componentDidMount() {
    this.iv = setInterval(() => this.tick(), 250);
    this.onKey = e => this.handleKey(e);
    window.addEventListener('keydown', this.onKey);
    this.updateTitle();
  }
  componentWillUnmount() { clearInterval(this.iv); window.removeEventListener('keydown', this.onKey); clearTimeout(this.tt); }
  componentDidUpdate() {
    this.save();
    this.updateTitle();
  }
  updateTitle() {
    const s = this.state;
    document.title = `${pad(Math.floor(s.remaining / 60))}:${pad(s.remaining % 60)} · ${MODE_META[s.mode].status} — Odak`;
  }

  tick() {
    const s = this.state;
    if (!s.running) return;
    const rem = Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000));
    if (rem !== s.remaining) this.setState({ remaining: rem });
    if (rem <= 0) this.complete();
  }

  chime() {
    if (!this.state.settings.sound) return;
    try {
      const ctx = this.ac || (this.ac = new (window.AudioContext || window.webkitAudioContext)());
      [659.25, 783.99, 1046.5].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.18;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 1);
      });
    } catch (e) {}
  }

  showToast(text, undoFn) {
    clearTimeout(this.tt);
    this.setState({ toast: { text, undo: undoFn || null } });
    this.tt = setTimeout(() => this.setState({ toast: null }), undoFn ? 6000 : 4000);
  }
  hideToast = () => { clearTimeout(this.tt); this.setState({ toast: null }); };
  undo = () => { const u = this.state.toast && this.state.toast.undo; this.hideToast(); u && u(); };

  complete(skipped) {
    const s = this.state, st = s.settings;
    if (!skipped) this.chime();
    let next, upd = {};
    if (s.mode === 'focus') {
      const cycle = s.cycle + 1;
      upd.cycle = cycle;
      if (!skipped) {
        upd.stats = { ...s.stats, count: s.stats.count + 1, minutes: s.stats.minutes + st.focus };
        upd.tasks = s.tasks.map(t => t.id === s.activeId ? { ...t, count: t.count + 1 } : t);
      }
      next = cycle % st.every === 0 ? 'long' : 'short';
    } else next = 'focus';
    const auto = next === 'focus' ? st.autoFocus : st.autoBreak;
    const dur = st[next] * 60;
    this.setState({ ...upd, mode: next, remaining: dur, running: auto, endAt: Date.now() + dur * 1000 });
    if (!skipped) this.showToast(s.mode === 'focus' ? `Pomodoro tamamlandı. ${next === 'long' ? 'Uzun' : 'Kısa'} mola zamanı.` : 'Mola bitti. Odaklanmaya hazır mısın?');
  }

  toggle = () => {
    const s = this.state;
    if (this.ac && this.ac.state === 'suspended') this.ac.resume();
    if (s.running) this.setState({ running: false });
    else this.setState({ running: true, endAt: Date.now() + s.remaining * 1000 });
  };
  snapshot() { const { mode, remaining, running, endAt, cycle } = this.state; return { mode, remaining: running ? Math.max(1, Math.ceil((endAt - Date.now()) / 1000)) : remaining, running: false, cycle }; }
  reset = () => {
    const s = this.state, full = s.settings[s.mode] * 60;
    if (s.remaining === full && !s.running) return;
    const snap = this.snapshot();
    this.setState({ running: false, remaining: full });
    this.showToast('Zamanlayıcı sıfırlandı.', () => this.setState(snap));
  };
  skip = () => { const snap = this.snapshot(); this.complete(true); this.showToast(`${MODE_META[snap.mode].label} atlandı.`, () => this.setState(snap)); };
  setMode(m) {
    const s = this.state;
    if (m === s.mode) return;
    const wasActive = s.running || s.remaining !== s.settings[s.mode] * 60;
    const snap = this.snapshot();
    this.setState({ mode: m, running: false, remaining: s.settings[m] * 60 });
    if (wasActive) this.showToast(`${MODE_META[m].label} moduna geçildi.`, () => this.setState(snap));
  }

  handleKey(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.key === 'Escape') { this.closeModal(); if (tag === 'input') e.target.blur(); return; }
    if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (this.state.settingsOpen || this.state.helpOpen) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); this.toggle(); }
    else if (k === 'r') this.reset();
    else if (k === 'n') this.skip();
    else if (k === '1' || k === '2' || k === '3') this.setMode(ORDER[+k - 1]);
    else if (k === 't') { e.preventDefault(); this.inputRef.current && this.inputRef.current.focus(); }
    else if (k === '?' || k === '/') this.setState({ helpOpen: true });
    else if (k === 's') this.setState({ settingsOpen: true });
  }

  addTask = e => {
    e.preventDefault();
    const title = this.state.draft.trim();
    if (!title) return;
    const t = { id: Date.now(), title, est: this.state.draftEst, count: 0, done: false };
    this.setState(s => ({ tasks: [...s.tasks, t], draft: '', draftEst: 1, activeId: s.activeId && s.tasks.some(x => x.id === s.activeId && !x.done) ? s.activeId : t.id }));
  };
  delTask(id) {
    const s = this.state, idx = s.tasks.findIndex(t => t.id === id), task = s.tasks[idx];
    this.setState({ tasks: s.tasks.filter(t => t.id !== id), activeId: s.activeId === id ? null : s.activeId });
    this.showToast('Görev silindi.', () => this.setState(st => { const arr = [...st.tasks]; arr.splice(idx, 0, task); return { tasks: arr, activeId: s.activeId }; }));
  }
  toggleTask(id) {
    this.setState(s => {
      const tasks = s.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
      let activeId = s.activeId;
      if (activeId === id && tasks.find(t => t.id === id).done) { const n = tasks.find(t => !t.done); activeId = n ? n.id : null; }
      return { tasks, activeId };
    });
  }
  clearDone = () => {
    const prev = this.state.tasks, doneCount = prev.filter(t => t.done).length;
    this.setState({ tasks: prev.filter(t => !t.done) });
    this.showToast(`${doneCount} görev temizlendi.`, () => this.setState({ tasks: prev }));
  };
  setSetting(k, v) {
    this.setState(s => {
      const settings = { ...s.settings, [k]: v };
      const upd = { settings };
      if (k === s.mode && !s.running) upd.remaining = v * 60;
      return upd;
    });
  }
  closeModal = () => this.setState({ settingsOpen: false, helpOpen: false });

  renderDial(theme, progress, total) {
    const s = this.state;
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const m = Math.floor(s.remaining / 60), sec = s.remaining % 60, str = `${pad(m)}:${pad(sec)}`;
    const isBreak = s.mode !== 'focus';
    const active = s.tasks.find(t => t.id === s.activeId && !t.done);
    const ang = progress * 2 * Math.PI - Math.PI / 2;
    const ticks = [];
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * 2 * Math.PI - Math.PI / 2, major = i % 5 === 0, r1 = 152, r2 = major ? 160 : 157;
      ticks.push(
        <line key={i} x1={160 + r1 * Math.cos(a)} y1={160 + r1 * Math.sin(a)} x2={160 + r2 * Math.cos(a)} y2={160 + r2 * Math.sin(a)}
          stroke={i / 60 < progress ? theme.accent : 'oklch(0.22 0.02 260 / 0.16)'} strokeWidth={major ? 2 : 1.2} strokeLinecap="round" style={{ transition: 'stroke .5s' }} />
      );
    }
    const statusLabel = s.running ? MODE_META[s.mode].status : (s.remaining === total ? 'Hazır' : 'Duraklatıldı');
    const taskLine = isBreak ? (s.mode === 'long' ? 'Kalk, biraz yürü' : 'Nefes al, gözlerini dinlendir') : (active ? active.title : 'Görev seçilmedi');

    return (
      <div className="dial">
        {isBreak && <div aria-hidden="true" className="dial-breathe" />}
        {s.running && !isBreak && <div aria-hidden="true" className="dial-ripple" />}
        <svg viewBox="0 0 320 320" aria-hidden="true">
          {ticks}
          <circle cx="160" cy="160" r={R} fill="none" stroke="oklch(0.22 0.02 260 / 0.08)" strokeWidth="5" />
          <circle cx="160" cy="160" r={R} fill="none" stroke={theme.accent} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
            transform="rotate(-90 160 160)" style={{ transition: 'stroke-dashoffset 1s linear, stroke 900ms' }} />
          <circle cx={160 + R * Math.cos(ang)} cy={160 + R * Math.sin(ang)} r="8" fill="oklch(1 0 0)" stroke={theme.accent} strokeWidth="3"
            style={{ transition: 'cx 1s linear, cy 1s linear, stroke 900ms' }} />
        </svg>
        <div className="dial-center">
          <span className="status">{statusLabel}</span>
          <div role="timer" aria-live="off" aria-label={`${m} dakika ${sec} saniye kaldı`} className="digits">
            {str.split('').map((c, i) => c === ':'
              ? <span key="c" className={'colon' + (s.running && !reduced ? ' blinking' : '')}>:</span>
              : <span key={i + '-' + c} className="digit" style={reduced ? { animation: 'none' } : undefined}>{c}</span>)}
          </div>
          <span className="task-line">{taskLine}</span>
        </div>
      </div>
    );
  }

  renderTasks(theme) {
    const s = this.state;
    const doneCount = s.tasks.filter(t => t.done).length;
    return (
      <section aria-label="Görevler" className="tasks">
        <div className="tasks-head">
          <h2>Görevler</h2>
          <span>{s.tasks.length ? `${doneCount}/${s.tasks.length} tamamlandı` : ''}</span>
        </div>

        <form onSubmit={this.addTask} className="task-form">
          <label>
            <span className="sr-only">Yeni görev</span>
            <input ref={this.inputRef} value={s.draft} onChange={e => this.setState({ draft: e.target.value })}
              placeholder="Ne üzerinde çalışacaksın?  (T)" maxLength={80} className="task-input" />
          </label>
          <div title="Tahmini pomodoro" className="est">
            <button type="button" onClick={() => this.setState({ draftEst: Math.max(1, s.draftEst - 1) })} aria-label="Tahmini azalt">−</button>
            <span aria-label="Tahmini pomodoro">{s.draftEst}×</span>
            <button type="button" onClick={() => this.setState({ draftEst: Math.min(8, s.draftEst + 1) })} aria-label="Tahmini artır">+</button>
          </div>
          <button type="submit" disabled={!s.draft.trim()} className="add-btn">Ekle</button>
        </form>

        {s.tasks.length === 0 && (
          <div className="empty">Henüz görev yok.<br />Bu oturumda çalışacağın konuyu ekle, zamanlayıcı onu takip etsin.</div>
        )}

        <ul className="task-list">
          {s.tasks.map(t => {
            const isA = t.id === s.activeId && !t.done;
            return (
              <li key={t.id} className={'task' + (isA ? ' active' : '') + (t.done ? ' done' : '')}
                onClick={() => { if (!t.done) this.setState({ activeId: t.id }); }} title="Aktif görev yap">
                <button onClick={e => { e.stopPropagation(); this.toggleTask(t.id); }} role="checkbox" aria-checked={t.done} aria-label="Tamamlandı olarak işaretle" className="check">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
                </button>
                <div className="task-body">
                  <span className="task-title">{t.title}</span>
                  <div className="pips">
                    {Array.from({ length: Math.max(t.est, t.count) }, (_, i) => (
                      <span key={i} className="pip" style={{ background: i < t.count ? (t.done ? 'oklch(0.7 0.01 260)' : theme.accent) : MUTED_TRACK }} />
                    ))}
                    <span className="count">{t.count}/{t.est}</span>
                  </div>
                </div>
                {isA && <span className="badge">Aktif</span>}
                <button onClick={e => { e.stopPropagation(); this.delTask(t.id); }} aria-label="Görevi sil" title="Sil" className="del-btn">
                  <CloseIcon />
                </button>
              </li>
            );
          })}
        </ul>

        {doneCount > 0 && <button onClick={this.clearDone} className="link-btn">Tamamlananları temizle</button>}
      </section>
    );
  }

  renderSettings() {
    const st = this.state.settings;
    const fields = [
      ['focus', 'Odak', 'dk', 1, 90, THEMES.focus.accent],
      ['short', 'Kısa mola', 'dk', 1, 30, THEMES.short.accent],
      ['long', 'Uzun mola', 'dk', 1, 60, THEMES.long.accent],
      ['every', 'Uzun mola aralığı', 'pomo', 2, 8, 'oklch(0.22 0.02 260 / 0.3)'],
    ];
    const toggles = [
      ['autoBreak', 'Molaları otomatik başlat', 'Odak bitince mola kendiliğinden başlar'],
      ['autoFocus', 'Odağı otomatik başlat', 'Mola bitince yeni pomodoro başlar'],
      ['sound', 'Bitiş sesi', 'Oturum sonunda kısa bir zil çalar'],
    ];
    return (
      <div onClick={this.closeModal} className="overlay">
        <div role="dialog" aria-modal="true" aria-label="Ayarlar" onClick={e => e.stopPropagation()} className="dialog">
          <div className="dialog-head">
            <h2>Ayarlar</h2>
            <button onClick={this.closeModal} aria-label="Kapat (Esc)" className="close-btn"><CloseIcon /></button>
          </div>
          <div className="group">
            <span className="group-title">Süreler</span>
            {fields.map(([k, label, unit, min, max, dot]) => (
              <div key={k} className="field">
                <span className="field-label"><span className="field-dot" style={{ background: dot }} />{label}</span>
                <div className="stepper">
                  <button onClick={() => this.setSetting(k, clamp(st[k] - 1, min, max))} aria-label="Azalt">−</button>
                  <span>{st[k]} {unit}</span>
                  <button onClick={() => this.setSetting(k, clamp(st[k] + 1, min, max))} aria-label="Artır">+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="group">
            <span className="group-title">Davranış</span>
            {toggles.map(([k, label, desc]) => (
              <button key={k} role="switch" aria-checked={st[k]} onClick={() => this.setSetting(k, !st[k])} className="switch-row">
                <span className="switch-text"><span>{label}</span><span>{desc}</span></span>
                <span className="switch" />
              </button>
            ))}
          </div>
          <button onClick={this.closeModal} className="dark-btn">Tamam</button>
        </div>
      </div>
    );
  }

  renderHelp() {
    return (
      <div onClick={this.closeModal} className="overlay">
        <div role="dialog" aria-modal="true" aria-label="Klavye kısayolları" onClick={e => e.stopPropagation()} className="dialog small">
          <h2>Kısayollar</h2>
          {SHORTCUTS.map(sc => (
            <div key={sc.key} className="shortcut"><span>{sc.label}</span><kbd>{sc.key}</kbd></div>
          ))}
          <button onClick={this.closeModal} className="dark-btn">Anladım</button>
        </div>
      </div>
    );
  }

  render() {
    const s = this.state, st = s.settings, theme = THEMES[s.mode];
    const total = st[s.mode] * 60, progress = Math.min(1, Math.max(0, 1 - s.remaining / total));
    const inCycle = s.cycle % st.every;
    const primaryLabel = s.running ? 'Duraklat' : (s.remaining === total ? 'Başlat' : 'Devam et');

    return (
      <div className="app" style={{ '--bg': theme.bg, '--soft': theme.soft, '--accent': theme.accent }}>
        <div className="progress-bar" style={{ width: progress * 100 + '%' }} />
        <div aria-hidden="true" className="blob" />

        <header className="header">
          <div className="brand">
            <span className="logo">Odak<span>.</span></span>
            <span className="tagline">Pomodoro ile ders çalış</span>
          </div>
          <div className="header-actions">
            <div title="Bugünkü ilerleme" className="today">
              <span className="label">Bugün</span>
              <span className="num">{s.stats.count} pomodoro</span>
              <span className="sep" />
              <span className="num">{s.stats.minutes} dk</span>
            </div>
            <button onClick={() => this.setState({ helpOpen: true })} aria-label="Klavye kısayolları" title="Kısayollar (?)" className="pill-btn help">?</button>
            <button onClick={() => this.setState({ settingsOpen: true })} aria-label="Ayarlar" title="Ayarlar" className="pill-btn settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
              Ayarlar
            </button>
          </div>
        </header>

        <main className="main">
          <section aria-label="Zamanlayıcı" className="timer">
            <div role="tablist" aria-label="Mod" className="tabs">
              <div aria-hidden="true" className="tab-indicator" style={{ transform: `translateX(${ORDER.indexOf(s.mode) * 100}%)` }} />
              {ORDER.map(k => (
                <button key={k} role="tab" aria-selected={k === s.mode} onClick={() => this.setMode(k)} title={`${st[k]} dk (${MODE_META[k].key})`} className="tab">
                  {MODE_META[k].label}
                </button>
              ))}
            </div>

            {this.renderDial(theme, progress, total)}

            <div className="controls">
              <button onClick={this.reset} aria-label="Sıfırla (R)" title="Sıfırla (R)" className="round-btn reset">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
              </button>
              <button onClick={this.toggle} aria-label={primaryLabel} title={`${primaryLabel} (Boşluk)`} className="primary-btn">
                {s.running
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" /></svg>}
                {primaryLabel}
              </button>
              <button onClick={this.skip} aria-label="Sonrakine geç (N)" title="Sonrakine geç (N)" className="round-btn skip">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5l10 7-10 7z" /><path d="M19 5v14" /></svg>
              </button>
            </div>

            <div className="cycle">
              <div className="cycle-dots" aria-label={`Döngüde ${inCycle} / ${st.every} pomodoro`}>
                {Array.from({ length: st.every }, (_, i) => {
                  const cur = i === inCycle && s.mode === 'focus';
                  return <span key={i} className="cycle-dot" style={{ width: cur ? 28 : 8, background: i < inCycle || cur ? theme.accent : MUTED_TRACK }} />;
                })}
              </div>
              <span className="cycle-text">Uzun molaya {st.every - inCycle} pomodoro</span>
            </div>
          </section>

          {this.renderTasks(theme)}
        </main>

        <footer className="footer">
          <span><kbd>Boşluk</kbd> Başlat / Duraklat</span>
          <span><kbd>R</kbd> Sıfırla</span>
          <span><kbd>N</kbd> Atla</span>
          <span><kbd>1 2 3</kbd> Mod</span>
        </footer>

        {s.settingsOpen && this.renderSettings()}
        {s.helpOpen && this.renderHelp()}

        {s.toast && (
          <div role="status" aria-live="polite" className="toast">
            <span className="toast-dot" />
            <span>{s.toast.text}</span>
            {s.toast.undo && <button onClick={this.undo} className="toast-undo">Geri al</button>}
            <button onClick={this.hideToast} aria-label="Kapat" className="toast-close"><CloseIcon size={14} width={2} /></button>
          </div>
        )}
      </div>
    );
  }
}
