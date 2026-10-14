// LIGHT LAG — finale (Act III) timeline. Pure: derived from the sim result of
// the finale level + the committed plan. W reacts only to what reaches it.
const FIN = (() => {
  const S = (typeof SIM !== 'undefined') ? SIM : require('./sim.js');
  const W = [5, -3], WR = 5;
  const CALLS = [5, 7, 9, 11, 13, 15, 17, 19];
  const NOTYET = [8, 11, 14, 17, 20, 23, 26];
  const PROBE_LAUNCH = 22, HOLD_AT = 25, HOLD_END = 30;

  function decisive(plan) {
    return plan.filter((o) => (o.kind === 'PING' && o.arg === 'W') || (o.kind === 'FLASH' && o.arg === 'W') || o.kind === 'STANDING');
  }
  function analyse(level, plan, res) {
    res = res || S.simulate(level, plan, 70);
    // first answer to physically reach W
    let first = null;
    for (const p of res.pulses) {
      if (p.kind !== 'signal' || p.to !== 'W') continue;
      const arrive = p.t + S.dist(p.src, W);
      if (!first || arrive < first.arrive) first = { arrive, p };
    }
    const A = first ? first.arrive : null;
    const kind = !first ? null : first.p.standing ? 'delegate' : 'answer';
    const calls = CALLS.filter((c) => A === null || c < A);
    const probe = A === null || A > PROBE_LAUNCH;
    let endSeen = null, replyEmit = null, forward = null;
    if (A !== null) {
      replyEmit = A + 1;
      if (kind === 'answer') endSeen = replyEmit + WR;
      else {
        const vpos = res.hist['drone:' + first.p.from][replyEmit] || first.p.src;
        const rx = replyEmit + S.dist(W, vpos);
        forward = { t: rx, pos: vpos };
        endSeen = rx + S.ring(vpos);
      }
    }
    const dec = decisive(plan);
    const sentYear = dec.length ? Math.min(...dec.map((o) => o.t)) : null;
    // standing: when Home calculates the order reached V (V's dashed outline vanishes)
    const st = res.events.find((e) => e.type === 'standing');
    return { A, kind, calls, probe, replyEmit, endSeen, forward, sentYear, standingAt: st ? st.t : null, standingSeen: st ? S.seenTick(st) : null, first };
  }
  // where their probe truly is at year t (null before launch)
  function probePos(t) {
    if (t < PROBE_LAUNCH) return null;
    const path = S.path(W, [0, 0]);
    const k = Math.min(path.length - 1, Math.floor((t - PROBE_LAUNCH) / 2));
    return path[k];
  }
  function probeSeen(now) {
    let best = null;
    for (let t = PROBE_LAUNCH; t <= now; t++) { const p = probePos(t); if (t + S.ring(p) <= now) best = [t, p]; }
    return best;
  }
  return { W, WR, CALLS, NOTYET, PROBE_LAUNCH, HOLD_AT, HOLD_END, analyse, decisive, probePos, probeSeen };
})();
if (typeof module !== 'undefined') module.exports = FIN;
