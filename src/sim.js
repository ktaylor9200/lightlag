// LIGHT LAG — rules simulator. Faithful port of reference/sim.py, plus two
// finale-only extensions (STANDING orders and the independent drone's own
// answer). Pure functions; no DOM. Shared by the game and the node tests.
const SIM = (() => {
  const DIRS = { E: [1, 0], NE: [1, -1], NW: [0, -1], W: [-1, 0], SW: [-1, 1], SE: [0, 1] };
  const HOME = [0, 0];
  const DRONE_STEP = 2;

  const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
  function dist(a, b) {
    const dq = a[0] - b[0], dr = a[1] - b[1];
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
  }
  const ring = (p) => dist(p, HOME);
  // Python's round(): half to even
  function pyRound(x) {
    const f = Math.floor(x), d = x - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
  }
  function cubeRound(x, y, z) {
    let rx = pyRound(x), ry = pyRound(y), rz = pyRound(z);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    return [rx + 0, rz + 0];
  }
  function stepToward(a, b) {
    const n = dist(a, b);
    if (n === 0) return a;
    const ax = a[0] + 1e-6, az = a[1] + 2e-6, ay = -ax - az;
    const bx = b[0] + 1e-6, bz = b[1] + 2e-6, by = -bx - bz;
    const t = 1.0 / n;
    return cubeRound(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t);
  }
  function path(a, b) {
    const out = [a];
    while (!eq(out[out.length - 1], b)) out.push(stepToward(out[out.length - 1], b));
    return out;
  }

  // plan: array of {t, kind, who, arg} or [t, kind, who, arg]
  //   MOVE who=drone arg=[q,r] · FLASH who=drone arg=null|watcherId
  //   PING who='HOME' arg=watcherId · STANDING who=drone (finale)
  function simulate(level, planIn, T = 80) {
    const R = level.R;
    const plan = (planIn || []).map((x) => Array.isArray(x) ? { t: x[0], kind: x[1], who: x[2], arg: x[3] } : x);
    const drones = Object.entries(level.drones || {}).map(([k, v]) => ({ id: k, pos: [v[0], v[1]], target: null, next: null, indep: null, arrivedAt: null }));
    const D = Object.fromEntries(drones.map((d) => [d.id, d]));
    const ders = (level.derelicts || []).map((d) => ({ id: d.id, pos: [d.pos[0], d.pos[1]], dir: DIRS[d.dir], p: d.period, next: d.first, gone: false, tagged: null, entered: ring(d.pos) <= R }));
    const recs = (level.receivers || []).map((r) => Object.assign({}, r, { active: null }));
    const wat = (level.watchers || []).map((w) => ({ id: w.id, pos: [w.pos[0], w.pos[1]], kind: w.kind, signed: null, offended: null, born: 0, split: w.split || null, hidden: !!w.hidden }));
    const W = Object.fromEntries(wat.map((w) => [w.id, w]));
    const pulses = [], events = [], arrivals = [], received = new Set(), hist = {};
    const planned = {};
    for (const o of plan) (planned[o.t] = planned[o.t] || []).push(o);

    const derById = Object.fromEntries(ders.map((d) => [d.id, d]));
    const recPos = (r) => {
      if (r.cell) return r.cell;
      const d = derById[r.ride];
      return d.gone ? null : d.pos;
    };
    const H = (key) => (hist[key] = hist[key] || {});
    function record(t) {
      for (const d of drones) H('drone:' + d.id)[t] = d.pos;
      for (const d of ders) if (!d.gone && ring(d.pos) <= R) H('der:' + d.id)[t] = d.pos;
      for (const w of wat) if (w.born <= t) H('wat:' + w.id)[t] = w.pos;
    }
    function emitHome(t) {
      for (const o of planned[t] || []) {
        if (o.kind === 'MOVE' || o.kind === 'FLASH' || o.kind === 'STANDING') {
          pulses.push({ src: HOME, t, kind: 'order', to: o.who, payload: [o.kind, o.arg], sent: t, from: 'HOME' });
        } else if (o.kind === 'PING') {
          pulses.push({ src: HOME, t, kind: 'signal', to: o.arg, payload: 'HOME', sent: t, from: 'HOME' });
          events.push({ t, pos: HOME, type: 'flash', data: ['HOME', o.arg], sent: t });
        }
      }
    }
    function arrivalsAt(t) {
      const sigAtRec = {}, watIn = {};
      let changed = true;
      while (changed) {
        changed = false;
        const targets = [];
        for (const d of drones) targets.push(['drone', d.id, d.pos]);
        for (const w of wat) if (w.born <= t) targets.push(['wat', w.id, w.pos]);
        for (const r of recs) { const p = recPos(r); if (p) targets.push(['rec', r.id, p]); }
        const snap = pulses.slice();
        for (let i = 0; i < snap.length; i++) {
          const p = snap[i];
          if (p.t > t) continue;
          for (const [typ, k, pos] of targets) {
            const key = i + '|' + typ + '|' + k;
            if (received.has(key)) continue;
            if (t - p.t >= dist(p.src, pos)) {
              received.add(key);
              if (typ === 'wat' && p.t + dist(p.src, pos) < W[k].born) continue;
              changed = true;
              arrivals.push({ i, typ, k, t });
              if (typ === 'drone' && p.kind === 'order' && p.to === k) {
                const [kind, arg] = p.payload; const d = D[k];
                if (d.indep !== null) { events.push({ t, pos: d.pos, type: 'declined', data: [k, kind], sent: p.sent }); continue; }
                events.push({ t, pos: d.pos, type: 'order_rx', data: [k, kind], sent: p.sent });
                if (kind === 'FLASH') {
                  pulses.push({ src: d.pos, t, kind: 'signal', to: arg, payload: k, sent: p.sent, from: k });
                  events.push({ t, pos: d.pos, type: 'flash', data: [k, arg], sent: p.sent });
                } else if (kind === 'STANDING') {
                  d.indep = t; d.target = level.standing.target; d.next = t + DRONE_STEP;
                  events.push({ t, pos: d.pos, type: 'standing', data: [k], sent: p.sent });
                  if (eq(d.pos, d.target)) { d.target = null; d.arrivedAt = t; }
                } else {
                  d.target = arg; d.next = t + DRONE_STEP;
                }
              } else if (typ === 'rec' && p.kind === 'signal' && p.to === null) {
                (sigAtRec[k] = sigAtRec[k] || []).push(i);
              } else if (typ === 'wat') {
                (watIn[k] = watIn[k] || []).push(p);
              }
            }
          }
        }
      }
      for (const r of recs) {
        const lst = sigAtRec[r.id];
        if (lst && r.active === null && lst.length >= r.need) { r.active = t; events.push({ t, pos: recPos(r), type: 'rec_on', data: r.id }); }
      }
      for (const w of wat) {
        const plist = watIn[w.id];
        if (!plist) continue;
        events.push({ t, pos: w.pos, type: 'glint', data: w.id });
        if ((w.kind !== 'sign' && w.kind !== 'precedent') || w.signed !== null || w.offended !== null) continue;
        const mine = plist.filter((p) => p.kind === 'signal' && p.to === w.id);
        const others = plist.filter((p) => p.kind === 'signal' && p.to !== null && p.to !== w.id);
        if (w.kind === 'precedent' && others.length) {
          w.offended = t;
          events.push({ t, pos: w.pos, type: 'offended', data: w.id, cause: others.map((p) => p.sent), tie: mine.length > 0 });
        } else if (mine.length) {
          w.signed = t; events.push({ t, pos: w.pos, type: 'sign', data: w.id });
        }
      }
    }

    // Prehistory
    for (let tau = -3 * R; tau < 0; tau++) {
      for (const d of drones) H('drone:' + d.id)[tau] = d.pos;
      for (const w of wat) H('wat:' + w.id)[tau] = w.pos;
      for (const d of ders) {
        let steps = 0;
        for (let s = d.next - d.p; s > tau; s -= d.p) if (s <= 0) steps++;
        const pos = [d.pos[0] - d.dir[0] * steps, d.pos[1] - d.dir[1] * steps];
        if (ring(pos) <= R) H('der:' + d.id)[tau] = pos;
      }
    }
    record(0); emitHome(0); arrivalsAt(0);
    for (let t = 1; t <= T; t++) {
      const prev = Object.fromEntries(drones.map((d) => [d.id, d.pos]));
      const prevd = Object.fromEntries(ders.map((d) => [d.id, d.pos]));
      for (const d of ders) {
        if (!d.gone && d.next === t) {
          d.pos = [d.pos[0] + d.dir[0], d.pos[1] + d.dir[1]]; d.next += d.p;
          if (ring(d.pos) <= R) d.entered = true;
          else if (d.entered) { d.gone = true; events.push({ t, pos: prevd[d.id], type: 'exit', data: d.id }); }
        }
      }
      for (const d of drones) {
        if (d.target !== null && d.next === t) {
          d.pos = stepToward(d.pos, d.target); d.next += DRONE_STEP;
          if (eq(d.pos, d.target)) { d.target = null; if (d.indep !== null) d.arrivedAt = t; }
        }
      }
      for (const w of wat.slice()) {
        const s = w.split;
        if (s && s.tick === t) {
          const c = { id: s.id, pos: s.pos, kind: s.kind, signed: null, offended: null, born: t, split: null, hidden: false, parent: w.id };
          wat.push(c); W[c.id] = c;
          events.push({ t, pos: s.pos, type: 'split', data: [w.id, s.id] });
        }
      }
      // finale: an independent drone answers after listening
      for (const d of drones) {
        if (d.indep !== null && d.arrivedAt !== null && level.standing && t === d.arrivedAt + level.standing.listen) {
          pulses.push({ src: d.pos, t, kind: 'signal', to: level.standing.to, payload: d.id, sent: null, from: d.id, standing: true });
          events.push({ t, pos: d.pos, type: 'flash', data: [d.id, level.standing.to], standing: true });
        }
      }
      emitHome(t); arrivalsAt(t);
      for (const d of ders) {
        if (d.gone || d.tagged !== null) continue;
        for (const dr of drones) {
          if (eq(dr.pos, d.pos) || (eq(dr.pos, prevd[d.id]) && eq(prev[dr.id], d.pos))) {
            d.tagged = t; events.push({ t, pos: d.pos, type: 'tag', data: [d.id, dr.id] }); break;
          }
        }
      }
      record(t);
    }
    return { events, arrivals, pulses, hist, drones, ders, recs, wat };
  }

  const seenTick = (ev) => ev.t + ring(ev.pos);

  const sortedTicks = (h) => h.__ticks || Object.defineProperty(h, '__ticks', { value: Object.keys(h).map(Number).sort((a, b) => a - b) }).__ticks;
  function seenPos(h, now) {
    if (!h) return null;
    let best = null;
    for (const tau of sortedTicks(h)) if (tau + ring(h[tau]) <= now) best = tau;
    return best === null ? null : [best, h[best]];
  }

  function outcome(level, plan, T = 80, res) {
    res = res || simulate(level, plan, T);
    const ev = res.events, obj = level.objective, req = [];
    if (obj.type === 'tag_any') {
      const e = ev.filter((x) => x.type === 'tag');
      if (!e.length) return null;
      req.push(e.reduce((a, b) => (seenTick(b) < seenTick(a) ? b : a)));
    } else if (obj.type === 'tag') {
      for (const id of obj.ids) {
        const e = ev.find((x) => x.type === 'tag' && x.data[0] === id);
        if (!e) return null; req.push(e);
      }
    } else if (obj.type === 'rec') {
      const e = ev.find((x) => x.type === 'rec_on' && x.data === obj.id);
      if (!e) return null; req.push(e);
    } else if (obj.type === 'sign') {
      for (const w of res.wat) {
        if (w.kind === 'sign' || w.kind === 'precedent') {
          const e = ev.find((x) => x.type === 'sign' && x.data === w.id);
          if (!e) return null; req.push(e);
        }
      }
    } else return null;
    const last = req.reduce((a, b) => (seenTick(b) > seenTick(a) ? b : a));
    return { confirmed_at_home: seenTick(last), happened_at: last.t, lag: seenTick(last) - last.t, req };
  }

  function firstSeenMove(level, derId, horizon = 60) {
    const res = simulate(level, [], horizon);
    const h = res.hist['der:' + derId] || {};
    let first = null;
    for (let n = 0; n < horizon; n++) {
      const s = seenPos(h, n);
      if (!s) continue;
      if (first === null) first = s[1];
      else if (!eq(s[1], first)) return n;
    }
    return null;
  }

  return { DIRS, HOME, DRONE_STEP, eq, dist, ring, stepToward, path, simulate, seenTick, seenPos, outcome, firstSeenMove };
})();
if (typeof module !== 'undefined') module.exports = SIM;
