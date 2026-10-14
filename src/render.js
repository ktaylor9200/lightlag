// LIGHT LAG — canvas renderer. render(ctx, geom, F) draws one frame of a level
// at visual time F.now-1+F.p. mode 'seen' = what Home sees/calculates;
// mode 'true' = god's-eye (truth replay).
const COL = {
  bg: '#050a17', home: '#fff3d6', drone: '#f3d68c', der: '#aab0ba', relay: '#4fd8c8', wat: '#b993ff',
  world: '#a8d2ff', amber: '#ffb547', order: '255,238,206', ask: '196,160,255', flash: '243,214,140', reply: '170,240,200',
  text: '#dfe6f2', dim: 'rgba(200,215,240,0.55)',
};
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

function pill(ctx, x, y, text, color, alpha = 1, fs = 11) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `600 ${fs}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  const w = ctx.measureText(text).width + 10, h = fs + 6;
  ctx.fillStyle = 'rgba(5,10,23,0.86)'; ctx.strokeStyle = color; ctx.lineWidth = 1;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function sparkle(ctx, x, y, s, color, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { const an = i * Math.PI / 4; ctx.moveTo(x + Math.cos(an) * s * 0.25, y + Math.sin(an) * s * 0.25); ctx.lineTo(x + Math.cos(an) * s, y + Math.sin(an) * s); ctx.moveTo(x - Math.cos(an) * s * 0.25, y - Math.sin(an) * s * 0.25); ctx.lineTo(x - Math.cos(an) * s, y - Math.sin(an) * s); }
  ctx.stroke(); ctx.restore();
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

function render(ctx, g, F) {
  const L = F.level, R = L.R, vt = F.now - 1 + F.p, s = g.size, T = F.clock || 0;
  const seen = F.mode === 'seen';
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, g.w, g.h);
  // stars
  if (F.stars) { ctx.fillStyle = '#ffffff'; for (const st of F.stars) { ctx.globalAlpha = st[2] * (0.6 + 0.4 * Math.sin(T / 1300 + st[3])); ctx.fillRect(st[0] * g.w, st[1] * g.h, 1.2, 1.2); } ctx.globalAlpha = 1; }
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
  // ring age labels on the lower-left spoke
  if (seen && !F.noLabels) {
    ctx.save(); ctx.font = `500 ${Math.max(9, Math.min(11, s * 0.42))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k <= R; k++) {
      const [x, y] = g.px(-k, k);
      ctx.fillStyle = k === 0 ? 'rgba(255,240,215,0.0)' : `rgba(${mixColor([255, 236, 205], [150, 175, 215], k / R).join(',')},0.42)`;
      if (k > 0) ctx.fillText(k === 1 ? '1 yr ago' : `${k} yrs`, x, y + s * 0.62);
    }
    ctx.restore();
  }
  // highlights (tutorial)
  for (const hl of F.ui.highlight || []) {
    const [x, y] = g.px(hl[0], hl[1]);
    ctx.save(); ctx.globalAlpha = 0.45 + 0.35 * Math.sin(T / 220);
    hexPath(ctx, x, y, s * 0.92); ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
  }

  // ---------- fronts ----------
  ctx.save(); ctx.lineWidth = 1.6;
  for (const pu of F.res.pulses) {
    if (pu.t > vt) continue;
    const r = vt - pu.t;
    if (r > R + 1.5) continue;
    let calc = true;
    if (pu.standing) { if (seen && vt < pu.t + SIM.ring(pu.src)) continue; }
    const rgb = pu.kind === 'order' ? COL.order : pu.to ? COL.ask : COL.flash;
    const a = Math.max(0, Math.min(1, (R + 1.5 - r) / 1.5)) * (pu.kind === 'order' ? 0.55 : 0.85);
    ctx.strokeStyle = `rgba(${rgb},${a})`;
    ctx.setLineDash(seen && calc ? [5, 5] : []);
    frontPath(ctx, g, pu.src, Math.max(0.02, r)); ctx.stroke();
    if (!seen) { ctx.strokeStyle = `rgba(${rgb},${a * 0.25})`; ctx.lineWidth = 5; ctx.stroke(); ctx.lineWidth = 1.6; }
  }
  ctx.setLineDash([]);
  // true mode: the news of each objective event travelling home
  if (!seen && F.newsEvents) {
    for (const e of F.newsEvents) {
      const r = vt - e.t, d = SIM.ring(e.pos);
      if (r < 0 || r > d + 0.3) continue;
      ctx.strokeStyle = 'rgba(255,243,214,0.9)'; ctx.lineWidth = 2.2; frontPath(ctx, g, e.pos, Math.max(0.02, r)); ctx.stroke();
    }
  }
  ctx.restore();

  // ---------- finale world ----------
  if (F.fin) drawWorld(ctx, g, F, vt);

  // ---------- derelict tracks + projections (seen mode) ----------
  for (const d of L.derelicts || []) {
    const unlocked = seen && F.unlock[d.id] !== null && F.unlock[d.id] !== undefined && F.now >= F.unlock[d.id];
    if (!unlocked) continue;
    const tp = F.res.hist['der:' + d.id][F.now];
    if (!tp || (F.exitTrue[d.id] !== undefined && F.now >= F.exitTrue[d.id])) continue;
    const fut = derFuture(d, F.now, R);
    let [px0, py0] = g.px(tp[0], tp[1]);
    ctx.save(); ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(190,198,210,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px0, py0);
    for (const f of fut) { const [x, y] = g.px(f.pos[0], f.pos[1]); ctx.lineTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `600 ${Math.max(9, Math.min(11, s * 0.42))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of fut) {
      const [x, y] = g.px(f.pos[0], f.pos[1]);
      ctx.fillStyle = 'rgba(200,206,216,0.8)'; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(200,206,216,0.62)'; ctx.fillText('yr ' + f.t, x, y + s * 0.5);
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
    needDots(ctx, x, y + s * 0.62, rc.need, s);
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
    if (ride) { const on = relayOn(F, ride.id); ctx.save(); ctx.globalAlpha = o.alpha; ctx.strokeStyle = COL.relay; ctx.lineWidth = on ? 3 : 2; if (on) { ctx.shadowColor = COL.relay; ctx.shadowBlur = 16; } ctx.beginPath(); ctx.arc(o.x, o.y, s * 0.6, 0, 7); ctx.stroke(); ctx.restore(); needDots(ctx, o.x, o.y + s * 0.82, ride.need, s); }
    label(ctx, o.x, o.y, d.id, '#1a1d22', s * 0.85);
    if (tagged) { ctx.save(); ctx.strokeStyle = COL.drone; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, s * 0.55, 0, 7); ctx.stroke(); ctx.restore(); }
    if (seen && !F.noLabels) {
      const sp = SIM.seenPos(F.res.hist['der:' + d.id], F.now);
      if (sp) { const age = F.now - sp[0]; pill(ctx, o.x, o.y - s * 0.95, age <= 0 ? 'now' : `${age} yr${age === 1 ? '' : 's'} ago`, 'rgba(200,206,216,0.9)', 0.9 * o.alpha, Math.max(9, Math.min(11, s * 0.42))); }
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
    if (pa) { const [x0, y0] = g.px(pa[0], pa[1]); x = lerp(x0, x, ease(F.p)); y = lerp(y0, y, ease(F.p)); }
    const fresh = F.now === F.unlock[d.id] ? 1 + 0.25 * Math.sin(T / 160) : 1;
    ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = '#e4e8ee'; ctx.lineWidth = 1.6;
    derShape(ctx, x, y, s * 0.42 * fresh); ctx.stroke();
    const ride = (L.receivers || []).find((r) => r.ride === d.id);
    if (ride) { ctx.strokeStyle = COL.relay; ctx.beginPath(); ctx.arc(x, y, s * 0.6, 0, 7); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.font = `700 ${Math.max(9, Math.min(10, s * 0.4))}px system-ui, sans-serif`; ctx.fillStyle = '#e4e8ee'; ctx.textAlign = 'center'; ctx.fillText('NOW', x, y + s * 0.2); ctx.restore();
  }

  // ---------- watchers ----------
  for (const w of F.res.wat) {
    const hidden = w.hidden && !F.showHidden;
    if (seen) {
      // split children are only drawn once seen
      if (w.born > 0 && w.born + SIM.ring(w.pos) > F.now) continue;
    } else if (w.born > F.now) continue;
    if (hidden) continue;
    const [x, y] = g.px(w.pos[0], w.pos[1]);
    const signed = eventSeen(F, (e) => e.type === 'sign' && e.data === w.id);
    const off = eventSeen(F, (e) => e.type === 'offended' && e.data === w.id);
    const fresh = seen && w.born > 0 && w.born + SIM.ring(w.pos) === F.now;
    ctx.save();
    if (fresh) ctx.globalAlpha = F.p;
    watShape(ctx, x, y, s * 0.46);
    ctx.fillStyle = w.kind === 'mirror' ? 'rgba(185,147,255,0.35)' : COL.wat; ctx.fill();
    ctx.strokeStyle = '#e1d2ff'; ctx.lineWidth = 1.2; ctx.stroke();
    if (w.kind === 'precedent') { ctx.strokeStyle = 'rgba(225,210,255,0.8)'; ctx.setLineDash([]); watShape(ctx, x, y, s * 0.62); ctx.stroke(); }
    ctx.restore();
    if (w.kind !== 'mirror') label(ctx, x, y, w.id === 'R2' ? 'R\u2032' : w.id, '#1b0f33', s * 0.85);
    if (signed) badge(ctx, x + s * 0.48, y - s * 0.45, '\u2713', '#7cf0b0', s);
    if (off) badge(ctx, x + s * 0.48, y - s * 0.45, '\u2715', '#ff8a8a', s);
  }

  // ---------- events (pops) ----------
  const evNow = (e) => seen ? SIM.seenTick(e) === F.now : e.t === F.now;
  const popA = F.p < 1 ? (1 - Math.abs(F.p * 2 - 1) * 0.3) : 0.55 + 0.25 * Math.sin(T / 300);
  for (const e of F.res.events) {
    if (!evNow(e)) continue;
    const [x, y] = g.px(e.pos[0], e.pos[1]);
    if (e.type === 'glint') {
      const w = F.res.wat.find((q) => q.id === e.data);
      sparkle(ctx, x, y, s * (0.35 + 0.25 * F.p), w && w.hidden && !F.showHidden ? '#d9c8ff' : '#f0e6ff', popA * (w && w.hidden && !F.showHidden ? 0.75 : 1));
    } else if (e.type === 'tag' || e.type === 'rec_on' || e.type === 'sign') {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - F.p * 0.7); ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, s * (0.5 + F.p * 0.9), 0, 7); ctx.stroke(); ctx.restore();
    } else if (e.type === 'offended') {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - F.p * 0.7); ctx.strokeStyle = '#ff8a8a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, s * (0.5 + F.p * 0.9), 0, 7); ctx.stroke(); ctx.restore();
    } else if (e.type === 'flash') {
      if (seen && e.pos[0] === 0 && e.pos[1] === 0) continue;
      ctx.save(); ctx.globalAlpha = popA; ctx.fillStyle = e.data[1] ? 'rgba(196,160,255,0.5)' : 'rgba(243,214,140,0.55)';
      ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, 7); ctx.fill(); ctx.restore();
    }
  }

  // ---------- drones ----------
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
        if (pa) { const [x0, y0] = g.px(pa[0], pa[1]); x = lerp(x0, x, ease(F.p)); y = lerp(y0, y, ease(F.p)); }
        calc = { x, y };
      }
    }
    // queued / in-flight move lines
    for (const t of F.ui.moveLines || []) {
      if (t.who !== id) continue;
      const from = calc || gh; if (!from) continue;
      const [x, y] = g.px(t.target[0], t.target[1]);
      ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = t.queued ? 'rgba(243,214,140,0.9)' : 'rgba(243,214,140,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(x, y, s * 0.3, 0, 7); ctx.moveTo(x - s * 0.45, y); ctx.lineTo(x + s * 0.45, y); ctx.moveTo(x, y - s * 0.45); ctx.lineTo(x, y + s * 0.45); ctx.stroke();
      ctx.restore();
    }
    if (calc && gh && (Math.abs(calc.x - gh.x) > 1 || Math.abs(calc.y - gh.y) > 1)) {
      ctx.save(); ctx.strokeStyle = 'rgba(243,214,140,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gh.x, gh.y); ctx.lineTo(calc.x, calc.y); ctx.stroke(); ctx.restore();
    }
    if (gh) {
      ctx.save(); ctx.globalAlpha = gh.alpha * (calc && (Math.abs(calc.x - gh.x) > 1 || Math.abs(calc.y - gh.y) > 1) ? 0.7 : 1);
      droneShape(ctx, gh.x, gh.y + s * 0.05, s * 0.5); ctx.fillStyle = COL.drone; ctx.fill(); ctx.restore();
      label(ctx, gh.x, gh.y + s * 0.12, id, '#2a2000', s * 0.8);
    }
    if (calc) {
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = COL.drone; ctx.lineWidth = 1.6;
      droneShape(ctx, calc.x, calc.y + s * 0.05, s * 0.62); ctx.stroke(); ctx.restore();
    }
    if (F.ui.selected === id) {
      const c = calc || gh; if (c) { ctx.save(); ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(T / 200); ctx.beginPath(); ctx.arc(c.x, c.y, s * 0.85, 0, 7); ctx.stroke(); ctx.restore(); }
    }
  }

  // ---------- home ----------
  {
    const [x, y] = g.px(0, 0);
    ctx.save();
    const gr = ctx.createRadialGradient(x, y, 0, x, y, s * 1.3);
    gr.addColorStop(0, 'rgba(255,243,214,0.55)'); gr.addColorStop(1, 'rgba(255,243,214,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, s * 1.3, 0, 7); ctx.fill();
    ctx.fillStyle = COL.home; ctx.beginPath(); ctx.arc(x, y, s * 0.3, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,243,214,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, 7); ctx.stroke();
    if (F.ui.selected === 'HOME') { ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(T / 200); ctx.beginPath(); ctx.arc(x, y, s * 0.85, 0, 7); ctx.stroke(); }
    ctx.restore();
  }

  // ---------- tags ----------
  const fsz = Math.max(10, Math.min(12, s * 0.46));
  const stack = {};
  for (const tg of F.ui.tags || []) {
    const k = tg.pos.join(',');
    const i = stack[k] = (stack[k] || 0) + 1;
    const [x, y] = g.px(tg.pos[0], tg.pos[1]);
    pill(ctx, x, y + s * (0.95 + 0.62 * (i - 1)) * (tg.up ? -1 : 1), tg.text, tg.color || COL.drone, tg.queued ? 1 : 0.75, fsz);
  }
}

function drawWorld(ctx, g, F, vt) {
  const fin = F.fin, W = FIN.W, s = g.size, T = F.clock || 0, seen = F.mode === 'seen';
  const [x, y] = g.px(W[0], W[1]);
  const lag = seen ? FIN.WR : 0;
  const n = F.now;
  // leak halo: every year from true 1
  if (n - lag >= 1) {
    ctx.save(); ctx.globalAlpha = 0.25 + 0.2 * Math.sin(T / 90) * Math.sin(T / 370);
    ctx.strokeStyle = COL.world; ctx.lineWidth = 1; ctx.setLineDash([1, 3]);
    ctx.beginPath(); ctx.arc(x, y, s * 0.95, 0, 7); ctx.stroke(); ctx.restore();
  }
  const gr = ctx.createRadialGradient(x - s * 0.15, y - s * 0.15, s * 0.05, x, y, s * 0.6);
  gr.addColorStop(0, '#e6f3ff'); gr.addColorStop(0.6, COL.world); gr.addColorStop(1, '#3a6aa8');
  ctx.save(); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, s * 0.52, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(200,230,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, s * 0.68, 0, 7); ctx.stroke(); ctx.restore();
  // call this year
  if (fin.calls.includes(n - lag)) {
    const ph = (T % 1600) / 1600;
    ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 1 - ph; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, s * (0.6 + ph * 0.9), 0, 7); ctx.stroke(); ctx.restore();
    blips(ctx, x, y - s * 1.15, [2, 3, 5, 7], '#ffffff', s, T);
  }
  if (FIN.NOTYET.includes(n - lag)) {
    const ph = ((T + 800) % 2000) / 2000;
    ctx.save(); ctx.strokeStyle = COL.amber; ctx.globalAlpha = (1 - ph) * 0.8; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, s * (0.55 + ph * 0.6), 0, 7); ctx.stroke(); ctx.restore();
    pill(ctx, x - s * 1.6, y + s * 1.0, 'NOT YET', COL.amber, 0.9, Math.max(9, Math.min(11, s * 0.5)));
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
    }
  }
  label(ctx, x, y + s * 1.05, 'W', COL.world, s * 0.9);
}

function blips(ctx, x, y, groups, color, s, T) {
  const total = groups.reduce((a, b) => a + b, 0) + groups.length - 1;
  const w = s * 0.14; let i = 0;
  ctx.save(); ctx.fillStyle = color;
  const lit = Math.floor((T / 90) % (total + 8));
  for (let gi = 0; gi < groups.length; gi++) {
    for (let k = 0; k < groups[gi]; k++) { ctx.globalAlpha = i <= lit ? 0.95 : 0.2; ctx.fillRect(x - total * w / 2 + i * w, y, w * 0.6, w * 1.6); i++; }
    i++;
  }
  ctx.restore();
}

function label(ctx, x, y, text, color, s) {
  ctx.save(); ctx.font = `700 ${Math.max(9, Math.min(14, s * 0.5))}px system-ui, sans-serif`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5); ctx.restore();
}
function badge(ctx, x, y, ch, color, s) {
  ctx.save(); ctx.fillStyle = 'rgba(5,10,23,0.9)'; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, s * 0.26, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.font = `800 ${Math.max(9, s * 0.34)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, x, y + 0.5); ctx.restore();
}
function needDots(ctx, x, y, n, s) {
  ctx.save(); ctx.fillStyle = COL.relay;
  for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x + (i - (n - 1) / 2) * s * 0.2, y, s * 0.06, 0, 7); ctx.fill(); }
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
