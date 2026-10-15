// LIGHT LAG — canvas renderer. render(ctx, geom, F) draws one frame of a level
// at visual time F.now-1+F.p. mode 'seen' = what Home sees/calculates;
// mode 'true' = god's-eye (truth replay).
const COL = {
  bg: '#050a17', home: '#fff3d6', drone: '#f3d68c', der: '#aab0ba', relay: '#4fd8c8', wat: '#b993ff',
  world: '#a8d2ff', amber: '#ffb547', order: '255,238,206', ask: '196,160,255', flash: '243,214,140', reply: '170,240,200',
  text: '#dfe6f2', dim: 'rgba(200,215,240,0.55)', sign: '#7cf0b0', object: '#ff8a8a',
};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SQ3 = Math.sqrt(3);
const FDIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

function makeGeom(w, h, R) {
  const size = Math.min(w / (SQ3 * (2 * R + 1) + 0.3), h / (3 * R + 2 + 0.3));
  const cx = w / 2, cy = h / 2;
  const px = (q, r) => [cx + size * SQ3 * (q + r / 2), cy + size * 1.5 * r];
  function hexAt(x, y) {
    const fx = (x - cx) / size, fy = (y - cy) / size;
    const q = (SQ3 / 3 * fx - fy / 3), r = (2 / 3) * fy;
    // cube round
    let X = q, Z = r, Y = -X - Z;
    let rx = Math.round(X), ry = Math.round(Y), rz = Math.round(Z);
    const dx = Math.abs(rx - X), dy = Math.abs(ry - Y), dz = Math.abs(rz - Z);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    const h = [rx + 0, rz + 0];
    return SIM.ring(h) <= R ? h : null;
  }
  const cells = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (SIM.ring([q, r]) <= R) cells.push([q, r]);
  return { w, h, R, size, cx, cy, px, hexAt, cells };
}

const ease = (p) => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
function mixColor(a, b, t) { return a.map((v, i) => Math.round(lerp(v, b[i], t))); }

function hexPath(ctx, x, y, s) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); const X = x + s * Math.cos(a), Y = y + s * Math.sin(a); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.closePath();
}
function frontPath(ctx, g, c, r) {
  const [x, y] = g.px(c[0], c[1]);
  ctx.beginPath();
  FDIRS.forEach((d, i) => {
    const X = x + g.size * SQ3 * (d[0] + d[1] / 2) * r, Y = y + g.size * 1.5 * d[1] * r;
    i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
  });
  ctx.closePath();
}
// light coming home or going out, as Home calculates it (L0): long bright dashes
// in the Home colour, so it never reads as the fainter short-dashed order front
function newsFront(ctx, g, c, r, a) {
  frontPath(ctx, g, c, r);
  ctx.save(); ctx.lineJoin = 'round';
  ctx.setLineDash([]); ctx.strokeStyle = `rgba(255,243,214,${0.14 * a})`; ctx.lineWidth = 6; ctx.stroke();
  ctx.setLineDash([9, 5]); ctx.strokeStyle = `rgba(255,243,214,${0.95 * a})`; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// text with a dark halo so it stays legible over hexes, fronts and tracks
function haloText(ctx, text, x, y, color, halo = 'rgba(5,10,23,0.9)', lw = 3) {
  ctx.lineJoin = 'round'; ctx.strokeStyle = halo; ctx.lineWidth = lw; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function sparkle(ctx, x, y, s, color, a, rot = 0) {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const an = i * Math.PI / 4 + rot, k = i % 2 ? 0.6 : 1;
    ctx.moveTo(x + Math.cos(an) * s * 0.25, y + Math.sin(an) * s * 0.25); ctx.lineTo(x + Math.cos(an) * s * k, y + Math.sin(an) * s * k);
    ctx.moveTo(x - Math.cos(an) * s * 0.25, y - Math.sin(an) * s * 0.25); ctx.lineTo(x - Math.cos(an) * s * k, y - Math.sin(an) * s * k);
  }
  ctx.stroke(); ctx.restore();
}
// an event landing: a ring that opens and settles, plus short rays while it moves
function burst(ctx, x, y, s, color, po, rays, settled) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.globalAlpha = po >= 1 ? settled : Math.max(settled, 1 - 0.8 * po); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, s * (0.55 + 0.75 * po), 0, 7); ctx.stroke();
  if (rays && po < 1) {
    ctx.globalAlpha = 1 - po; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8, r0 = s * (0.7 + 0.5 * po), r1 = r0 + s * 0.35 * (1 - po * 0.5); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); }
    ctx.stroke();
  }
  ctx.restore();
}

function droneShape(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.9, y + s * 0.7); ctx.lineTo(x - s * 0.9, y + s * 0.7); ctx.closePath();
}
function derShape(ctx, x, y, s) {
  ctx.beginPath();
  const k = [1, 0.82, 0.95, 0.78, 1, 0.86, 0.92];
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const X = x + Math.cos(a) * s * k[i], Y = y + Math.sin(a) * s * k[i]; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.closePath();
}
function watShape(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath();
}

// position of an object in the frame (pixel), interpolated across the transition
function objAt(F, key, n) {
  const h = F.res.hist[key];
  if (!h) return null;
  if (F.mode === 'true') {
    const p = h[n];
    if (p && key.startsWith('der:') && F.exitTrue[key.slice(4)] !== undefined && n >= F.exitTrue[key.slice(4)]) return null;
    return p || null;
  }
  if (key.startsWith('der:')) {
    const id = key.slice(4), ex = F.exitSeen[id];
    if (ex !== undefined && n >= ex) return null;
  }
  const s = SIM.seenPos(h, n);
  return s ? s[1] : null;
}
function interp(F, g, key) {
  const n = F.now, p = ease(F.p);
  const b = objAt(F, key, n);
  if (!b) return null;
  const a = F.p < 1 ? objAt(F, key, n - 1) : null;
  const B = g.px(b[0], b[1]);
  if (!a) return { x: B[0], y: B[1], hex: b, alpha: F.p < 1 ? p : 1 };
  const A = g.px(a[0], a[1]);
  return { x: lerp(A[0], B[0], p), y: lerp(A[1], B[1], p), hex: b, alpha: 1 };
}

// Ring-age labels go on the spoke that the level leaves most empty.
// (diagonal spokes only: on a horizontal spoke the labels run into each other)
const SPOKES = [[-1, 1], [0, 1], [0, -1], [1, -1]];
const spokeCache = new WeakMap();
function ringSpoke(F) {
  const L = F.level;
  const fixed = SCRIPT[L.n] && SCRIPT[L.n].spoke; // a UI-only override (L0)
  if (fixed) return fixed;
  if (spokeCache.has(L)) return spokeCache.get(L);
  const occ = new Set(), add = (p) => { if (p) occ.add(p[0] + ',' + p[1]); };
  for (const key in F.res.hist) {
    if (key.startsWith('wat:')) continue;
    const h = F.res.hist[key];
    for (const t in h) if (+t >= -6 && +t <= 14) add(h[t]); // the opening years matter most
  }
  for (const w of L.watchers || []) if (!w.hidden) { add(w.pos); if (w.split) add(w.split.pos); }
  for (const r of L.receivers || []) add(r.cell);
  if (L.world) add(L.world.pos);
  if (L.standing) add(L.standing.target);
  let best = SPOKES[0], bs = Infinity;
  const pref = [0, 0.1, 0.6, 0.7]; // quiet labels belong low on the board
  for (const [i, d] of SPOKES.entries()) {
    let sc = pref[i];
    for (let k = 1; k <= L.R; k++) {
      if (occ.has(d[0] * k + ',' + d[1] * k)) sc += k === 1 ? 3 : 1;
      if (occ.has(d[0] * k + ',' + (d[1] * k + 1))) sc += 0.25; // the hex just below the label
    }
    if (sc < bs) { bs = sc; best = d; }
  }
  spokeCache.set(L, best);
  return best;
}

// Greedy placement for pills (arrival tags, ages): try a few spots around the
// anchor and keep the one that overlaps least with objects and other pills.
function rectOverlap(a, b) {
  const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return x > 0 && y > 0 ? x * y / Math.max(1, Math.min(a.w * a.h, b.w * b.h)) : 0;
}
function layoutPills(ctx, g, pills, occ) {
  const placed = [];
  pills.map((p, i) => [p, i]).sort((a, b) => b[0].prio - a[0].prio || a[1] - b[1]).forEach(([it]) => {
    ctx.font = `600 ${it.fs}px ${FONT}`;
    const w = Math.ceil(ctx.measureText(it.text).width) + 12, h = Math.round(it.fs + 7), gp = it.gap;
    const below = [0, gp + h / 2], above = [0, -(gp + h / 2)], right = [gp + w / 2 + 1, 0], left = [-(gp + w / 2 + 1), 0];
    const below2 = [0, gp + h * 1.5 + 2], above2 = [0, -(gp + h * 1.5 + 2)];
    const dr = [gp * 0.7 + w / 2, gp * 0.7 + h / 2], dl = [-(gp * 0.7 + w / 2), gp * 0.7 + h / 2];
    const ur = [gp * 0.7 + w / 2, -(gp * 0.7 + h / 2)], ul = [-(gp * 0.7 + w / 2), -(gp * 0.7 + h / 2)];
    const cands = it.prefer === 'above' ? [above, below, ur, ul, right, left, above2, below2, dr, dl]
      : [below, above, dr, dl, right, left, below2, above2, ur, ul];
    let best = null, bc = Infinity, bi = 0;
    cands.forEach(([dx, dy], i) => {
      const r = { x: Math.round(it.x + dx - w / 2), y: Math.round(it.y + dy - h / 2), w, h };
      let c = i * 0.15;
      if (r.x < 1 || r.y < 1 || r.x + w > g.w - 1 || r.y + h > g.h - 1) c += 30;
      for (const p of placed) c += 14 * rectOverlap(r, p);
      for (const o of occ) c += o.wt * rectOverlap(r, o);
      if (c < bc) { bc = c; best = r; bi = i; }
    });
    placed.push(best);
    // a pill pushed off to the side keeps a thin leader to what it labels
    if (bi >= 2) {
      const qx = Math.max(best.x, Math.min(it.x, best.x + best.w)), qy = Math.max(best.y, Math.min(it.y, best.y + best.h));
      const d = Math.hypot(qx - it.x, qy - it.y);
      if (d > gp * 0.9) {
        const ax = it.x + (qx - it.x) / d * gp * 0.8, ay = it.y + (qy - it.y) / d * gp * 0.8;
        ctx.save(); ctx.globalAlpha = it.alpha * 0.55; ctx.strokeStyle = it.color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(qx, qy); ctx.stroke(); ctx.restore();
      }
    }
    drawPill(ctx, best, it);
  });
}
function drawPill(ctx, r, it) {
  ctx.save(); ctx.globalAlpha = it.alpha;
  ctx.font = `600 ${it.fs}px ${FONT}`;
  roundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, r.h / 2);
  ctx.fillStyle = it.quiet ? 'rgba(5,10,23,0.78)' : 'rgba(5,10,23,0.92)'; ctx.fill();
  ctx.strokeStyle = it.color; ctx.globalAlpha = it.alpha * (it.quiet ? 0.45 : 1); ctx.lineWidth = 1; ctx.stroke();
  ctx.globalAlpha = it.alpha; ctx.fillStyle = it.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(it.text, r.x + r.w / 2, r.y + r.h / 2 + 0.5);
  ctx.restore();
}

function render(ctx, g, F) {
  const L = F.level, R = L.R, s = g.size, T = F.clock || 0, RM = !!F.reduced;
  const seen = F.mode === 'seen';
  const vt = F.now - 1 + F.p;                              // linear visual time
  const po = F.p >= 1 ? 1 : easeOut(F.p), pe = F.p >= 1 ? 1 : ease(F.p);
  const vf = F.now - 1 + po;                               // fronts ease out within each year
  const osc = (per, ph = 0) => (RM ? 0 : Math.sin(T / per + ph));
  const occ = [], pills = [];
  const keep = (x, y, r, wt = 6) => occ.push({ x: x - r, y: y - r, w: 2 * r, h: 2 * r, wt });
  const smallFs = Math.round(Math.max(10, Math.min(12, s * 0.46)));
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, g.w, g.h);
  // stars
  if (F.stars) { ctx.fillStyle = '#ffffff'; for (const st of F.stars) { ctx.globalAlpha = st[2] * (0.6 + 0.4 * osc(1300, st[3])); ctx.fillRect(st[0] * g.w, st[1] * g.h, 1.2, 1.2); } ctx.globalAlpha = 1; }
  // hexes (warm at home, cool at rim)
  const warm = [44, 36, 30], cool = [12, 22, 40];
  for (const c of g.cells) {
    const [x, y] = g.px(c[0], c[1]);
    const t = SIM.ring(c) / R;
    const m = mixColor(warm, cool, Math.min(1, t * 1.05));
    hexPath(ctx, x, y, s * 0.97);
    ctx.fillStyle = `rgb(${m[0]},${m[1]},${m[2]})`; ctx.fill();
    ctx.strokeStyle = 'rgba(160,185,230,0.10)'; ctx.lineWidth = 1; ctx.stroke();
  }
  // ring age labels on the emptiest spoke
  if (seen && !F.noLabels) {
    const sp = ringSpoke(F), fs = Math.round(Math.max(10, Math.min(11.5, s * 0.44)));
    ctx.save(); ctx.font = `500 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 1; k <= R; k++) {
      const [x, y0] = g.px(sp[0] * k, sp[1] * k), y = y0 + s * 0.56;
      const txt = k === 1 ? '1 yr ago' : `${k} yrs`, w = ctx.measureText(txt).width;
      haloText(ctx, txt, x, y, `rgba(${mixColor([255, 236, 205], [150, 175, 215], k / R).join(',')},0.62)`, 'rgba(5,10,23,0.55)', 2.5);
      occ.push({ x: x - w / 2, y: y - fs / 2, w, h: fs, wt: 1.2 });
    }
    ctx.restore();
  }
  // highlights (tutorial)
  for (const hl of F.ui.highlight || []) {
    const [x, y] = g.px(hl[0], hl[1]);
    ctx.save(); ctx.globalAlpha = RM ? 0.8 : 0.5 + 0.35 * osc(240);
    hexPath(ctx, x, y, s * 0.92); ctx.fillStyle = 'rgba(255,243,214,0.08)'; ctx.fill();
    ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
  }
  // the mark (L0): a place on the map, not an object, so neither solid nor dashed
  const mark = L.objective.type === 'reach' ? L.objective.cell : null;
  if (mark) {
    const [x, y] = g.px(mark[0], mark[1]), fs = Math.round(Math.max(8, Math.min(10, s * 0.34)));
    ctx.save();
    hexPath(ctx, x, y, s * 0.8); ctx.strokeStyle = 'rgba(255,243,214,0.8)'; ctx.lineWidth = 1.4; ctx.stroke();
    hexPath(ctx, x, y, s * 0.66); ctx.strokeStyle = 'rgba(255,243,214,0.22)'; ctx.lineWidth = 1; ctx.stroke();
    // the label sits just above the outline, clear of whatever stands on the mark
    const ly = y - s * 0.8 - fs * 0.75;
    ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    haloText(ctx, 'MARK', x, ly, 'rgba(255,243,214,0.85)', 'rgba(5,10,23,0.85)', 3);
    ctx.restore();
    occ.push({ x: x - s * 0.6, y: ly - fs / 2 - 1, w: s * 1.2, h: fs + 2, wt: 6 });
  }

  // ---------- fronts (clipped to the board) ----------
  let txFlash = 0;
  ctx.save();
  frontPath(ctx, g, SIM.HOME, R + 0.62); ctx.clip();
  for (const pu of F.res.pulses) {
    if (pu.t > vt) continue;
    const r = vf - pu.t;
    if (r < 0 || r > R + 1.6) continue;
    if (pu.standing && seen && vt < pu.t + SIM.ring(pu.src)) continue;
    if (pu.from === 'HOME' && pu.t === F.now - 1 && F.p < 1) txFlash = Math.max(txFlash, 1 - po); // TRANSMIT acknowledged
    const rgb = pu.kind === 'order' ? COL.order : pu.to ? COL.ask : COL.flash;
    const a = clamp01((R + 0.9 - r) / 1.4) * (pu.kind === 'order' ? 0.6 : 0.88);
    const rr = Math.max(0.02, r);
    // soft glow under the leading edge while it moves
    frontPath(ctx, g, pu.src, rr);
    ctx.setLineDash([]); ctx.strokeStyle = `rgba(${rgb},${a * (seen ? 0.12 : 0.22)})`; ctx.lineWidth = seen ? 4 : 6; ctx.stroke();
    ctx.setLineDash(seen ? [5, 5] : []); ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = 1.6; ctx.stroke();
  }
  ctx.setLineDash([]);
  // L0, seen mode: Home knows when its drone arrives, so it can calculate
  // where the news of the arrival is on its way home (dashed, until it lands)
  if (seen && mark) {
    const h = F.res.hist['drone:' + L.objective.drone] || {};
    let ta = null;
    for (let y = 0; y <= F.now; y++) if (SIM.eq(h[y], mark)) { ta = y; break; }
    const r = ta === null ? -1 : vf - ta, d = SIM.ring(mark);
    if (r >= 0 && r < d) newsFront(ctx, g, mark, Math.max(0.3, r), 1);
  }
  // true mode: the news of each objective event travelling home
  if (!seen && F.newsEvents) {
    for (const e of F.newsEvents) {
      const r = vt - e.t, d = SIM.ring(e.pos);
      if (r < 0 || r > d + 0.3) continue;
      frontPath(ctx, g, e.pos, Math.max(0.02, r));
      ctx.strokeStyle = 'rgba(255,243,214,0.18)'; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,243,214,0.95)'; ctx.lineWidth = 2.2; ctx.stroke();
    }
  }
  ctx.restore();

  // ---------- finale world ----------
  if (F.fin) drawWorld(ctx, g, F, vt, { osc, keep, pills, RM, po, smallFs });

  // ---------- drone positions (seen ghost + calculated) ----------
  const dpos = {};
  for (const id of Object.keys(L.drones || {})) {
    const key = 'drone:' + id;
    const gh = interp(F, g, key);
    let calc = null;
    if (seen) {
      const indep = F.fin && F.fin.standingAt !== null && F.now >= F.fin.standingAt;
      const tp = F.res.hist[key][F.now];
      if (tp && !indep) {
        const pa = F.p < 1 ? F.res.hist[key][F.now - 1] : null;
        let [x, y] = g.px(tp[0], tp[1]);
        if (pa) { const [x0, y0] = g.px(pa[0], pa[1]); x = lerp(x0, x, pe); y = lerp(y0, y, pe); }
        calc = { x, y };
      }
    }
    dpos[id] = { gh, calc };
  }
  // queued / in-flight move lines and target reticles (under the objects)
  for (const t of F.ui.moveLines || []) {
    const d = dpos[t.who], from = d && (d.calc || d.gh);
    if (!from) continue;
    const [x, y] = g.px(t.target[0], t.target[1]);
    ctx.save(); ctx.strokeStyle = t.queued ? 'rgba(243,214,140,0.95)' : 'rgba(243,214,140,0.5)'; ctx.lineWidth = 1.5;
    const ang = Math.atan2(y - from.y, x - from.x), rr = s * 0.68, len = Math.hypot(x - from.x, y - from.y);
    if (len > rr + 2) { ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(x - Math.cos(ang) * rr, y - Math.sin(ang) * rr); ctx.stroke(); ctx.setLineDash([]); }
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a0 = i * Math.PI / 2 + Math.PI / 4; ctx.moveTo(x + Math.cos(a0 - 0.42) * rr, y + Math.sin(a0 - 0.42) * rr); ctx.arc(x, y, rr, a0 - 0.42, a0 + 0.42); }
    ctx.stroke();
    ctx.restore();
    keep(x, y, s * 0.72, 3);
  }

  // ---------- derelict tracks + projections (seen mode; year ticks read over the reticles) ----------
  for (const d of L.derelicts || []) {
    const unlocked = seen && F.unlock[d.id] !== null && F.unlock[d.id] !== undefined && F.now >= F.unlock[d.id];
    if (!unlocked) continue;
    const tp = F.res.hist['der:' + d.id][F.now];
    if (!tp || (F.exitTrue[d.id] !== undefined && F.now >= F.exitTrue[d.id])) continue;
    const fut = derFuture(d, F.now, R);
    const [px0, py0] = g.px(tp[0], tp[1]);
    const fresh = F.now === F.unlock[d.id] ? pe : 1; // the track draws itself in on the unlock year
    ctx.save(); ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(190,198,210,0.55)'; ctx.lineWidth = 1.5;
    ctx.globalAlpha = fresh;
    ctx.beginPath(); ctx.moveTo(px0, py0);
    for (const f of fut) { const [x, y] = g.px(f.pos[0], f.pos[1]); ctx.lineTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `600 ${smallFs - 1}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of fut) {
      const [x, y] = g.px(f.pos[0], f.pos[1]);
      ctx.fillStyle = 'rgba(200,206,216,0.85)'; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill();
      const txt = 'yr ' + f.t, ty = y + s * 0.5, w = ctx.measureText(txt).width;
      haloText(ctx, txt, x, ty, 'rgba(206,212,222,0.8)', 'rgba(5,10,23,0.85)', 3);
      occ.push({ x: x - w / 2, y: ty - smallFs / 2, w, h: smallFs, wt: 2 });
    }
    ctx.restore();
  }

  // ---------- relays (fixed) ----------
  for (const rc of L.receivers || []) {
    if (!rc.cell) continue;
    const [x, y] = g.px(rc.cell[0], rc.cell[1]);
    const on = relayOn(F, rc.id);
    ctx.save();
    if (on) { ctx.shadowColor = COL.relay; ctx.shadowBlur = 18; }
    ctx.fillStyle = on ? COL.relay : 'rgba(79,216,200,0.25)'; ctx.strokeStyle = COL.relay; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(x - s * 0.36, y - s * 0.36, s * 0.72, s * 0.72); ctx.fill(); ctx.stroke();
    ctx.restore();
    label(ctx, x, y, rc.id, on ? '#032' : COL.relay, s);
    needDots(ctx, x, y + s * 0.6, rc.need, s);
    keep(x, y, s * 0.5);
  }

  // ---------- derelicts (seen images, solid) ----------
  for (const d of L.derelicts || []) {
    const o = interp(F, g, 'der:' + d.id);
    if (!o) continue;
    const tagged = eventSeen(F, (e) => e.type === 'tag' && e.data[0] === d.id);
    ctx.save(); ctx.globalAlpha = o.alpha * (tagged ? 0.55 : 1);
    derShape(ctx, o.x, o.y, s * 0.42); ctx.fillStyle = COL.der; ctx.fill();
    ctx.strokeStyle = '#d6dae0'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    const ride = (L.receivers || []).find((r) => r.ride === d.id);
    if (ride) { const on = relayOn(F, ride.id); ctx.save(); ctx.globalAlpha = o.alpha; ctx.strokeStyle = COL.relay; ctx.lineWidth = on ? 3 : 2; if (on) { ctx.shadowColor = COL.relay; ctx.shadowBlur = 16; } ctx.beginPath(); ctx.arc(o.x, o.y, s * 0.6, 0, 7); ctx.stroke(); ctx.restore(); needDots(ctx, o.x, o.y + s * 0.8, ride.need, s); }
    label(ctx, o.x, o.y, d.id, '#1a1d22', s * 0.85);
    if (tagged) { ctx.save(); ctx.strokeStyle = COL.drone; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, s * 0.55, 0, 7); ctx.stroke(); ctx.restore(); }
    keep(o.x, o.y, s * (ride ? 0.66 : 0.48));
    if (seen && !F.noLabels) {
      const sp = SIM.seenPos(F.res.hist['der:' + d.id], F.now);
      if (sp) { const age = F.now - sp[0]; pills.push({ x: o.x, y: o.y, gap: s * (ride ? 0.66 : 0.5), text: age <= 0 ? 'now' : `${age} yr${age === 1 ? '' : 's'} ago`, color: 'rgba(206,212,222,0.95)', alpha: 0.9 * o.alpha, fs: smallFs - 1, prio: 1, prefer: 'above', quiet: true }); }
    }
  }
  // projection NOW markers (dashed = calculated)
  if (seen) for (const d of L.derelicts || []) {
    if (!(F.unlock[d.id] !== null && F.unlock[d.id] !== undefined && F.now >= F.unlock[d.id])) continue;
    if (F.exitTrue[d.id] !== undefined && F.now >= F.exitTrue[d.id]) continue;
    const tp = F.res.hist['der:' + d.id][F.now];
    if (!tp) continue;
    const pa = F.p < 1 ? F.res.hist['der:' + d.id][F.now - 1] : null;
    let [x, y] = g.px(tp[0], tp[1]);
    if (pa) { const [x0, y0] = g.px(pa[0], pa[1]); x = lerp(x0, x, pe); y = lerp(y0, y, pe); }
    const first = F.now === F.unlock[d.id];
    const sc = first ? (F.p < 1 ? 1.8 - 0.8 * po : 1 + 0.12 * osc(160)) : 1; // snaps in on the unlock year
    ctx.save(); ctx.globalAlpha = first ? Math.max(0.15, pe) : 1;
    ctx.setLineDash([4, 3]); ctx.strokeStyle = '#e4e8ee'; ctx.lineWidth = 1.6;
    derShape(ctx, x, y, s * 0.42 * sc); ctx.stroke();
    const ride = (L.receivers || []).find((r) => r.ride === d.id);
    if (ride) { ctx.strokeStyle = COL.relay; ctx.beginPath(); ctx.arc(x, y, s * 0.6, 0, 7); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.font = `800 ${Math.round(Math.max(9, Math.min(10.5, s * 0.4)))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    haloText(ctx, 'NOW', x, y + 0.5, '#f1f4f8', 'rgba(5,10,23,0.95)', 3);
    ctx.restore();
    keep(x, y, s * (ride ? 0.66 : 0.48));
  }

  // ---------- watchers ----------
  for (const w of F.res.wat) {
    const hidden = w.hidden && !F.showHidden;
    if (seen) {
      // split children are only drawn once seen
      if (w.born > 0 && w.born + SIM.ring(w.pos) > F.now) continue;
    } else if (w.born > F.now) continue;
    if (hidden) continue;
    let ra = 1;
    if (w.hidden && F.reveal) { const r0 = F.reveal[w.id]; if (r0 === undefined || vt < r0) continue; ra = clamp01((vt - r0) / 0.8); }
    const [x, y] = g.px(w.pos[0], w.pos[1]);
    const signed = eventSeen(F, (e) => e.type === 'sign' && e.data === w.id);
    const off = eventSeen(F, (e) => e.type === 'offended' && e.data === w.id);
    const fresh = seen && w.born > 0 && w.born + SIM.ring(w.pos) === F.now;
    ctx.save();
    ctx.globalAlpha = (fresh ? pe : 1) * ra;
    if (w.hidden && F.reveal) { ctx.strokeStyle = 'rgba(185,147,255,0.5)'; ctx.lineWidth = 1.5; hexPath(ctx, x, y, s * (0.92 + 0.5 * (1 - ra))); ctx.stroke(); }
    watShape(ctx, x, y, s * 0.46);
    ctx.fillStyle = w.kind === 'mirror' ? 'rgba(185,147,255,0.35)' : COL.wat; ctx.fill();
    ctx.strokeStyle = '#e1d2ff'; ctx.lineWidth = 1.2; ctx.stroke();
    if (w.kind === 'precedent') { ctx.strokeStyle = 'rgba(225,210,255,0.8)'; watShape(ctx, x, y, s * 0.62); ctx.stroke(); }
    ctx.restore();
    if (w.kind !== 'mirror') label(ctx, x, y, w.id === 'R2' ? 'R′' : w.id, '#1b0f33', s * 0.85);
    const pop = (e) => (e && (seen ? SIM.seenTick(e) : e.t) === F.now && F.p < 1 ? 1 + 0.7 * (1 - po) : 1);
    if (signed) badge(ctx, x + s * 0.5, y - s * 0.46, '✓', COL.sign, s * pop(signed));
    if (off) badge(ctx, x + s * 0.5, y - s * 0.46, '✕', COL.object, s * pop(off));
    keep(x, y, s * (w.kind === 'precedent' ? 0.64 : 0.5));
  }

  // ---------- events (pops) ----------
  const evNow = (e) => seen ? SIM.seenTick(e) === F.now : e.t === F.now;
  const steady = F.p < 1 ? 1 : (RM ? 0.75 : 0.55 + 0.25 * osc(300));
  for (const e of F.res.events) {
    if (e.type === 'order_rx' && seen && e.t === F.now) {
      // Home calculates the moment its order lands: a dashed tick around the drone
      const d = dpos[e.data[0]], c = d && d.calc;
      if (!c) continue;
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = COL.drone; ctx.lineWidth = 1.6;
      ctx.globalAlpha = F.p < 1 ? 1 - 0.75 * po : 0.25;
      ctx.beginPath(); ctx.arc(c.x, c.y, s * (0.62 + 0.45 * po), 0, 7); ctx.stroke(); ctx.restore();
      continue;
    }
    if (!evNow(e)) continue;
    const [x, y] = g.px(e.pos[0], e.pos[1]);
    if (e.type === 'glint') {
      const w = F.res.wat.find((q) => q.id === e.data);
      const faint = w && w.hidden && !F.showHidden;
      sparkle(ctx, x, y, s * (0.32 + 0.28 * po), faint ? '#d9c8ff' : '#f0e6ff', steady * (faint ? 0.75 : 1), RM ? 0 : po * 0.5);
    } else if (e.type === 'tag') burst(ctx, x, y, s, COL.drone, po, true, 0.3);
    else if (e.type === 'rec_on') burst(ctx, x, y, s, COL.relay, po, true, 0.3);
    else if (e.type === 'sign') burst(ctx, x, y, s, COL.sign, po, false, 0.25);
    else if (e.type === 'offended') burst(ctx, x, y, s, COL.object, po, false, 0.25);
    else if (e.type === 'flash') {
      if (seen && e.pos[0] === 0 && e.pos[1] === 0) continue;
      ctx.save(); ctx.globalAlpha = steady; ctx.fillStyle = e.data[1] ? 'rgba(196,160,255,0.5)' : 'rgba(243,214,140,0.55)';
      ctx.beginPath(); ctx.arc(x, y, s * (0.5 + (F.p < 1 ? 0.25 * (1 - po) : 0)), 0, 7); ctx.fill(); ctx.restore();
    }
  }

  // ---------- drones ----------
  for (const id of Object.keys(L.drones || {})) {
    const { gh, calc } = dpos[id];
    const apart = calc && gh && (Math.abs(calc.x - gh.x) > 1 || Math.abs(calc.y - gh.y) > 1);
    if (apart) {
      ctx.save(); ctx.strokeStyle = 'rgba(243,214,140,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gh.x, gh.y); ctx.lineTo(calc.x, calc.y); ctx.stroke(); ctx.restore();
    }
    if (gh) {
      ctx.save(); ctx.globalAlpha = gh.alpha * (apart ? 0.7 : 1);
      droneShape(ctx, gh.x, gh.y + s * 0.05, s * 0.5); ctx.fillStyle = COL.drone; ctx.fill(); ctx.restore();
      label(ctx, gh.x, gh.y + s * 0.12, id, '#2a2000', s * 0.8);
      keep(gh.x, gh.y, s * 0.55);
    }
    if (calc) {
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = COL.drone; ctx.lineWidth = 1.6;
      droneShape(ctx, calc.x, calc.y + s * 0.05, s * 0.62); ctx.stroke(); ctx.restore();
      if (apart) label(ctx, calc.x, calc.y + s * 0.14, id, 'rgba(243,214,140,0.85)', s * 0.62);
      keep(calc.x, calc.y, s * 0.62);
    }
    if (F.ui.selected === id) {
      const c = calc || gh;
      if (c) { ctx.save(); ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2; ctx.globalAlpha = RM ? 0.9 : 0.65 + 0.35 * osc(200); ctx.beginPath(); ctx.arc(c.x, c.y, s * 0.88, 0, 7); ctx.stroke(); ctx.restore(); keep(c.x, c.y, s * 0.9, 2); }
    }
  }

  // ---------- home ----------
  {
    const [x, y] = g.px(0, 0);
    const conf = F.confirm && F.now === F.confirm.at ? F.confirm : null;
    // the light of the confirming event has just reached Home
    if (conf) {
      ctx.save();
      for (const pt of conf.pts) {
        const [ex, ey] = g.px(pt[0], pt[1]);
        const gr = ctx.createLinearGradient(ex, ey, x, y);
        const a = F.p < 1 ? 0.25 + 0.75 * po : (RM ? 0.6 : 0.5 + 0.15 * osc(420));
        gr.addColorStop(0, `rgba(255,243,214,${0.1 * a})`); gr.addColorStop(1, `rgba(255,243,214,${0.85 * a})`);
        ctx.strokeStyle = gr; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(x, y); ctx.stroke();
      }
      if (F.p < 1) { ctx.strokeStyle = `rgba(255,243,214,${1 - po})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, s * (0.5 + 2.6 * po), 0, 7); ctx.stroke(); }
      ctx.restore();
    }
    const glow = 1 + (conf ? 0.6 : 0) + 0.9 * txFlash;
    ctx.save();
    const gr = ctx.createRadialGradient(x, y, 0, x, y, s * 1.3 * glow);
    gr.addColorStop(0, `rgba(255,243,214,${Math.min(0.9, 0.55 + 0.3 * txFlash)})`); gr.addColorStop(1, 'rgba(255,243,214,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, s * 1.3 * glow, 0, 7); ctx.fill();
    ctx.fillStyle = COL.home; ctx.beginPath(); ctx.arc(x, y, s * 0.3, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,243,214,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, 7); ctx.stroke();
    if (F.ui.selected === 'HOME') { ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2; ctx.globalAlpha = RM ? 0.9 : 0.65 + 0.35 * osc(200); ctx.beginPath(); ctx.arc(x, y, s * 0.88, 0, 7); ctx.stroke(); }
    ctx.restore();
    keep(x, y, s * 0.55);
  }

  // ---------- tags ----------
  // identical tags on the same hex merge ("reaches yr 7 ×2" is the relay puzzle's answer)
  const groups = new Map();
  for (const tg of F.ui.tags || []) {
    const k = tg.pos.join(',') + '|' + tg.text;
    const gr = groups.get(k);
    if (gr) { gr.n++; gr.queued = gr.queued || tg.queued; } else groups.set(k, { tg, n: 1, queued: !!tg.queued });
  }
  const anyQueued = (F.ui.tags || []).some((t) => t.queued);
  for (const { tg, n, queued } of groups.values()) {
    const [x, y] = g.px(tg.pos[0], tg.pos[1]);
    pills.push({ x, y, gap: s * 0.55, text: tg.text + (n > 1 ? ` ×${n}` : ''), color: tg.color || COL.drone, alpha: queued ? 1 : anyQueued ? 0.6 : 0.82, fs: smallFs, prio: queued ? 3 : 2, prefer: 'below' });
  }
  layoutPills(ctx, g, pills, occ);
}

function drawWorld(ctx, g, F, vt, K) {
  const fin = F.fin, W = FIN.W, s = g.size, T = F.clock || 0, seen = F.mode === 'seen', { osc, RM } = K;
  const [x, y] = g.px(W[0], W[1]);
  const lag = seen ? FIN.WR : 0;
  const n = F.now;
  // leak halo: every year from true 1
  if (n - lag >= 1) {
    ctx.save(); ctx.globalAlpha = RM ? 0.35 : 0.25 + 0.2 * osc(90) * osc(370);
    ctx.strokeStyle = COL.world; ctx.lineWidth = 1; ctx.setLineDash([1, 3]);
    ctx.beginPath(); ctx.arc(x, y, s * 0.95, 0, 7); ctx.stroke(); ctx.restore();
  }
  const gr = ctx.createRadialGradient(x - s * 0.15, y - s * 0.15, s * 0.05, x, y, s * 0.6);
  gr.addColorStop(0, '#e6f3ff'); gr.addColorStop(0.6, COL.world); gr.addColorStop(1, '#3a6aa8');
  ctx.save(); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, s * 0.52, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(200,230,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, s * 0.68, 0, 7); ctx.stroke(); ctx.restore();
  K.keep(x, y, s * 0.72);
  // call this year
  if (fin.calls.includes(n - lag)) {
    const ph = RM ? 0.35 : (T % 1600) / 1600;
    ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 1 - ph; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, s * (0.6 + ph * 0.9), 0, 7); ctx.stroke(); ctx.restore();
    blips(ctx, x, y - s * 1.2, [2, 3, 5, 7], '#ffffff', s, RM ? null : T);
    K.keep(x, y - s * 1.05, s * 0.45, 4);
  }
  if (FIN.NOTYET.includes(n - lag)) {
    const ph = RM ? 0.3 : ((T + 800) % 2000) / 2000;
    ctx.save(); ctx.strokeStyle = COL.amber; ctx.globalAlpha = (1 - ph) * 0.8; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, s * (0.55 + ph * 0.6), 0, 7); ctx.stroke(); ctx.restore();
    K.pills.push({ x, y, gap: s * 0.75, text: 'NOT YET', color: COL.amber, alpha: 0.95, fs: K.smallFs, prio: 1.5, prefer: 'below' });
  }
  // true-mode fronts from W: calls, not-yet, reply
  if (!seen) {
    const fr = [];
    for (const c of fin.calls) fr.push([c, '255,255,255', 0.8]);
    for (const c of FIN.NOTYET) fr.push([c, '255,181,71', 0.6]);
    if (fin.replyEmit !== null) fr.push([fin.replyEmit, COL.reply, 1]);
    for (const [t0, rgb, a] of fr) {
      const r = vt - t0; if (r < 0 || r > 6.5) continue;
      ctx.save(); ctx.strokeStyle = `rgba(${rgb},${a * Math.max(0, 1 - r / 6.5)})`; ctx.lineWidth = rgb === COL.reply ? 3 : 1.4; frontPath(ctx, g, W, Math.max(0.02, r)); ctx.stroke(); ctx.restore();
    }
  }
  // their probe
  if (fin.probe) {
    const ps = seen ? FIN.probeSeen(n) : (FIN.probePos(n) ? [n, FIN.probePos(n)] : null);
    if (ps) {
      const [px, py] = g.px(ps[1][0], ps[1][1]);
      ctx.save(); ctx.fillStyle = '#cfe6ff'; ctx.translate(px + s * 0.35, py + s * 0.3); ctx.rotate(Math.atan2(-py + g.cy, -px + g.cx) + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(s * 0.2, s * 0.25); ctx.lineTo(-s * 0.2, s * 0.25); ctx.closePath(); ctx.fill(); ctx.restore();
      K.keep(px + s * 0.35, py + s * 0.3, s * 0.35);
    }
  }
  ctx.save(); ctx.font = `700 ${Math.round(Math.max(10, Math.min(13, s * 0.5)))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  haloText(ctx, 'W', x, y + s * 0.98, COL.world); ctx.restore();
  K.keep(x, y + s * 0.98, s * 0.3, 4);
}

function blips(ctx, x, y, groups, color, s, T) {
  const total = groups.reduce((a, b) => a + b, 0) + groups.length - 1;
  const w = s * 0.14; let i = 0;
  ctx.save(); ctx.fillStyle = color;
  const lit = T === null ? total : Math.floor((T / 90) % (total + 8));
  for (let gi = 0; gi < groups.length; gi++) {
    for (let k = 0; k < groups[gi]; k++) { ctx.globalAlpha = i <= lit ? 0.95 : 0.2; ctx.fillRect(x - total * w / 2 + i * w, y, w * 0.6, w * 1.6); i++; }
    i++;
  }
  ctx.restore();
}

function label(ctx, x, y, text, color, s) {
  ctx.save(); ctx.font = `700 ${Math.max(9, Math.min(14, s * 0.5))}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5); ctx.restore();
}
function badge(ctx, x, y, ch, color, s) {
  ctx.save(); ctx.fillStyle = 'rgba(5,10,23,0.92)'; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, s * 0.26, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.font = `800 ${Math.max(9, s * 0.34)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, x, y + 0.5); ctx.restore();
}
function needDots(ctx, x, y, n, s) {
  ctx.save(); ctx.fillStyle = COL.relay;
  for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x + (i - (n - 1) / 2) * s * 0.2, y, Math.max(1.4, s * 0.06), 0, 7); ctx.fill(); }
  ctx.restore();
}

function eventSeen(F, pred) {
  for (const e of F.res.events) if (pred(e) && (F.mode === 'seen' ? SIM.seenTick(e) <= F.now : e.t <= F.now)) return e;
  return null;
}
function relayOn(F, id) { return !!eventSeen(F, (e) => e.type === 'rec_on' && e.data === id); }

// future hex entries of a derelict after year `now` while on the board
function derFuture(d, now, R) {
  const dir = SIM.DIRS[d.dir], out = [];
  let pos = derPosAt(d, now), t = now;
  // next step time
  let nx = d.first; while (nx <= now) nx += d.period;
  for (let k = 0; k < 12; k++) {
    pos = [pos[0] + dir[0], pos[1] + dir[1]]; t = nx; nx += d.period;
    if (SIM.ring(pos) > R) break;
    out.push({ pos, t });
  }
  return out;
}
function derPosAt(d, t) {
  const dir = SIM.DIRS[d.dir]; let steps = 0;
  if (t >= d.first) steps = Math.floor((t - d.first) / d.period) + 1;
  return [d.pos[0] + dir[0] * steps, d.pos[1] + dir[1] * steps];
}
