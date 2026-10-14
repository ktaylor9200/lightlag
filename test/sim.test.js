// Checks the JS sim against reference/verify-report.txt. Run: node test/sim.test.js
const fs = require('fs');
const path = require('path');
const SIM = require('../src/sim.js');
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'reference/levels.json'), 'utf8'));
const report = fs.readFileSync(path.join(root, 'reference/verify-report.txt'), 'utf8').split('\n');

const expected = {}; let cur = null;
for (const line of report) {
  const lv = line.match(/^(\d+) /); if (lv) { cur = +lv[1]; expected[cur] = { plans: {}, unlock: {} }; continue; }
  const u = line.match(/projection for (\S+) unlocks at Home year (\d+)/); if (u) { expected[cur].unlock[u[1]] = +u[2]; continue; }
  const p = line.match(/^  (.+?)\s+-> (None|\{.*?\})(\s+\|.*)?$/);
  if (p) {
    let v = null;
    if (p[2] !== 'None') { const m = p[2].match(/'confirmed_at_home': (\d+), 'happened_at': (\d+), 'lag': (\d+)/); v = { c: +m[1], h: +m[2], l: +m[3] }; }
    const g = p[3] ? p[3].match(/\[(.*)\]/)[1].split(',').map((s) => +s.trim()) : null;
    expected[cur].plans[p[1].trim()] = { v, g };
  }
}
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
for (const lv of data.levels) {
  const ex = expected[lv.n];
  for (const d of lv.derelicts || []) ok(SIM.firstSeenMove(lv, d.id) === ex.unlock[d.id], `L${lv.n} unlock ${d.id}: ${SIM.firstSeenMove(lv, d.id)} vs ${ex.unlock[d.id]}`);
  for (const [label, plan] of Object.entries(lv.test_plans)) {
    const res = SIM.simulate(lv, plan, 80);
    const o = SIM.outcome(lv, plan, 80, res);
    const e = ex.plans[label];
    ok(e !== undefined, `L${lv.n} missing expected for ${label}`);
    if (!e) continue;
    const got = o ? { c: o.confirmed_at_home, h: o.happened_at, l: o.lag } : null;
    ok(JSON.stringify(got) === JSON.stringify(e.v), `L${lv.n} ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(e.v)}`);
    const gl = [...new Set(res.events.filter((x) => x.type === 'glint' && x.data.startsWith('m')).map(SIM.seenTick))].sort((a, b) => a - b).slice(0, 6);
    if (e.g) ok(JSON.stringify(gl) === JSON.stringify(e.g), `L${lv.n} ${label} glints ${gl} vs ${e.g}`);
  }
}
// apparent speed: L2 D1 inbound should appear to jump at 2-yr intervals
const l2 = data.levels[1]; const r2 = SIM.simulate(l2, [], 40);
const seen = []; let last = null;
for (let n = 0; n < 20; n++) { const s = SIM.seenPos(r2.hist['der:D1'], n); if (s && (!last || !SIM.eq(s[1], last))) { seen.push(n); last = s[1]; } }
console.log('L2 D1 seen-change years:', seen.join(','));
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
