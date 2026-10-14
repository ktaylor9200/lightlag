// LIGHT LAG — game state, UI and flow.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nm = (id) => (id === 'R2' ? 'R\u2032' : id);
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const ANIM = 380;

// ---------- persistence (graceful without storage) ----------
const SAVE_KEY = 'lightlag.v1';
let store = null;
try { store = window.localStorage; store.getItem(SAVE_KEY); } catch (e) { store = null; }
function loadSave() {
  let s = null;
  try { s = store ? JSON.parse(store.getItem(SAVE_KEY) || 'null') : null; } catch (e) { s = null; }
  const d = { reached: 1, endingsFound: [], settings: { sound: true, reduced: false }, codex: [], cleared: [], tutorialDone: false, seenOpening: false };
  if (!s || typeof s !== 'object') return d;
  return Object.assign(d, s, { settings: Object.assign(d.settings, s.settings || {}) });
}
function persist() { try { if (store) store.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) {} }

const G = {
  save: loadSave(), n: 1, L: null, plan: [], queue: [], now: 0, p: 1, animT0: 0,
  res: null, out: null, fin: null, unlock: {}, exitSeen: {}, exitTrue: {},
  sel: null, mode: 'move', logs: [], hint: 0, won: false, flags: {}, glintIdx: 0, tut: -1,
  locked: false, ff: null, finIntro: 3, ui: { tags: [], moveLines: [], highlight: [] }, outInfo: [],
};
AU.on = G.save.settings.sound;
const mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const reduced = () => G.save.settings.reduced || mqReduce.matches;
const actOf = (n) => (n <= 4 ? 1 : n <= 7 ? 2 : 3);
const levelData = (n) => (n === 8 ? FINALE_LEVEL : LEVELS_JSON[n - 1]);
const STARS = Array.from({ length: 70 }, () => [Math.random(), Math.random(), 0.15 + Math.random() * 0.5, Math.random() * 6]);

// ---------- canvas ----------
const canvas = $('board'), ctx = canvas.getContext('2d');
let geom = null;
function layout() {
  if (!G.L) return;
  const wrap = $('boardwrap');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  // size against the tallest dock so the board doesn't jump when chips appear
  const reserved = innerHeight - 48 - 32 - 236;
  let side = Math.min(w - 8, Math.max(reserved, 0));
  if (side < 240 || side > h) side = Math.min(w - 8, h - 4);
  side = Math.max(140, Math.floor(side));
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.style.width = side + 'px'; canvas.style.height = side + 'px';
  canvas.width = Math.round(side * dpr); canvas.height = Math.round(side * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  geom = makeGeom(side, side, G.L.R);
}
window.addEventListener('resize', () => { layout(); if (replayCtl) replayCtl.resize(); });
if (window.ResizeObserver) new ResizeObserver(() => layout()).observe($('boardwrap'));

function frame() {
  return {
    level: G.L, res: G.res, now: G.now, p: G.p, mode: 'seen', unlock: G.unlock, exitSeen: G.exitSeen, exitTrue: G.exitTrue,
    showHidden: false, fin: G.fin, clock: performance.now(), stars: STARS, ui: Object.assign({ selected: G.sel }, G.ui),
  };
}
function loop(t) {
  if (G.p < 1) G.p = Math.min(1, (t - G.animT0) / ANIM);
  if (G.L && geom && $('overlay').classList.contains('hidden')) render(ctx, geom, frame());
  if (replayCtl) replayCtl.tick(t);
  if (waveCtl) waveCtl(t);
  if (interCtl) interCtl(t);
  requestAnimationFrame(loop);
}

// ---------- level lifecycle ----------
function resim() {
  G.res = SIM.simulate(G.L, G.plan, 80);
  G.exitSeen = {}; G.exitTrue = {};
  for (const e of G.res.events) if (e.type === 'exit') { G.exitTrue[e.data] = e.t; G.exitSeen[e.data] = SIM.seenTick(e); }
  G.out = G.L.objective.type === 'finale' ? null : SIM.outcome(G.L, G.plan, 80, G.res);
  G.fin = G.L.world ? FIN.analyse(G.L, G.plan, G.res) : null;
}
function loadLevel(n) {
  stopFF(); stopHold();
  G.levelToken = (G.levelToken || 0) + 1;
  G.n = n; G.L = levelData(n); G.plan = []; G.queue = []; G.now = 0; G.p = 1; G.sel = null; G.mode = 'move';
  G.won = false; G.flags = { chg: {} }; G.glintIdx = 0; G.hint = 0; G.locked = false; G.logs = [];
  G.unlock = {};
  for (const d of G.L.derelicts || []) G.unlock[d.id] = SIM.firstSeenMove(G.L, d.id);
  G.tut = n === 1 && !G.save.tutorialDone ? 0 : -1;
  G.finIntro = n === 8 ? 0 : 3;
  resim(); layout(); clearCoach();
  for (const l of SCRIPT[n].startLog || []) addLog(l);
  if (G.tut === 0) setCoach('Tap your drone.');
  if (n === 8) finIntroShow();
  updateUI();
}

function advance() {
  finishAnim();
  const sent = G.queue.length;
  for (const o of G.queue) G.plan.push(Object.assign({ t: G.now }, o));
  G.queue = [];
  if (sent) { resim(); AU.thoom(); G.sel = null; G.mode = 'move'; }
  G.now++;
  G.p = reduced() ? 1 : 0; G.animT0 = performance.now();
  const yb = $('year'); yb.classList.remove('bump'); void yb.offsetWidth; yb.classList.add('bump');
  const news = processYear(G.now);
  tutorialAfterAdvance(sent);
  updateUI();
  return news;
}
function finishAnim() { G.p = 1; }

function processYear(n) {
  const res = G.res; let news = false;
  for (const e of res.events) if (e.t === n && e.type === 'order_rx') { news = true; AU.tick(); }
  let hiddenGlint = null, glint = false;
  for (const e of res.events) {
    if (SIM.seenTick(e) !== n) continue;
    if (e.type === 'flash' && SIM.eq(e.pos, SIM.HOME)) continue;
    news = true;
    if (e.type === 'glint') {
      const w = res.wat.find((q) => q.id === e.data);
      if (w && w.hidden) hiddenGlint = w; else glint = true;
    } else if (e.type === 'sign') { AU.sign(); addLog(`${nm(e.data)} signed. (Year ${e.t}, seen year ${n}.)`); }
    else if (e.type === 'offended') { AU.object(); onOffended(e); }
    else if (e.type === 'tag') addLog(`Seen: ${e.data[1]} tagged ${e.data[0]} in year ${e.t}.`);
    else if (e.type === 'rec_on') addLog(`Seen: the relay woke in year ${e.t}.`);
    else if (e.type === 'exit') onExit(e);
    else if (e.type === 'split') { addLog(`${nm(e.data[0])} has divided. ${nm(e.data[1])} has been independent since year ${e.t}. Nobody has asked it anything.`); unlockCodex('split'); setCoach(`${nm(e.data[0])} has divided. Requests addressed to ${nm(e.data[0])} do not count for ${nm(e.data[1])}.`, { dismiss: true }); }
    else if (e.type === 'declined') addLog(`${e.data[0]}: noted.`);
    else if (e.type === 'standing') addLog(`${e.data[0]} has accepted standing. Home can no longer calculate where it is.`);
  }
  if (hiddenGlint) {
    AU.chime();
    const lines = SCRIPT[G.n].glints || [];
    const t = G.glintIdx < lines.length ? lines[G.glintIdx] : 'Filed.';
    G.glintIdx++;
    addLog(t.replace('{ring}', SIM.ring(hiddenGlint.pos)));
  } else if (glint) AU.chime();
  // seen image changes: news + discoveries
  for (const key of Object.keys(res.hist)) {
    if (key.startsWith('wat:')) continue;
    const a = SIM.seenPos(res.hist[key], n - 1), b = SIM.seenPos(res.hist[key], n);
    if (!a || !b || SIM.eq(a[1], b[1])) continue;
    news = true;
    const chg = G.flags.chg[key] = G.flags.chg[key] || [];
    chg.push(n);
    if (key.startsWith('der:') && G.n >= 2 && chg.length >= 2 && chg[chg.length - 2] === n - 2 && SIM.ring(b[1]) < SIM.ring(a[1]) && !has('hurry')) {
      unlockCodex('hurry'); addLog(CODEX.hurry.b);
    }
    if (key.startsWith('drone:') && chg.length >= 2 && chg[chg.length - 2] === n - 1 && SIM.ring(b[1]) < SIM.ring(a[1]) && !has('fastdrone')) {
      unlockCodex('fastdrone'); addLog(CODEX.fastdrone.b);
    }
  }
  for (const id in G.unlock) if (G.unlock[id] === n) {
    news = true;
    if (G.tut < 0 || G.tut >= 4) addLog(`Home has now seen ${id} move. Its dashed marker shows where it is now.`);
  }
  if (G.out && G.out.confirmed_at_home === n && !G.won) onWin();
  if (G.n === 8) news = finaleYear(n) || news;
  return news;
}
const has = (k) => G.save.codex.includes(k);
function unlockCodex(k) { if (!has(k)) { G.save.codex.push(k); persist(); } }

function onOffended(e) {
  const N = Math.min(...e.cause);
  const who = nm(e.data);
  addLog(e.tie ? `${who} objected. Two requests reached it in the same year, and a tie is not "first".` : `${who} objected. It heard someone else's request first.`,
    { label: `Rewind to year ${N}`, fn: () => rewindTo(N) });
  if (G.n === 6) {
    const askers = {};
    for (const o of G.plan) if (o.kind === 'FLASH' && o.arg) (askers[o.who] = askers[o.who] || new Set()).add(o.arg);
    if (Object.values(askers).some((s) => s.has('P') && s.has('Q')) && !has('departure')) { unlockCodex('departure'); addLog(CODEX.departure.b); }
  }
}
function onExit(e) {
  const id = e.data, d = G.res.ders.find((x) => x.id === id);
  if (d.tagged !== null) { addLog(`${id} has left the board.`); return; }
  const obj = G.L.objective;
  let fatal = false;
  if (obj.type === 'tag') fatal = obj.ids.includes(id);
  else if (obj.type === 'tag_any') fatal = (G.L.derelicts || []).every((x) => G.exitSeen[x.id] !== undefined && G.exitSeen[x.id] <= G.now && G.res.ders.find((y) => y.id === x.id).tagged === null);
  else if (obj.type === 'rec') { const r = (G.L.receivers || []).find((q) => q.ride === id); fatal = !!r && !G.res.recs.find((q) => q.id === r.id).active; }
  if (fatal) {
    const tx = G.plan.filter((o) => o.t < G.now).map((o) => o.t);
    const N = tx.length ? Math.max(...tx) : Math.max(0, ...Object.values(G.unlock).filter((x) => x !== null));
    addLog(`${id} has left the board ${obj.type === 'rec' ? 'with the relay asleep' : 'untagged'}.`, { label: `Rewind to year ${N}`, fn: () => rewindTo(N) });
  } else addLog(`${id} has left the board untagged. There is another one coming.`);
}

function onWin() {
  G.won = true; stopFF(); AU.chord();
  const o = G.out;
  if (!G.save.cleared.includes(G.n)) G.save.cleared.push(G.n);
  G.save.reached = Math.max(G.save.reached, G.n + 1);
  if (G.n === 1) { G.save.tutorialDone = true; unlockCodex('dilation'); }
  if (G.n === 6) unlockCodex('lightcone');
  persist();
  addLog(`Confirmed. It happened in year ${o.happened_at}. You found out in year ${o.confirmed_at_home}.`);
  setCoach(`Confirmed. It happened in year ${o.happened_at}. You found out in year ${o.confirmed_at_home}.`);
  updateUI();
  const token = G.levelToken;
  setTimeout(() => { if (G.won && G.levelToken === token) showWin(); }, reduced() ? 400 : 1500);
}

function rewindTo(y) {
  if (G.locked) return;
  y = Math.max(0, Math.min(y, G.now));
  finishAnim(); stopFF();
  G.plan = G.plan.filter((o) => o.t < y); G.queue = []; G.now = y; G.won = false; G.sel = null; G.mode = 'move';
  if (G.tut >= 0 && G.tut < 4) { G.tut = 4; }
  clearCoach(); resim(); addLog(`Rewound to year ${y}.`); updateUI();
}

// ---------- tutorial (L1, first time) ----------
function tutorialAfterAdvance(sent) {
  if (G.tut === 2 && sent) { G.tut = 3; setCoach('WAIT.'); }
  else if (G.tut === 3 && G.now >= 2) {
    G.tut = 4;
    const t = 'Home has now seen it move. The dashed marker is where it is now. Your drone is chasing a memory. Re-aim.';
    addLog(t); setCoach(t, { dismiss: true });
  }
}
function tutTap(hex) {
  if (G.tut === 0) {
    if (hex && droneAtHex(hex) === 'A') { select('A'); G.tut = 1; setCoach('Tap the derelict. You are seeing it as it was 4 years ago.'); }
    else toast('Tap your drone first: the gold triangle.');
  } else if (G.tut === 1) {
    const sp = SIM.seenPos(G.res.hist['der:D1'], G.now);
    if (hex && sp && SIM.eq(hex, sp[1])) { queueMove('A', hex); G.tut = 2; setCoach('TRANSMIT. Your order travels at the speed of light.'); }
    else toast('Tap the derelict at the top.');
  } else if (G.tut === 2) toast('Tap TRANSMIT.');
  else if (G.tut === 3) toast('Tap WAIT.');
  updateUI();
}

// ---------- selection & orders ----------
function dronePosCalc(id) {
  if (G.fin && G.fin.standingAt !== null && G.now >= G.fin.standingAt) return null;
  return G.res.hist['drone:' + id][G.now] || null;
}
function droneAtHex(hex) {
  for (const id of Object.keys(G.L.drones || {})) { const c = dronePosCalc(id); if (c && SIM.eq(c, hex)) return id; }
  for (const id of Object.keys(G.L.drones || {})) { const s = SIM.seenPos(G.res.hist['drone:' + id], G.now); if (s && SIM.eq(s[1], hex)) return id; }
  return null;
}
function knownWatchers() {
  return G.res.wat.filter((w) => !w.hidden && (w.born === 0 || w.born + SIM.ring(w.pos) <= G.now));
}
function watcherAtHex(hex) { return knownWatchers().find((w) => SIM.eq(w.pos, hex)) || null; }
function select(id) {
  G.sel = id; G.mode = id === 'HOME' ? 'ask' : 'move';
  if (G.tut === 4 || G.tut < 0) clearCoachIfDismiss();
  AU.step(); updateUI();
}
function deselect() { G.sel = null; G.mode = 'move'; updateUI(); }
function queueMove(id, hex) {
  G.queue = G.queue.filter((o) => !(o.kind === 'MOVE' && o.who === id));
  G.queue.push({ kind: 'MOVE', who: id, arg: hex });
  AU.step(); updateUI();
}
function queueFlash(id, target) {
  if (id === 'HOME') {
    G.queue = G.queue.filter((o) => !(o.kind === 'PING' && o.arg === target));
    G.queue.push({ kind: 'PING', who: 'HOME', arg: target });
  } else {
    G.queue = G.queue.filter((o) => !(o.kind === 'FLASH' && o.who === id));
    G.queue.push({ kind: 'FLASH', who: id, arg: target });
  }
  AU.step();
  if (id === 'HOME') { G.sel = null; G.mode = 'move'; } else G.mode = 'move';
  updateUI();
}
function onBoardTap(x, y) {
  AU.init(); stopFF();
  if (!geom || G.locked) return;
  const hex = geom.hexAt(x, y);
  if (G.n === 8 && G.finIntro < 3) { finIntroNext(); return; }
  if (G.won) return;
  if (G.tut >= 0 && G.tut < 4) { tutTap(hex); return; }
  if (!hex) { deselect(); return; }
  const droneId = droneAtHex(hex);
  if (G.sel && G.sel !== 'HOME' && G.mode === 'move') {
    if (droneId === G.sel) { deselect(); return; }
    if (droneId) { select(droneId); return; }
    if (G.n === 8 && G.fin.standingAt !== null && G.now >= G.fin.standingAt) { toast('V has standing. It no longer takes your orders.'); return; }
    queueMove(G.sel, hex); return;
  }
  if (G.sel && G.mode === 'ask') {
    const w = watcherAtHex(hex);
    if (w) { queueFlash(G.sel, w.id); return; }
    if (droneId) { select(droneId); return; }
    toast('Ask cancelled.');
    if (G.sel === 'HOME') deselect(); else { G.mode = 'move'; updateUI(); }
    return;
  }
  if (droneId) { select(droneId); return; }
  if (SIM.eq(hex, SIM.HOME) && actOf(G.n) === 2) { select('HOME'); return; }
  if (G.sel) { deselect(); return; }
  inspect(hex);
}
canvas.addEventListener('click', (ev) => {
  const r = canvas.getBoundingClientRect();
  onBoardTap(ev.clientX - r.left, ev.clientY - r.top);
});

// ---------- arrival tags ----------
function unlockedNow(id) { const u = G.unlock[id]; return u !== null && u !== undefined && G.now >= u; }
function knownTargets() {
  const out = [];
  for (const r of G.L.receivers || []) {
    if (r.cell) out.push({ id: r.id, kind: 'fix', pos: r.cell, color: COL.relay });
    else if (SIM.seenPos(G.res.hist['der:' + r.ride], G.now)) out.push({ id: r.id, kind: 'ride', ride: r.ride, color: COL.relay });
  }
  for (const w of knownWatchers()) out.push({ id: w.id, kind: 'fix', pos: w.pos, born: w.born, color: '#dccbff' });
  if (G.L.world) out.push({ id: 'W', kind: 'fix', pos: FIN.W, color: COL.world });
  return out;
}
function rideArrival(res, derId, t0, src) {
  const h = res.hist['der:' + derId];
  for (let t = t0; t <= 80; t++) { const p = h[t]; if (!p) return null; if (t - t0 >= SIM.dist(src, p)) return t; }
  return null;
}
function computeTags() {
  const tags = [], lines = [], info = [];
  const q = G.queue.map((o) => Object.assign({ t: G.now, queued: true }, o));
  const all = G.plan.concat(q);
  const res = q.length ? SIM.simulate(G.L, all, 80) : G.res;
  const known = knownTargets();
  for (const o of all) {
    let txt = '';
    if (o.kind === 'MOVE') {
      const rx = res.events.find((e) => e.type === 'order_rx' && e.sent === o.t && e.data[0] === o.who && e.data[1] === 'MOVE');
      if (!rx) { if (o.queued) txt = ''; continue; }
      const later = res.events.filter((e) => e.type === 'order_rx' && e.data[0] === o.who && (e.data[1] === 'MOVE' || e.data[1] === 'STANDING') && e.sent > o.t).map((e) => e.t);
      const cutoff = later.length ? Math.min(...later) : 999;
      const h = res.hist['drone:' + o.who];
      let arr = null;
      for (let t = rx.t; t <= 80 && t < cutoff; t++) if (SIM.eq(h[t], o.arg)) { arr = t; break; }
      if (arr === null) continue;
      if (!o.queued && arr <= G.now) continue;
      tags.push({ pos: o.arg, text: `arrives yr ${arr}`, color: COL.drone, queued: !!o.queued });
      lines.push({ who: o.who, target: o.arg, queued: !!o.queued });
      txt = `arrives yr ${arr}`;
    } else if (o.kind === 'FLASH' || o.kind === 'PING') {
      let t0, src;
      if (o.kind === 'PING') { t0 = o.t; src = SIM.HOME; }
      else { const fe = res.events.find((e) => e.type === 'flash' && e.sent === o.t && e.data[0] === o.who); if (!fe) continue; t0 = fe.t; src = fe.pos; }
      for (const k of known) {
        let at, pos;
        if (k.kind === 'ride') {
          const tp = res.hist['der:' + k.ride][G.now];
          pos = unlockedNow(k.ride) && tp ? tp : (SIM.seenPos(res.hist['der:' + k.ride], G.now) || [0, null])[1];
          if (!pos) continue;
          at = unlockedNow(k.ride) ? rideArrival(res, k.ride, t0, src) : '?';
          if (at === null) continue;
        } else {
          pos = k.pos; at = t0 + SIM.dist(src, k.pos);
          if (k.born && at < k.born) continue;
        }
        if (!o.queued && at !== '?' && at < G.now) continue;
        const addressed = o.arg && k.id === o.arg;
        if (G.L.world && k.id === 'W' && !addressed) continue;
        tags.push({ pos, text: `${addressed ? '\u2192 ' : ''}reaches yr ${at}`, color: k.color, queued: !!o.queued });
        if (addressed || (!o.arg && k.kind !== 'fix') || (!o.arg && G.L.receivers && G.L.receivers.some((r) => r.id === k.id))) txt = `reaches ${nm(k.id)} yr ${at}`;
      }
    } else if (o.kind === 'STANDING') {
      const rx = res.events.find((e) => e.type === 'standing' && e.sent === o.t);
      if (rx) txt = `reaches V yr ${rx.t}`;
    }
    if (o.queued) info.push(txt);
  }
  return { tags, lines, info };
}

// ---------- UI ----------
function updateUI() {
  const L = G.L; if (!L) return;
  $('lvlname').innerHTML = `<span class="n">${G.n} \u00b7</span>${esc(L.name)}`;
  $('year').innerHTML = `YEAR <b>${G.now}</b>`;
  // objective
  let obj = L.objective.text;
  if (G.n === 8) obj = G.fin.sentYear !== null ? (G.fin.kind === 'delegate' || G.plan.some((o) => o.kind === 'STANDING') ? 'Petition 1: transferred to V.' : 'Petition 1: answered. Reply pending.') : 'Petition 1: pending.';
  $('obj').innerHTML = `${esc(obj)} <span class="i">info</span>`;
  // tags
  const ct = computeTags();
  const hl = [];
  if (G.tut === 0) { const c = dronePosCalc('A'); if (c) hl.push(c); }
  if (G.tut === 1) { const sp = SIM.seenPos(G.res.hist['der:D1'], G.now); if (sp) hl.push(sp[1]); }
  G.ui = { tags: ct.tags, moveLines: ct.lines, highlight: hl };
  // outbox
  const ob = $('outbox'); ob.innerHTML = '';
  G.queue.forEach((o, i) => {
    const b = document.createElement('span'); b.className = 'chip out';
    const what = o.kind === 'MOVE' ? 'move' : o.kind === 'STANDING' ? 'standing' : o.kind === 'PING' ? (o.arg === 'W' ? 'answer W' : `ask ${nm(o.arg)}`) : o.arg ? (o.arg === 'W' ? 'answer W' : `ask ${nm(o.arg)}`) : 'flash';
    b.innerHTML = `${o.who === 'HOME' ? 'Home' : esc(o.who)} \u2192 ${esc(what)}${ct.info[i] ? ' \u00b7 ' + esc(ct.info[i]) : ''}`;
    if (G.tut !== 2) {
      const x = document.createElement('button'); x.className = 'x'; x.setAttribute('aria-label', 'Remove order'); x.textContent = '\u2715';
      x.onclick = (ev) => { ev.stopPropagation(); G.queue.splice(i, 1); updateUI(); };
      b.appendChild(x);
    }
    ob.appendChild(b);
  });
  // chips
  const ch = $('chips'); ch.innerHTML = '';
  const chip = (label, cls, fn, aria) => { const b = document.createElement('button'); b.className = 'chip ' + (cls || ''); b.innerHTML = label; if (aria) b.setAttribute('aria-label', aria); b.onclick = (ev) => { ev.stopPropagation(); AU.init(); stopFF(); fn(); }; ch.appendChild(b); return b; };
  const fin = G.fin, callSeen = G.n === 8 && G.now >= 10;
  const decisiveQueued = G.queue.some((o) => (o.arg === 'W') || o.kind === 'STANDING');
  const decisiveSent = fin && fin.sentYear !== null;
  if (G.sel && G.sel !== 'HOME' && !G.won && !G.locked) {
    const id = G.sel;
    chip('MOVE', G.mode === 'move' ? 'on' : '', () => { G.mode = 'move'; updateUI(); });
    if (G.n >= 3 && G.n <= 4) chip('FLASH', '', () => { if (G.tut >= 0 && G.tut < 4) return; queueFlash(id, null); });
    if (actOf(G.n) === 2) chip('ASK', 'violet' + (G.mode === 'ask' ? ' on' : ''), () => { G.mode = G.mode === 'ask' ? 'move' : 'ask'; updateUI(); if (G.mode === 'ask') toast('Tap a watcher to address the request.'); });
    if (G.n === 8 && callSeen && !decisiveSent && !decisiveQueued) {
      chip('ASK W', 'blue', () => confirmSheet('V answers them', `V will answer them from where it is. This cannot be recalled. Your order reaches V, V speaks, and its answer reaches them years later. They will be older than the voices you heard.`, 'Send', () => queueFlash('V', 'W')));
      chip('STANDING', 'blue', () => confirmSheet('Give standing', 'Give V the right to decide. It will no longer take your orders.', 'Give standing', () => { G.queue = G.queue.filter((o) => o.who !== 'V'); G.queue.push({ kind: 'STANDING', who: 'V', arg: null }); G.sel = null; updateUI(); }));
    }
    chip('\u2715', '', deselect, 'Deselect');
  } else if (G.sel === 'HOME' && !G.won) {
    chip('ASK', 'violet on', () => {});
    const hint = document.createElement('span'); hint.className = 'chip'; hint.style.border = '0'; hint.style.background = 'none'; hint.style.color = 'var(--dim)'; hint.style.fontWeight = '500';
    hint.textContent = 'Tap a watcher.'; ch.appendChild(hint);
    chip('\u2715', '', deselect, 'Deselect');
  } else if (G.n === 8 && callSeen && !decisiveSent && !decisiveQueued && !G.locked && !G.won) {
    const b = document.createElement('button'); b.className = 'answerBtn'; b.textContent = 'Answer them';
    b.onclick = () => { AU.init(); confirmSheet('Answer them', 'This cannot be recalled. It reaches them in 5 years, and they will be ten years older than the voices you heard.', 'Send', () => { G.queue.push({ kind: 'PING', who: 'HOME', arg: 'W' }); updateUI(); }); };
    ch.appendChild(b);
  }
  // primary
  const pr = $('primary'); pr.className = 'primary'; pr.disabled = false;
  let lab = 'WAIT \u25B8';
  if (G.n === 8 && G.finIntro < 3) lab = 'CONTINUE \u25B8';
  else if (G.queue.length) { lab = `TRANSMIT ${G.queue.length} \u25B8`; pr.classList.add('tx'); }
  else if (G.n === 8 && decisiveSent) { lab = 'LISTENING \u25B8'; pr.classList.add('listen'); }
  else if (G.n === 8 && callSeen) { lab = 'PENDING \u25B8'; pr.classList.add('pend'); }
  if (G.locked) { pr.disabled = true; lab = G.n === 8 && !decisiveSent ? 'PENDING' : lab; }
  if (G.won) pr.disabled = true;
  if (G.tut === 2 || G.tut === 3) pr.classList.add('pulse');
  pr.textContent = lab;
  const ff = $('ff');
  ff.disabled = G.n === 8 || G.won || G.locked || (G.tut >= 0 && G.tut < 4);
  ff.classList.toggle('on', !!G.ff);
  renderLogLine();
}

// log
let logTimer = null, logShown = 0;
function addLog(text, action) {
  G.logs.push({ y: G.now, text, action: action || null });
  scheduleLogLine();
}
function scheduleLogLine() {
  if (logTimer) return;
  const step = () => {
    logTimer = null;
    if (logShown < G.logs.length - 1) { logShown++; renderLogLine(true); logTimer = setTimeout(step, 1500); }
    else if (logShown === G.logs.length - 1) renderLogLine(true);
  };
  if (logShown > G.logs.length - 1) logShown = G.logs.length - 1;
  if (logShown < G.logs.length - 2) logShown = G.logs.length - 2; // don't lag too far behind
  step();
}
function renderLogLine(fresh) {
  const l = G.logs[Math.min(logShown, G.logs.length - 1)];
  const lt = $('logtext'), la = $('logact');
  lt.textContent = l ? l.text : '';
  if (fresh) { lt.classList.remove('fresh'); void lt.offsetWidth; lt.classList.add('fresh'); }
  la.innerHTML = '';
  // the newest open action (smart rewind) stays reachable
  const act = [...G.logs].reverse().find((x) => x.action && !x.used && x.y <= G.now);
  if (act && !G.won) {
    const b = document.createElement('button'); b.textContent = act.action.label + ' \u21BA';
    b.onclick = (ev) => { ev.stopPropagation(); act.used = true; act.action.fn(); };
    la.appendChild(b);
  }
}

// coach & toast
let coachOpts = {};
function setCoach(text, opts = {}) {
  const c = $('coach'); coachOpts = opts;
  c.innerHTML = esc(text) + (opts.tap ? '<span class="more">TAP TO CONTINUE</span>' : opts.dismiss ? '<span class="more">TAP TO DISMISS</span>' : '');
  c.classList.remove('hidden'); c.classList.toggle('tap', !!(opts.tap || opts.dismiss));
}
function clearCoach() { $('coach').classList.add('hidden'); coachOpts = {}; }
function clearCoachIfDismiss() { if (coachOpts.dismiss) clearCoach(); }
$('coach').addEventListener('click', (ev) => { ev.stopPropagation(); AU.init(); if (coachOpts.tap) coachOpts.tap(); else if (coachOpts.dismiss) clearCoach(); });
let toastT = null;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('hidden'), 2200); }

// ---------- until news ----------
function untilNews() {
  if ($('ff').disabled) return;
  AU.init();
  if (G.ff) { stopFF(); return; }
  let k = 0;
  const step = () => {
    if (!G.ff) return;
    const news = advance(); k++;
    if (news || k >= 8 || G.won) { stopFF(); return; }
    G.ff = setTimeout(step, reduced() ? 140 : 440);
  };
  G.ff = setTimeout(step, 0);
  updateUI();
}
function stopFF() { if (G.ff) { clearTimeout(G.ff); G.ff = null; const f = $('ff'); if (f) f.classList.remove('on'); } }

// ---------- sheets ----------
function openSheet(html, mount) {
  $('sheetBody').innerHTML = html; $('sheet').classList.remove('hidden'); $('sheetBack').classList.remove('hidden');
  $('sheetBody').scrollTop = 0;
  if (mount) mount($('sheetBody'));
}
function closeSheet() { $('sheet').classList.add('hidden'); $('sheetBack').classList.add('hidden'); }
$('sheetBack').addEventListener('click', closeSheet);
function confirmSheet(title, body, yes, fn) {
  openSheet(`<h2>${esc(title)}</h2><p>${esc(body)}</p><div class="btnrow"><button id="cNo">Not yet</button><button class="go" id="cYes">${esc(yes)}</button></div>`, (el) => {
    el.querySelector('#cNo').onclick = closeSheet;
    el.querySelector('#cYes').onclick = () => { closeSheet(); fn(); };
  });
}

function seenAgo(key) {
  const s = SIM.seenPos(G.res.hist[key], G.now);
  if (!s) return '';
  const age = G.now - s[0];
  return age <= 0 ? '<p class="age">Seen as it is now.</p>' : `<p class="age">Seen as it was ${age} yr${age === 1 ? '' : 's'} ago (year ${s[0]}).</p>`;
}
function tagsAt(hex) {
  const t = G.ui.tags.filter((x) => SIM.eq(x.pos, hex)).map((x) => x.text);
  return t.length ? `<p class="tagline">${t.map(esc).join(' \u00b7 ')}</p>` : '';
}
function inspect(hex) {
  const L = G.L;
  const parts = [];
  // derelicts (seen image or NOW marker)
  for (const d of L.derelicts || []) {
    const sp = !(G.exitSeen[d.id] <= G.now) && SIM.seenPos(G.res.hist['der:' + d.id], G.now);
    const tp = unlockedNow(d.id) && G.res.hist['der:' + d.id][G.now];
    const atImg = sp && SIM.eq(sp[1], hex), atNow = tp && SIM.eq(tp, hex);
    if (!atImg && !atNow) continue;
    const ride = (L.receivers || []).find((r) => r.ride === d.id);
    const tagged = G.res.events.find((e) => e.type === 'tag' && e.data[0] === d.id && SIM.seenTick(e) <= G.now);
    parts.push(`<h2><span class="k">Derelict probe</span>${esc(d.id)}${atNow && !atImg ? ' \u00b7 calculated position' : ''}</h2>
      <p>Ancient and unpowered. It drifts one light-year every ${d.period} years and will not change course for anyone.</p>
      ${atImg ? seenAgo('der:' + d.id) : '<p class="age">Dashed: where Home calculates it is now.</p>'}
      <p>${unlockedNow(d.id) ? 'Projection: on. Home has seen it move, so the dashed marker and dotted track show where it is and where it will be.' : 'Projection: off. Home has not yet seen it move, so it cannot say where it is now.'}</p>
      ${ride ? `<p class="rule">Carries an old relay. It wakes if ${ride.need} open signals reach it in the same year.</p>` : ''}
      ${tagged ? `<p>Tagged in year ${tagged.t}. Seen in year ${SIM.seenTick(tagged)}.</p>` : ''}${tagsAt(hex)}`);
  }
  for (const r of L.receivers || []) if (r.cell && SIM.eq(r.cell, hex)) {
    const on = G.res.events.find((e) => e.type === 'rec_on' && e.data === r.id && SIM.seenTick(e) <= G.now);
    parts.push(`<h2><span class="k">Relay</span>${esc(r.id)}</h2><p class="rule">Wakes if ${r.need} open signals reach it in the same year. Signals in different years do not add up.</p>
      <p class="age">Ring ${SIM.ring(hex)}: what you see of it is ${SIM.ring(hex)} years old.</p>${on ? `<p>Woke in year ${on.t}. Seen in year ${SIM.seenTick(on)}.</p>` : ''}${tagsAt(hex)}`);
  }
  const w = watcherAtHex(hex);
  if (w) {
    const rule = w.kind === 'precedent' ? 'Will sign only if the first request it hears is addressed to it. A request for someone else arriving first, or in the same year, makes it object for good.' : w.kind === 'sign' ? 'Signs when it receives a request addressed to it.' : 'Acknowledges everything that reaches it.';
    const st = G.res.events.find((e) => (e.type === 'sign' || e.type === 'offended') && e.data === w.id && SIM.seenTick(e) <= G.now);
    parts.push(`<h2><span class="k">Watcher \u00b7 ${w.kind === 'precedent' ? 'precedent' : w.kind === 'sign' ? 'signer' : 'mirror'}</span>${esc(nm(w.id))}</h2>
      <p class="rule">${esc(rule)}</p>${w.parent ? `<p class="rule">Requests addressed to ${esc(nm(w.parent))} do not count for ${esc(nm(w.id))}.</p>` : ''}
      ${seenAgo('wat:' + w.id)}${st ? `<p>${st.type === 'sign' ? 'Signed' : 'Objected'} in year ${st.t}. Seen in year ${SIM.seenTick(st)}.</p>` : ''}${tagsAt(hex)}`);
  }
  if (L.world && SIM.eq(hex, FIN.W)) {
    parts.push(`<h2><span class="k">Ring 5</span>A pale blue world</h2><p>Everything you know about it is five years old. Anything you say reaches it five years from now.</p>${G.now >= 10 ? '<p class="rule">It is asking. Some of it is saying not yet.</p>' : ''}${tagsAt(hex)}`);
  }
  if (L.world && G.fin.probe) { const ps = FIN.probeSeen(G.now); if (ps && SIM.eq(ps[1], hex)) parts.push(`<h2><span class="k">Their instrument</span>A probe</h2><p>Coming this way at half the speed of light. It appears to hurry. It isn't hurrying. Seen as it was ${G.now - ps[0]} years ago.</p>`); }
  if (SIM.eq(hex, SIM.HOME)) parts.push(`<h2><span class="k">You</span>HOME</h2><p>An old, careful listening post. You see everything as it was. Your orders arrive late.</p>`);
  if (!parts.length) { const r = SIM.ring(hex); toast(r === 0 ? 'Home.' : `Ring ${r}. Light from here is ${r} year${r === 1 ? '' : 's'} old.`); return; }
  openSheet(parts.join('<hr style="border:0;border-top:1px solid var(--line);margin:12px 0">'));
}

function openMenu() {
  AU.init();
  const s = G.save.settings;
  openSheet(`<div class="menu">
    <button id="mRestart">Restart level</button>
    <button id="mRewind" ${G.now === 0 || G.locked ? 'disabled' : ''}>Rewind 1 year <span class="v">to year ${Math.max(0, G.now - 1)}</span></button>
    <button id="mHint">Hint</button>
    <button id="mLevels">Level select</button>
    <button id="mLog">Home log</button>
    <button id="mCodex">Codex <span class="v">${G.save.codex.length} found</span></button>
    <button id="mScale">How light works here</button>
    <button id="mSound">Sound <span class="v">${s.sound ? 'On' : 'Off'}</span></button>
    <button id="mMotion">Reduced motion <span class="v">${s.reduced ? 'On' : mqReduce.matches ? 'On (system)' : 'Off'}</span></button>
  </div>`, (el) => {
    el.querySelector('#mRestart').onclick = () => { closeSheet(); if (G.locked && G.n === 8) return; loadLevel(G.n); };
    el.querySelector('#mRewind').onclick = () => { closeSheet(); rewindTo(G.now - 1); };
    el.querySelector('#mHint').onclick = openHints;
    el.querySelector('#mLevels').onclick = openLevels;
    el.querySelector('#mLog').onclick = openLog;
    el.querySelector('#mCodex').onclick = openCodex;
    el.querySelector('#mScale').onclick = openScale;
    el.querySelector('#mSound').onclick = () => { s.sound = !s.sound; AU.on = s.sound; persist(); openMenu(); };
    el.querySelector('#mMotion').onclick = () => { s.reduced = !s.reduced; document.body.classList.toggle('reduced', s.reduced); persist(); openMenu(); };
  });
}
function openHints() {
  const h = SCRIPT[G.n].hints || [];
  if (!h.length) { openSheet(`<h2>Hint</h2><p>There isn't a right answer. There are three honest ones.</p>`); return; }
  if (G.hint === 0) G.hint = 1;
  const shown = h.slice(0, G.hint);
  openSheet(`<h2><span class="k">Hint ${G.hint} of ${h.length}</span>${esc(G.L.name)}</h2><div class="hints">${shown.map((x) => `<p>${esc(x)}</p>`).join('')}</div>
    <div class="btnrow">${G.hint < h.length ? '<button id="hMore" class="go">Another hint</button>' : '<button id="hClose">Close</button>'}</div>`, (el) => {
    const m = el.querySelector('#hMore'); if (m) m.onclick = () => { G.hint++; openHints(); };
    const c = el.querySelector('#hClose'); if (c) c.onclick = closeSheet;
  });
}
function openLevels() {
  const all = G.save.endingsFound.length > 0;
  const row = (n) => {
    const L = levelData(n); const lock = !all && n > G.save.reached;
    return `<button data-n="${n}" ${lock ? 'disabled' : ''}><span class="num">${n}</span>${lock ? 'Locked' : esc(L.name)}${G.save.cleared.includes(n) ? '<span class="done">\u2713</span>' : ''}</button>`;
  };
  openSheet(`<h2>Levels</h2><div class="lv"><div class="act">Act I \u00b7 Home</div>${[1, 2, 3, 4].map(row).join('')}<div class="act">Act II \u00b7 Neighbours</div>${[5, 6, 7].map(row).join('')}<div class="act">Act III</div>${row(8)}</div>
    ${G.save.endingsFound.length ? `<p class="found" style="margin-top:12px">Endings found: ${G.save.endingsFound.length} of 3</p>` : ''}`, (el) => {
    el.querySelectorAll('button[data-n]').forEach((b) => { b.onclick = () => { closeSheet(); startLevel(+b.dataset.n); }; });
  });
}
function openLog() {
  openSheet(`<h2>Home log</h2><div class="loglist">${G.logs.map((l) => `<div><span class="y">YR ${l.y}</span>${esc(l.text)}</div>`).join('') || '<div>Nothing yet.</div>'}</div>`, (el) => { el.scrollTop = el.scrollHeight; });
}
function openCodex() {
  openSheet(`<h2>Codex</h2><div class="codex">${Object.entries(CODEX).map(([k, c]) => has(k) ? `<div><b>${esc(c.t)}</b>${esc(c.b)}</div>` : '<div class="locked">\u00b7 \u00b7 \u00b7 not yet discovered</div>').join('')}</div>`);
}
function openScale() {
  unlockCodex('dilation');
  openSheet(`<h2><span class="k">How light works here</span>Scale</h2>${TEXT.scale.map((t) => `<p>${esc(t)}</p>`).join('')}
  <p class="tagline">Orders: tap a drone, then tap a hex to move it there.${G.n >= 3 && G.n <= 4 ? ' FLASH makes it signal the moment the order arrives.' : ''}${actOf(G.n) === 2 ? ' ASK sends a request addressed to one watcher. Tap Home to ask from Home.' : ''}</p>`);
}
function openObjective() {
  const L = G.L;
  let extra = '';
  if (L.receivers) extra += L.receivers.map((r) => `<p class="rule">Relay ${esc(r.id)} wakes if ${r.need} open signals reach it in the same year.</p>`).join('');
  if (actOf(G.n) === 2) extra += '<p class="rule">Precedents sign only if the first request they hear is addressed to them. Ties are not first.</p>';
  if (G.n === 8) extra = '<p>Petition 1. Opened before this world had oxygen. Requires: the consent of its inhabitants.</p>';
  openSheet(`<h2><span class="k">Objective</span>${esc($('obj').textContent.replace(/ info$/, ''))}</h2>${extra}
    <p>You win when the light from your success reaches Home, not when it happens.</p>
    <div class="btnrow"><button id="oScale">How light works here</button><button id="oHint">Hint</button></div>`, (el) => {
    el.querySelector('#oScale').onclick = openScale; el.querySelector('#oHint').onclick = openHints;
  });
}
$('menuBtn').onclick = openMenu;
$('lvlname').onclick = () => { AU.init(); openLevels(); };
$('obj').onclick = () => { AU.init(); openObjective(); };
$('log').onclick = () => { AU.init(); openLog(); };
$('primary').onclick = () => {
  AU.init(); stopFF();
  if (G.locked || G.won) return;
  if (G.n === 8 && G.finIntro < 3) { finIntroNext(); return; }
  if (G.tut === 0 || G.tut === 1) { toast(G.tut === 0 ? 'Tap your drone first.' : 'Tap the derelict first.'); return; }
  advance();
};
$('ff').onclick = untilNews;
document.addEventListener('pointerdown', () => AU.init(), { once: true });
document.addEventListener('keydown', (e) => {
  if (!$('overlay').classList.contains('hidden') || !$('sheet').classList.contains('hidden')) { if (e.key === 'Escape') closeSheet(); return; }
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); $('primary').click(); }
  else if (e.key === 'Escape') deselect();
  else if (e.key === 'Backspace' || e.key === 'z') rewindTo(G.now - 1);
});

// ---------- overlay screens ----------
const ov = $('overlay');
function showOverlay(html, opts = {}) {
  ov.innerHTML = html; ov.classList.remove('hidden'); ov.classList.toggle('tapcard', !!opts.tap);
  ov.onclick = opts.tap ? (e) => { if (e.target.closest('button,input')) return; AU.init(); opts.tap(); } : null;
}
function hideOverlay() { ov.classList.add('hidden'); ov.innerHTML = ''; ov.onclick = null; stopReplay(); waveCtl = null; interCtl = null; AU.stopWind(); layout(); }

// progressive line cards: one card per tap
function cards(list, done, render) {
  let i = 0;
  const show = () => {
    if (i >= list.length) { done(); return; }
    const item = list[i];
    showOverlay(`<div class="card">${render ? render(item, i) : `<div class="line">${esc(item)}</div>`}</div><div class="tapmore">tap</div>`, { tap: () => { i++; show(); } });
  };
  show();
}
// progressive lines: each tap adds a line on the same card
function stack(head, lines, done, cls = 'line') {
  let i = 1;
  const show = () => {
    showOverlay(`<div class="card">${head || ''}${lines.slice(0, i).map((l, k) => `<div class="${cls}" style="animation-delay:${k === i - 1 ? 0 : 0}s">${esc(l)}</div>`).join('')}</div><div class="tapmore">tap</div>`, {
      tap: () => { if (i < lines.length) { i++; show(); } else done(); },
    });
  };
  show();
}

function showTitle() {
  const cont = G.save.reached > 1;
  showOverlay(`<div class="card"><div class="title">LIGHT LAG</div><div class="sub">Everything you can see has already happened.</div>
    <div style="height:18px"></div>
    <button class="bigbtn" id="tPlay">${cont ? `CONTINUE \u00b7 LEVEL ${Math.min(8, G.save.reached)}` : 'BEGIN'}</button>
    ${cont ? '<button class="ghostbtn" id="tLevels">Level select</button>' : ''}
    ${G.save.endingsFound.length ? `<div class="found">Endings found: ${G.save.endingsFound.length} of 3</div>` : ''}
    <div class="caption" style="margin-top:8px">Headphones help. About 30 minutes.</div></div>`);
  $('tPlay').onclick = () => { AU.init(); startLevel(Math.min(8, G.save.reached)); };
  const lv = $('tLevels'); if (lv) lv.onclick = () => { AU.init(); hideOverlay(); loadLevel(Math.min(8, G.save.reached)); openLevels(); };
}
function showOpening() {
  cards(TEXT.opening, () => { G.save.seenOpening = true; persist(); showTitle(); });
}
function startLevel(n) {
  stopHold();
  loadLevel(n);
  const sc = SCRIPT[n];
  if (n === 1) { hideOverlay(); return; }
  const head = `<div class="kicker">${n === 8 ? 'Act III' : `Level ${n} \u00b7 Act ${actOf(n) === 1 ? 'I' : 'II'}`}</div><div class="ttl2">${esc(levelData(n).name)}</div>`;
  const lines = n === 8 ? [] : (sc.intro || []);
  if (!lines.length) { showOverlay(`<div class="card">${head}</div><div class="tapmore">tap to begin</div>`, { tap: () => { hideOverlay(); } }); return; }
  stack(head, lines, () => hideOverlay(), 'sub');
}

// ---------- win + truth replay ----------
let replayCtl = null;
function stopReplay() { replayCtl = null; }
function startReplay(host, opts) {
  const cv = host.querySelector('canvas'), c2 = cv.getContext('2d');
  const slider = host.querySelector('input'), ylab = host.querySelector('.y'), rl = host.querySelector('.rlabel');
  const segs = host.querySelectorAll('.seg button');
  const R = opts.level.R;
  let mode = 'true', v = 0, playing = true, t0 = performance.now(), g = null;
  const end = opts.end, dur = Math.max(6000, Math.min(10000, end * 520));
  const unlock = {}; for (const d of opts.level.derelicts || []) unlock[d.id] = SIM.firstSeenMove(opts.level, d.id);
  const exitSeen = {}, exitTrue = {};
  for (const e of opts.res.events) if (e.type === 'exit') { exitTrue[e.data] = e.t; exitSeen[e.data] = SIM.seenTick(e); }
  function resize() {
    const maxW = Math.min(host.clientWidth || 340, 420);
    const maxH = Math.max(160, innerHeight - (opts.tall ? 260 : 350));
    const side = Math.floor(Math.min(maxW, maxH));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.style.width = side + 'px'; cv.style.height = side + 'px'; cv.width = side * dpr; cv.height = side * dpr;
    c2.setTransform(dpr, 0, 0, dpr, 0, 0); g = makeGeom(side, side, R);
  }
  resize();
  slider.max = end; slider.step = 0.01;
  slider.oninput = () => { playing = false; v = +slider.value; };
  segs.forEach((b) => { b.onclick = () => { mode = b.dataset.m; segs.forEach((x) => x.classList.toggle('on', x === b)); }; });
  segs.forEach((x) => x.classList.toggle('on', x.dataset.m === mode));
  const ctl = {
    resize,
    replay() { v = 0; playing = true; t0 = performance.now(); },
    tick(t) {
      if (playing) { v = Math.min(end, (t - t0) / dur * end); if (v >= end) playing = false; slider.value = v; }
      const now = Math.max(0, Math.ceil(v - 1e-9)), p = now === 0 ? 1 : v - now + 1;
      render(c2, g, { level: opts.level, res: opts.res, now, p, mode, unlock, exitSeen, exitTrue, showHidden: opts.showHidden, fin: opts.fin, clock: t, stars: STARS, newsEvents: opts.news, noLabels: true, ui: { tags: [], moveLines: [], highlight: [] } });
      ylab.textContent = `year ${Math.floor(v)}`;
      rl.textContent = mode === 'true' ? 'AS IT WAS: what was really happening' : 'AS SEEN: what Home could see at the time';
    },
  };
  replayCtl = ctl;
  return ctl;
}
function replayHTML() {
  return `<div class="replay"><canvas></canvas><div class="seg"><button data-m="seen">AS SEEN</button><button data-m="true">AS IT WAS</button></div><div class="scrub"><input type="range" min="0" value="0" aria-label="Scrub years"><span class="y"></span></div><div class="rlabel"></div></div>`;
}
function showWin() {
  const o = G.out, sc = SCRIPT[G.n];
  let end = sc.end;
  if (G.n === 1) end = `Confirmed. It happened ${WORDS[o.lag] || o.lag} year${o.lag === 1 ? '' : 's'} ago. You found out just now. This will keep happening.`;
  showOverlay(`<div class="win"><div class="head">Confirmed \u00b7 ${esc(G.L.name)}</div>
    <div class="when">It happened in year <b>${o.happened_at}</b>.<br>You found out in year <b>${o.confirmed_at_home}</b>.</div>
    <div class="end">${esc(end)}</div>${replayHTML()}
    <div class="btnrow"><button id="wAgain">Replay level</button><button class="go" id="wNext">${G.n === 7 ? 'Onward \u25B8' : 'Next \u25B8'}</button></div></div>`);
  startReplay(ov.querySelector('.replay'), { level: G.L, res: G.res, end: o.confirmed_at_home, news: o.req, showHidden: G.save.reached >= 5 && G.n >= 5 || G.save.reached >= 6 });
  $('wAgain').onclick = () => { hideOverlay(); loadLevel(G.n); };
  $('wNext').onclick = nextAfterWin;
}
function nextAfterWin() {
  const n = G.n, sc = SCRIPT[n];
  stopReplay();
  if (n === 4) stack('', sc.actCard, () => showInterstitial(() => startLevel(5)), 'line');
  else if (n === 7) stack('', sc.actCard, () => startLevel(8), 'line');
  else startLevel(n + 1);
}

// ---------- interstitial: reclassifying ----------
let interCtl = null;
function showInterstitial(done) {
  unlockCodex('noise');
  G.save.reached = Math.max(G.save.reached, 5); persist();
  let i = 0;
  const boards = [2, 3, 4].map((n) => {
    const L = LEVELS_JSON[n - 1];
    const ref = Object.entries(L.test_plans).find(([k]) => k.startsWith('reference'))[1];
    const plan = ref.map((x) => ({ t: x[0], kind: x[1], who: x[2], arg: x[3] }));
    return { L, res: SIM.simulate(L, plan, 30) };
  });
  const show = () => {
    const last = i >= TEXT.interstitial.length;
    showOverlay(`<div class="card"><canvas id="icv"></canvas>${last ? '<div class="kicker">Act II</div><div class="ttl2">Neighbours</div>' : `<div class="line">${esc(TEXT.interstitial[i])}</div>`}</div><div class="tapmore">tap</div>`, {
      tap: () => { if (last) { interCtl = null; done(); } else { i++; show(); } },
    });
    const cv = $('icv'), c2 = cv.getContext('2d');
    const side = Math.floor(Math.min(320, innerWidth - 48, innerHeight * 0.42));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.style.width = side + 'px'; cv.style.height = side + 'px'; cv.width = side * dpr; cv.height = side * dpr; c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t0 = performance.now();
    interCtl = (t) => {
      const el = (t - t0) / 1000, bi = Math.floor(el / 3.2) % 3, b = boards[bi];
      const v = (el % 3.2) / 3.2 * 16, now = Math.max(0, Math.ceil(v)), p = now === 0 ? 1 : v - now + 1;
      const g = makeGeom(side, side, b.L.R);
      const mir = b.res.wat.filter((w) => w.hidden).map((w) => w.pos);
      render(c2, g, { level: b.L, res: b.res, now, p, mode: 'true', unlock: {}, exitSeen: {}, exitTrue: {}, showHidden: true, clock: t, stars: STARS, noLabels: true, ui: { tags: [], moveLines: [], highlight: mir } });
    };
  };
  show();
}

// ---------- finale ----------
function finIntroShow() {
  const i = G.finIntro;
  if (i < 3) setCoach(TEXT.finaleOpen[i], { tap: finIntroNext });
}
function finIntroNext() {
  addLog(TEXT.finaleOpen[G.finIntro]);
  G.finIntro++;
  if (G.finIntro < 3) finIntroShow(); else clearCoach();
  updateUI();
}
function finaleYear(n) {
  const f = G.fin, sent = f.sentYear !== null;
  let news = false;
  const say = (t, coach) => { addLog(t); news = true; if (coach) setCoach(t, { dismiss: true }); };
  if (n === 6) say('It has started leaking radio. Not to us. To everyone.');
  if (f.calls.map((c) => c + FIN.WR).includes(n)) {
    AU.call();
    if (n === 10) { say('A pulse train: 2, 3, 5, 7. Primes. Decoded: IS ANYONE THERE?'); say('That one was aimed.', true); }
    else say('The call again. IS ANYONE THERE?');
  }
  if (FIN.NOTYET.map((c) => c + FIN.WR).includes(n)) {
    AU.notyet();
    if (n === 13) { say('A second voice, fainter. Amber. NOT YET.'); say('Not all of them.'); say('You could answer. You could wait. Or you could give the question to someone closer.', true); unlockCodex('stale'); }
    else say('The amber voice. NOT YET.');
  }
  if (n === 19 && !sent) say('Waiting is the only choice that can be undone. It is still a choice.', true);
  if (n === 26 && !f.calls.map((c) => c + FIN.WR).includes(26) && f.sentYear === null) say('No call this year.');
  if (f.probe && n === FIN.PROBE_LAUNCH + FIN.WR) say('Something has left their world. It is coming this way. It appears to hurry. It is not hurrying.', !G.locked);
  if (sent && f.kind === 'answer' && f.A !== null && n > f.sentYear && n <= f.A) say(n < f.A ? `Your answer is ${n - f.sentYear} light-year${n - f.sentYear === 1 ? '' : 's'} out.` : 'Your answer has reached them. Now the light has to come back.');
  if (f.endSeen !== null && n === f.endSeen) finaleEnding(f.kind);
  if (n === FIN.HOLD_AT && !sent && !G.queue.length) startHold();
  return news;
}
let holdT = null;
function startHold() {
  G.locked = true; G.sel = null; clearCoach(); updateUI();
  addLog('Holding.');
  const step = () => {
    if (G.now >= FIN.HOLD_END) { holdT = null; finaleEnding('hold'); return; }
    advance();
    holdT = setTimeout(step, 700);
  };
  holdT = setTimeout(step, 900);
}
function stopHold() { if (holdT) { clearTimeout(holdT); holdT = null; } }
function finaleEnding(kind) {
  if (G.won) return;
  G.won = true; G.locked = true; stopFF(); stopHold(); updateUI();
  const k = kind === 'delegate' ? 'delegate' : kind === 'answer' ? 'answer' : 'hold';
  if (!G.save.endingsFound.includes(k)) G.save.endingsFound.push(k);
  if (!G.save.cleared.includes(8)) G.save.cleared.push(8);
  G.save.reached = 9; persist();
  if (k !== 'hold') { AU.chord(); setCoach(k === 'answer' ? 'Something is coming back.' : 'V is writing.'); }
  const token = G.levelToken;
  setTimeout(() => { if (G.levelToken === token) showEnding(k); }, reduced() ? 600 : 2200);
}
let waveCtl = null;
function showEnding(k) {
  const f = G.fin, E = ENDINGS[k];
  const stampCls = k === 'answer' ? '' : k === 'delegate' ? 'gold' : 'blue';
  const doc = `<div class="stampwrap"><div class="doc">PETITION 1<br>Opened: before oxygen<br>Requires: consent of its inhabitants<br>Year: ${G.now}<br>Status:</div><div class="stamp ${stampCls}">${esc(E.stamp)}</div></div>`;
  const steps = [];
  steps.push(() => { showOverlay(`<div class="card"><div class="kicker">Ending \u00b7 ${esc(E.name)}</div>${doc}</div><div class="tapmore">tap</div>`, { tap: next }); setTimeout(() => AU.stamp(), reduced() ? 0 : 650); });
  const lines = (arr, cls) => steps.push(() => stack(`<div class="kicker">${esc(E.name)}</div>`, arr, next, cls || 'line'));
  if (k === 'answer') {
    lines(['You answered a question that was ten years old by the time your reply arrived.',
      f.sentYear < 13 ? "Some of them had already begun saying not yet. You hadn't seen it." : 'Some of them are still saying not yet. That is in the record too.']);
    steps.push(() => forest(['Light could show you their forests. It could never give you one.'].concat(f.probe ? ['They had already sent an instrument of their own toward you. It will arrive to find the door open.'] : []), next));
  } else if (k === 'delegate') {
    lines(["You couldn't ask them without answering them, so you gave the question to someone close enough to hear the answer still being given."]);
    steps.push(() => showOverlay(`<div class="card"><div class="kicker">Forwarded by V</div><div class="stampwrap"><div class="doc">I listened until I was sure they were still asking. I answered with terms either side may withdraw from. The ones who said not yet are recorded. No participant warrants the absence of unknown harm.<br><br>\u2014 V</div></div></div><div class="tapmore">tap</div>`, { tap: next }));
    steps.push(() => forest(["V doesn't take your orders any more. It writes sometimes. Late, of course."], next));
  } else {
    lines(['You did not answer. Their call went on for a while, and then it stopped.',
      'They have built an instrument. It is coming this way, slowly, to watch. It will not say anything. They learned that from you.',
      'From inside every world like theirs, the galaxy looks empty.']);
  }
  steps.push(() => {
    showOverlay(`<div class="win"><div class="head">What really happened</div><div class="end">Their world, as it was. Your choice, as it travelled.</div>${replayHTML()}<div class="btnrow"><button class="go" id="eNext">Continue \u25B8</button></div></div>`);
    const news = f.forward ? [{ t: f.forward.t, pos: f.forward.pos }] : [];
    startReplay(ov.querySelector('.replay'), { level: G.L, res: G.res, end: Math.max(G.now, 12), news, fin: f, showHidden: true, tall: true });
    $('eNext').onclick = next;
  });
  steps.push(credits);
  let i = 0;
  function next() { stopReplay(); waveCtl = null; AU.stopWind(); const s = steps[i++]; if (s) s(); }
  next();
}
function forest(after, done) {
  const w = AU.startWind();
  showOverlay(`<div class="card"><div class="kicker">The reply</div><canvas class="wave" id="wv"></canvas><div class="caption">${esc(TEXT.forestCaption)}</div>${AU.on ? '' : '<div class="caption">(sound is off: shown as a waveform)</div>'}<div id="fAfter"></div></div><div class="tapmore">tap</div>`, {
    tap: () => {
      const el = $('fAfter');
      if (el.children.length < after.length) { const d = document.createElement('div'); d.className = 'line'; d.textContent = after[el.children.length]; el.appendChild(d); }
      else { AU.stopWind(); done(); }
    },
  });
  const cv = $('wv'), c2 = cv.getContext('2d');
  const W = Math.min(360, innerWidth - 48), H = 80, dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.width = W * dpr; cv.height = H * dpr; c2.setTransform(dpr, 0, 0, dpr, 0, 0);
  const buf = new Uint8Array(1024);
  waveCtl = (t) => {
    c2.clearRect(0, 0, W, H);
    c2.strokeStyle = 'rgba(170,240,200,0.85)'; c2.lineWidth = 1.5; c2.beginPath();
    const an = AU.analyser;
    if (an) { an.getByteTimeDomainData(buf); for (let x = 0; x < W; x++) { const v = (buf[Math.floor(x / W * buf.length)] - 128) / 128; const y = H / 2 + v * H * 1.6; x ? c2.lineTo(x, y) : c2.moveTo(x, y); } }
    else {
      const env = 0.55 + 0.45 * Math.sin(t / 1900);
      for (let x = 0; x < W; x++) { const y = H / 2 + env * (Math.sin(x / 9 + t / 260) * 9 + Math.sin(x / 3.1 + t / 90) * 4 + Math.sin(x / 23 - t / 700) * 8) + (Math.random() - 0.5) * 3 * env + (Math.sin(t / 333) > 0.97 ? Math.sin(x / 1.2) * 10 * Math.exp(-Math.abs(x - W * 0.7) / 20) : 0); x ? c2.lineTo(x, y) : c2.moveTo(x, y); }
    }
    c2.stroke();
  };
  void w;
}
function credits() {
  const found = G.save.endingsFound.length;
  showOverlay(`<div class="card credits"><div class="title">LIGHT LAG</div>${TEXT.credits.slice(1).map((l) => `<div class="line">${esc(l)}</div>`).join('')}
    <div style="height:10px"></div><div class="found">Endings found: ${found} of 3</div>
    <button class="bigbtn" id="cPlay">PLAY AGAIN</button></div>`);
  $('cPlay').onclick = () => { hideOverlay(); loadLevel(8); openLevels(); };
}

// ---------- boot ----------
document.body.classList.toggle('reduced', G.save.settings.reduced);
G.L = levelData(1);
requestAnimationFrame(() => {
  layout();
  if (!G.save.seenOpening) showOpening(); else showTitle();
  loadLevel(Math.min(8, G.save.reached));
  requestAnimationFrame(loop);
});
// test hook (no network, no data collection; used by the automated checks)
window.__LL = { G, SIM, FIN, advance, rewindTo, loadLevel, startLevel, queueMove, queueFlash, select, onBoardTap, hideOverlay, untilNews, geomOf: () => geom };
