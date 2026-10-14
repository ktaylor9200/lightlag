// Smoke test in a 390x844 phone viewport: boots, plays L1 tutorial by real taps,
// takes screenshots. Run: node test/smoke.js [outdir]
const path = require('path');
const fs = require('fs');
const { launch } = require('./cdp.js');
const out = process.argv[2] || path.join(process.env.TMPDIR || '/tmp', 'll-shots');
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.join(__dirname, '..', 'lightlag.html');

(async () => {
  const B = await launch({ w: 360, h: 740 });
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
  try {
    await B.goto(url);
    await B.shot(path.join(out, '01-opening.png'));
    // tap through opening cards
    for (let i = 0; i < 3; i++) await B.tap(180, 370);
    await B.sleep(300);
    await B.shot(path.join(out, '02-title.png'));
    const r = await B.eval(`(() => { const b = document.getElementById('tPlay').getBoundingClientRect(); return [b.x + b.width/2, b.y + b.height/2]; })()`);
    await B.tap(r[0], r[1]);
    await B.sleep(400);
    await B.shot(path.join(out, '03-L1.png'));
    // tutorial: tap drone A, tap D1's seen hex, transmit, wait
    const hexPx = (q, rr) => B.eval(`(() => { const g = __LL.geomOf(); const c = document.getElementById('board').getBoundingClientRect(); const p = g.px(${q}, ${rr}); return [c.x + p[0], c.y + p[1]]; })()`);
    let p = await hexPx(-1, 1); await B.tap(p[0], p[1]);
    ok(await B.eval('__LL.G.sel') === 'A', 'tap selects drone A');
    p = await hexPx(2, -4); await B.tap(p[0], p[1]);
    ok(await B.eval('__LL.G.queue.length') === 1, 'tap derelict queues a MOVE');
    await B.shot(path.join(out, '04-L1-queued.png'));
    const prim = await B.eval(`(() => { const b = document.getElementById('primary').getBoundingClientRect(); return [b.x + b.width/2, b.y + b.height/2]; })()`);
    await B.tap(prim[0], prim[1]); await B.sleep(500);
    ok(await B.eval('__LL.G.now') === 1, 'transmit advances to year 1');
    await B.tap(prim[0], prim[1]); await B.sleep(500);
    ok(await B.eval('__LL.G.now') === 2 && await B.eval('__LL.G.tut') === 4, 'year 2: projection unlock step');
    await B.shot(path.join(out, '05-L1-y2-projection.png'));
    // dismiss coach, re-aim A to (2,-1)
    await B.eval(`document.getElementById('coach').click()`);
    p = await hexPx(-1, 1);
    // drone has moved maybe; select via calculated pos
    const calc = await B.eval(`__LL.G.res.hist['drone:A'][__LL.G.now]`);
    p = await hexPx(calc[0], calc[1]); await B.tap(p[0], p[1]);
    ok(await B.eval('__LL.G.sel') === 'A', 'reselect A');
    p = await hexPx(2, -1); await B.tap(p[0], p[1]);
    await B.shot(path.join(out, '06-L1-reaim.png'));
    for (let i = 0; i < 7; i++) { await B.tap(prim[0], prim[1]); await B.sleep(450); }
    ok(await B.eval('__LL.G.won') === true, 'L1 won by y9 (naive + re-aim)');
    await B.sleep(1800);
    await B.shot(path.join(out, '07-L1-win.png'));
    await B.sleep(4000);
    await B.shot(path.join(out, '08-L1-replay.png'));
    console.log('requests:', B.reqs.filter((u) => !u.startsWith('file:')).join(', ') || 'none');
    ok(B.reqs.filter((u) => !u.startsWith('file:') && !u.startsWith('data:')).length === 0, 'no network requests');
    console.log(B.logs.join('\n'));
    ok(!B.logs.some((l) => l.startsWith('EXCEPTION') || l.startsWith('error')), 'no console errors');
  } catch (e) { console.log('ERROR', e.message); fails.push(e.message); console.log(B.logs.join('\n')); }
  await B.close();
  console.log(fails.length ? `${fails.length} FAILED` : 'ALL OK', '->', out);
  process.exit(fails.length ? 1 : 0);
})();
