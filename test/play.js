// Plays every level through the real game code (via the test hook) in headless
// Chrome, using levels.json test plans, and all three finale endings.
// Run: node test/play.js
const path = require('path');
const { launch } = require('./cdp.js');
const url = 'file://' + path.join(__dirname, '..', 'lightlag.html');
const expect = {
  0: { 'no order': null, 'reference: send A at y0': 9, 'late order (y3)': 12, 'wrong hex, then the mark (y1)': 10 },
  1: { 'naive: aim at what you see': null, 'naive, then corrected at y2': 9, 'reference: wait for projection': 11, 'second chance only (D2)': 25 },
  2: { 'naive: aim at what you see (y5)': null, reference: 16 },
  3: { 'naive: flash both now': null, reference: 10 },
  4: { 'naive: flash all at y5': null, 'reference (sends after projection)': 14 },
  5: { 'naive: ask both at once': null, 'wrong order': null, reference: 7 },
  6: { 'naive: both drones now': null, 'Home asks both, P first': null, 'Home asks both, Q first': null, 'one drone does both': null, reference: 8, 'alt: drone + Home': 9 },
  7: { 'naive: all three now': null, 'solve P,Q,R but miss the split': null, reference: 15 },
};
(async () => {
  const B = await launch({ w: 390, h: 844 });
  let fails = 0;
  const ok = (c, m) => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + m); };
  await B.goto(url);
  // noGuide: L0 plays as a free level, so its test plans run through the real game
  await B.eval(`__LL.G.save.tutorialDone = true; __LL.G.noGuide = true; __LL.hideOverlay(); 1`);
  for (const [n, plans] of Object.entries(expect)) {
    for (const [label, want] of Object.entries(plans)) {
      const got = await B.eval(`(() => {
        const L = __LL; L.hideOverlay(); L.loadLevel(${n});
        const plan = L.G.L.test_plans[${JSON.stringify(label)}];
        let won = null;
        for (let y = 0; y < 40 && !L.G.won; y++) {
          for (const [t, kind, who, arg] of plan) if (t === L.G.now) {
            if (kind === 'MOVE') L.queueMove(who, arg); else if (kind === 'FLASH') L.queueFlash(who, arg); else if (kind === 'PING') L.queueFlash('HOME', arg);
          }
          L.advance(); L.G.p = 1;
          if (L.G.won && won === null) won = L.G.now;
        }
        const offers = L.G.logs.filter(l => l.action).map(l => l.action.label);
        return { won, offers };
      })()`);
      ok(got.won === want, `L${n} ${label}: confirmed ${got.won} (want ${want})${got.offers.length ? ' | smart rewind offered: ' + got.offers.join(', ') : ''}`);
    }
  }
  // finale endings
  const fin = async (label, orders, wantEnding, wantYear) => {
    const r = await B.eval(`(async () => {
      const L = __LL; L.hideOverlay(); L.loadLevel(8);
      for (let i = 0; i < 3; i++) document.getElementById('primary').click();
      const orders = ${JSON.stringify(orders)};
      for (let y = 0; y < 40 && !L.G.won && !L.G.locked; y++) {
        for (const [t, kind, who, arg] of orders) if (t === L.G.now) {
          if (kind === 'PING') L.G.queue.push({ kind, who, arg }); else if (kind === 'FLASH') L.queueFlash(who, arg); else L.G.queue.push({ kind, who, arg });
        }
        const lab = document.getElementById('primary').textContent;
        if (L.G.now === 12 && !window.__lab12) window.__lab12 = lab;
        L.advance(); L.G.p = 1;
      }
      // hold sequence auto-advances on timers
      for (let i = 0; i < 80 && !L.G.won; i++) await new Promise(r => setTimeout(r, 100));
      const ends = L.G.save.endingsFound.slice();
      return { won: L.G.won, now: L.G.now, ends, lab12: window.__lab12, labNow: document.getElementById('primary').textContent };
    })()`);
    ok(r.won && r.ends.includes(wantEnding) && r.now === wantYear, `finale ${label}: ending ${r.ends.join('/')} at yr ${r.now} (want ${wantEnding} @ ${wantYear}); label@12 "${r.lab12}"`);
    await B.eval('window.__lab12 = null; 1');
    await B.sleep(2600);
    const ov = await B.eval(`document.getElementById('overlay').innerText.slice(0, 120)`);
    console.log('     overlay:', JSON.stringify(ov));
  };
  await fin('Answer (home, y10)', [[10, 'PING', 'HOME', 'W']], 'answer', 21);
  await fin('Answer via drone ASK (y12)', [[12, 'FLASH', 'V', 'W']], 'answer', 23);
  await fin('Delegate (y11)', [[11, 'STANDING', 'V', null]], 'delegate', 27);
  await fin('Hold', [], 'hold', 30);
  // storage blocked
  const B2 = await launch({ w: 360, h: 640 });
  await B2.send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });` });
  await B2.goto(url);
  const alive = await B2.eval(`typeof __LL === 'object' && !document.getElementById('overlay').classList.contains('hidden') && __LL.G.L !== null`);
  ok(alive, 'boots with localStorage blocked');
  ok(!B2.logs.some((l) => l.startsWith('EXCEPTION')), 'no exceptions with storage blocked');
  await B2.close();
  console.log(B.logs.filter((l) => l.startsWith('EXCEPTION') || l.startsWith('error')).join('\n'));
  ok(!B.logs.some((l) => l.startsWith('EXCEPTION') || l.startsWith('error')), 'no console errors');
  ok(B.reqs.filter((u) => !u.startsWith('file:') && !u.startsWith('data:')).length === 0, 'no network requests');
  await B.close();
  console.log(fails ? `${fails} FAILED` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
