// L0 "First Light": the guided tutorial, by real taps, at three phone sizes.
// Checks A-J of BRIEF-L0.md §7.2 and saves the §7.3 screenshots.
// Run: node test/l0.js [outdir]
const path = require('path');
const fs = require('fs');
const { launch } = require('./cdp.js');
const out = process.argv[2] || path.join(process.env.TMPDIR || '/tmp', 'll-l0');
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.join(__dirname, '..', 'lightlag.html');

// the copy the guide must show (BRIEF-L0.md §3)
const COPY = {
  g1: "Home. You're at the centre. Light, and every order you send, goes out one ring a year.",
  g2: 'Old light. Light from A takes two years to reach you, so you see A as it was two years ago.',
  g3: 'Tap your drone, A.',
  g4: 'Solid means seen. Tap the mark to send A there.',
  ask1: 'Your order travels at light speed. When does A get it?',
  no1: 'Year 2. Ring 2 is two years out, for orders too. Now TRANSMIT.',
  yes1: 'Yes. Ring 2: two years. Now TRANSMIT.',
  ask2: 'A is there. When will Home see it?',
  yes2: 'Yes. Ring 3: three years home. WAIT and watch it come.',
  no2: 'Year 9. The news has three rings to cross. WAIT and watch it come.',
  1: 'Year 1. The dashed ring is your order, crossing one ring a year. Tap WAIT.',
  2: 'Year 2. The order reaches A. Delay one: two rings, two years.',
  3: 'Year 3. A has its order. Each hex takes it two years: half light speed.',
  4: "Year 4. Dashed A has moved: that's Home's calculation. Solid A is what Home sees, still two years old.",
  5: "Year 5. Home knows A is moving. It hasn't seen it move.",
  6: 'Year 6. A reaches the mark: two hexes, four years. Home is only now seeing it leave.',
  7: 'Year 7. The dashed ring from the mark is the news, coming home a ring a year.',
  8: 'Year 8. A has been there two years. Home still sees it on the way.',
  9: 'Confirmed. It happened in year 6. You found out in year 9.',
};

// as in flows.js: nothing off-screen, buttons >= 44 px, the board never under the dock
const layoutCheck = `(() => {
  const vw = innerWidth, vh = innerHeight, bad = [];
  for (const el of document.querySelectorAll('#app button, #app canvas, #app #log, #dock *')) {
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    const inScroller = el.closest('#outbox, #chips') && el.parentElement && (el.parentElement.id === 'outbox' || el.parentElement.id === 'chips' || el.classList.contains('x'));
    if (!inScroller && (r.right > vw + 0.5 || r.left < -0.5 || r.bottom > vh + 0.5)) bad.push((el.id || el.className || el.tagName) + ' out of viewport ' + JSON.stringify([r.left, r.top, r.right, r.bottom].map(Math.round)));
    if (el.tagName === 'BUTTON' && !el.classList.contains('x') && (r.height < 44 || r.width < 44) && el.id !== 'obj') bad.push((el.id || el.textContent) + ' small target ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  const b = document.getElementById('board').getBoundingClientRect(), d = document.getElementById('dock').getBoundingClientRect();
  if (b.bottom > d.top + 1) bad.push('board overlaps dock');
  return { board: Math.round(b.width), dockTop: Math.round(d.top), bad };
})()`;
// as flows.js's coachClear, for Home, A, the hex A passes and the mark
const coachClear = `(() => { const c = document.getElementById('coach'); if (c.classList.contains('hidden')) return 'coach hidden';
  const cr = c.getBoundingClientRect(), br = document.getElementById('board').getBoundingClientRect(), g = __LL.geomOf();
  const hit = [[0, 0], [1, -2], [2, -2], [3, -2]].filter(([q, r]) => { const p = g.px(q, r), x = br.left + p[0], y = br.top + p[1]; return !(y + g.size < cr.top || y - g.size > cr.bottom || x + g.size < cr.left || x - g.size > cr.right); });
  return hit.length ? 'covers ' + JSON.stringify(hit) + (c.classList.contains('snug') ? ' (snug)' : '') : true; })()`;
const boardPixels = `document.getElementById('board').toDataURL()`;

let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + m); };

function driver(B, w, h) {
  const center = (sel) => B.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  const D = {
    async tapSel(sel) { const p = await center(sel); if (!p) throw new Error('no element ' + sel); await B.tap(p[0], p[1]); },
    async tapHex(q, r) { const p = await B.eval(`(() => { const g = __LL.geomOf(), c = document.getElementById('board').getBoundingClientRect(), p = g.px(${q}, ${r}); return [c.x + p[0], c.y + p[1]]; })()`); await B.tap(p[0], p[1]); },
    async tapChip(text) { const p = await B.eval(`(() => { const e = [...document.querySelectorAll('#chips button')].find((b) => b.textContent === ${JSON.stringify(text)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`); if (!p) throw new Error('no chip ' + text); await B.tap(p[0], p[1]); },
    coach: () => B.eval(`document.getElementById('coach').classList.contains('hidden') ? '' : document.getElementById('coach').textContent`),
    state: () => B.eval(`(() => { const G = __LL.G; return { n: G.n, now: G.now, guide: G.guide, queue: G.queue.length, plan: G.plan.length, won: G.won, sel: G.sel }; })()`),
    // the overlay card: tap high up, clear of the skip button
    tapCard: () => B.tap(w / 2, 70),
    // once a toast has been checked, put it away so it doesn't sit in the next screenshot
    clearToast: () => B.eval(`document.getElementById('toast').classList.add('hidden'); 1`),
    async openingToTitle() { for (let i = 0; i < 3; i++) await B.tap(w / 2, h / 2); await B.sleep(300); },
    async waitRipple(at, cycle) { const el = await B.eval(`(performance.now() - __LL.G.guideT0) % ${cycle}`); await B.sleep((at - el + cycle) % cycle); },
  };
  return D;
}

// The whole guided run by real taps, from the title's BEGIN to the win screen.
// opts: shot(name) to save screenshots, label for messages, restartAt (a year) to check Restart, reduced (static frames)
async function guidedRun(B, w, h, opts = {}) {
  const D = driver(B, w, h), L = opts.label || `${w}x${h}`, S = opts.shot || (async () => {});
  const clear = async (step) => { const c = await B.eval(coachClear); ok(c === true, `${L} C coach clear at ${step}${c === true ? '' : ': ' + c}`); };
  const says = async (step, want) => { const t = await D.coach(); ok(t.includes(want), `${L} B coach at ${step}${t.includes(want) ? '' : ': ' + JSON.stringify(t)}`); };
  const still = async (step) => { const a = await B.eval(boardPixels); await B.sleep(350); const b = await B.eval(boardPixels); ok(a === b, `${L} I static end state at ${step}`); };
  await D.tapSel('#tPlay'); await B.sleep(500);
  // A. entry card
  ok(await B.eval(`!!document.getElementById('l0Skip') && __LL.G.n === 0`), `${L} A BEGIN opens the L0 entry card`);
  const skip = await B.eval(`(() => { const b = document.getElementById('l0Skip').getBoundingClientRect(); return [b.width, b.height, b.bottom <= innerHeight]; })()`);
  ok(skip[1] >= 44 && skip[0] >= 44 && skip[2], `${L} A skip button ${Math.round(skip[0])}x${Math.round(skip[1])} on screen`);
  await D.tapCard(); await B.sleep(900);
  ok(await B.eval(`document.getElementById('overlay').innerText.includes('Light crosses one ring a year')`), `${L} A entry card line 2`);
  await S('01-entry-card');
  await D.tapCard(); await B.sleep(400);
  let st = await D.state();
  ok(st.n === 0 && st.now === 0 && st.guide === 0 && await B.eval(`document.getElementById('overlay').classList.contains('hidden')`), `${L} A G1 at yr 0 (n=${st.n} now=${st.now} guide=${st.guide})`);
  for (let pass = 0; pass < 2; pass++) {
    // G1, G2: tap the coach
    await says('G1', COPY.g1); await clear('G1');
    if (opts.reduced) await still('G1 ripple'); else { await D.waitRipple(2150, 3200); }
    if (!pass) await S('02-G1-ripple-out');
    await D.tapSel('#coach'); await B.sleep(200);
    await says('G2', COPY.g2); await clear('G2');
    if (opts.reduced) await still('G2 ripple'); else { await D.waitRipple(1300, 2400); }
    if (!pass) await S('03-G2-ripple-in');
    await D.tapSel('#coach'); await B.sleep(200);
    // G3: a wrong tap is refused, then A
    await says('G3', COPY.g3); await clear('G3');
    await D.tapHex(-1, -1); await B.sleep(150);
    ok((await D.state()).sel === null && /gold triangle/.test(await B.eval(`document.getElementById('toast').textContent`)), `${L} E G3 wrong tap only toasts`);
    await D.clearToast();
    await D.tapHex(1, -2); await B.sleep(250);
    st = await D.state();
    ok(st.sel === 'A' && st.guide === 3, `${L} B tap A selects it (G4)`);
    // G4: gating, then the mark
    await says('G4', COPY.g4); await clear('G4');
    let lc = await B.eval(layoutCheck); ok(!lc.bad.length, `${L} D layout at G4 board=${lc.board} ${lc.bad.join('; ')}`);
    if (!pass) await S('04-G4-aim');
    ok(await B.eval(`document.getElementById('ff').disabled`), `${L} E until-news disabled`);
    await D.tapSel('#menuBtn'); await B.sleep(300);
    ok(await B.eval(`document.getElementById('mRewind').disabled`), `${L} E menu Rewind disabled`);
    await D.tapSel('#sheetX'); await B.sleep(200);
    await D.tapHex(2, -3); await B.sleep(150);
    st = await D.state();
    ok(st.queue === 0 && st.guide === 3, `${L} E a non-mark hex queues nothing`);
    await D.clearToast();
    await D.tapHex(3, -2); await B.sleep(300);
    // G5: prediction 1
    st = await D.state();
    ok(st.queue === 1 && st.guide === 4, `${L} B the mark queues the order (G5)`);
    ok(/A\s*→ move · arrives yr 6/.test(await B.eval(`document.getElementById('outbox').textContent`)), `${L} B outbox reads "A → move · arrives yr 6"`);
    ok(await B.eval(`!document.querySelector('#outbox .x')`), `${L} E queued order has no ✕`);
    ok(await B.eval(`[...document.querySelectorAll('#chips button')].map((b) => b.textContent).join('|')`) === 'Year 1|Year 2|Year 4', `${L} B prediction 1 chips`);
    ok(await B.eval(`document.getElementById('primary').disabled`), `${L} E primary disabled during prediction 1`);
    await says('G5', COPY.ask1); await clear('G5 prediction');
    lc = await B.eval(layoutCheck); ok(!lc.bad.length, `${L} D layout at G5 ${lc.bad.join('; ')}`);
    if (!pass) await S('05-G5-prediction');
    await D.tapChip('Year 1'); await B.sleep(200);
    // G6: TRANSMIT
    await says('G6', COPY.no1); await clear('G6');
    ok(await B.eval(`!document.getElementById('primary').disabled && document.getElementById('primary').classList.contains('pulse')`), `${L} B TRANSMIT enabled and pulsing`);
    await D.tapSel('#primary'); await B.sleep(500);
    for (let y = 1; y <= 9; y++) {
      st = await D.state();
      ok(st.now === y, `${L} B year ${y} (at ${st.now})`);
      await says(`yr ${y}`, COPY[y]); await clear(`yr ${y}`);
      if (y === 1) {
        if (!pass) await S('06-y1-order-front');
        if (opts.restartAt === 1 && !pass) break;
      }
      if (y === 2 && !pass) await S('07-y2-order-lands');
      if (y === 4) {
        const apart = await B.eval(`(() => { const G = __LL.G, h = G.res.hist['drone:A'], s = __LL.SIM.seenPos(h, G.now); return JSON.stringify([h[G.now], s[1]]); })()`);
        ok(apart === '[[2,-2],[1,-2]]', `${L} B yr 4 dashed A at (2,-2), solid at (1,-2): ${apart}`);
        if (!pass) await S('08-y4-solid-dashed-split');
      }
      if (y === 6) {
        ok(await B.eval(`document.getElementById('primary').disabled`), `${L} B WAIT held until prediction 2`);
        await D.tapSel('#coach'); await B.sleep(250);
        await says('prediction 2', COPY.ask2); await clear('prediction 2');
        ok(await B.eval(`[...document.querySelectorAll('#chips button')].map((b) => b.textContent).join('|')`) === 'Year 6|Year 7|Year 9', `${L} B prediction 2 chips`);
        ok(await B.eval(`document.getElementById('primary').disabled`), `${L} E primary disabled during prediction 2`);
        lc = await B.eval(layoutCheck); ok(!lc.bad.length, `${L} D layout at yr 6 prediction ${lc.bad.join('; ')}`);
        if (!pass) await S('09-y6-prediction-news-start');
        await D.tapChip('Year 9'); await B.sleep(200);
        await says('answer 2', COPY.yes2); await clear('answer 2');
      }
      if (y === 7) { if (opts.reduced) await still('yr 7 news front'); if (!pass) await S('10-y7-news-front'); }
      if (y === 9) break;
      if (y === 2) {
        await D.tapHex(-1, -1); await B.sleep(100);
        ok(/Tap WAIT/.test(await B.eval(`document.getElementById('toast').textContent`)) && (await D.state()).sel === null, `${L} E board tap during WAIT only toasts`);
        await D.clearToast();
        for (const key of ['Backspace', 'z']) await B.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}' })); 1`);
        st = await D.state();
        ok(st.now === 2 && st.plan === 1, `${L} E Backspace / z don't rewind during the guide`);
      }
      await D.tapSel('#primary'); await B.sleep(opts.reduced ? 200 : 520);
    }
    if (opts.restartAt === 1 && !pass) {
      // E. Restart mid-run: back to G1, year 0, nothing sent
      await D.tapSel('#menuBtn'); await B.sleep(300); await D.tapSel('#mRestart'); await B.sleep(300);
      st = await D.state();
      ok(st.guide === 0 && st.now === 0 && st.plan === 0 && st.queue === 0, `${L} E menu Restart returns to G1 at yr 0 with an empty plan`);
      continue;
    }
    break;
  }
  // year 9: confirmed
  const o = await B.eval(`(() => { const G = __LL.G; return { won: G.won, out: G.out && { c: G.out.confirmed_at_home, h: G.out.happened_at, l: G.out.lag }, cleared: G.save.cleared.slice() }; })()`);
  ok(o.won && JSON.stringify(o.out) === '{"c":9,"h":6,"l":3}', `${L} B won at yr 9: ${JSON.stringify(o.out)}`);
  ok(o.cleared.includes(0), `${L} B cleared includes 0`);
  await B.sleep(350); await S('11-y9-confirm');
  await B.sleep(opts.reduced ? 1200 : 2400);
  const win = await B.eval(`(() => { const ov = document.getElementById('overlay'), n = document.getElementById('wNext'); if (!n) return null; const r = n.getBoundingClientRect();
    return { text: ov.innerText, ledger: [...ov.querySelectorAll('.ledger [data-v]')].map((e) => +e.dataset.v), onScreen: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, kicker: ov.querySelector('.kicker').textContent }; })()`);
  ok(!!win, `${L} B win screen shown`);
  if (win) {
    ok(/year 6/.test(win.text) && /year 9/.test(win.text), `${L} B win screen says year 6 and year 9`);
    ok(JSON.stringify(win.ledger) === '[2,4,3]', `${L} B ledger 2/4/3: ${JSON.stringify(win.ledger)}`);
    ok(/Order out\s*2 yrs\s*light speed, ring 2/.test(win.text) && /A flies\s*4 yrs\s*half light speed, 2 hexes/.test(win.text) && /News home\s*3 yrs\s*light speed, ring 3/.test(win.text), `${L} B ledger rows read in full`);
    ok(/^Tutorial · First Light$/i.test(win.kicker), `${L} B win kicker "${win.kicker}"`);
    ok(win.onScreen, `${L} B #wNext fully on screen`);
  }
  await B.sleep(1200); await S('12-win-ledger');
}

(async () => {
  for (const [w, h] of [[390, 844], [360, 640], [360, 560]]) {
    const pre = `${w}x${h}-`;
    const shot = (B) => (name) => B.shot(path.join(out, pre + name + '.png'));
    const allLogs = [], allReqs = [];
    const done = async (B) => { allLogs.push(...B.logs); allReqs.push(...B.reqs); await B.close(); };

    // A, B, C, D, E (gating), F: fresh save, the whole run, then on into L1
    let B = await launch({ w, h });
    await B.goto(url);
    let D = driver(B, w, h);
    await D.openingToTitle();
    ok(await B.eval(`document.getElementById('tPlay').textContent`) === 'BEGIN', `${w}x${h} A fresh title says BEGIN`);
    await guidedRun(B, w, h, { shot: shot(B) });
    // F. Next leads to L1, whose beat no longer auto-plays
    await D.tapSel('#wNext'); await B.sleep(500);
    let st = await D.state();
    ok(st.n === 1 && await B.eval(`__LL.G.tut`) === 0 && (await D.coach()).includes('Tap your drone.'), `${w}x${h} F Next ▸ leads to L1's tutorial coach (n=${st.n})`);
    await D.tapHex(-1, 1); await B.sleep(200); await D.tapHex(2, -4); await B.sleep(300);
    ok(await B.eval(`__LL.G.beat === null && __LL.G.queue.length === 1`), `${w}x${h} F no auto beat after L0`);
    ok((await D.coach()).includes('TRANSMIT. Your order travels at the speed of light.'), `${w}x${h} F straight to the TRANSMIT coach`);
    await shot(B)('13-L1-after-L0');
    await D.tapSel('#primary'); await B.sleep(500); await D.tapSel('#primary'); await B.sleep(500);
    await D.tapSel('#coach'); await B.sleep(200);
    await D.tapSel('#menuBtn'); await B.sleep(300); await D.tapSel('#mScale'); await B.sleep(300);
    ok(await B.eval(`!!document.getElementById('sBeat')`), `${w}x${h} F "Watch an order travel" still offered under How light works`);
    await D.tapSel('#sheetX'); await B.sleep(200);
    // level select: Tutorial row, cleared, and every row reachable
    await D.tapSel('#lvlname'); await B.sleep(400);
    const lv = await B.eval(`(() => { const b = document.querySelector('#sheetBody button[data-n="0"]'); const hd = document.querySelector('.lv .act').textContent; return { hd, dis: b.disabled, done: !!b.querySelector('.done'), text: b.textContent }; })()`);
    ok(lv.hd === 'Tutorial' && !lv.dis && lv.done && /0\s*First Light/.test(lv.text), `${w}x${h} level select: Tutorial · 0 First Light ✓ (${JSON.stringify(lv)})`);
    await shot(B)('14-level-select');
    const reach = await B.eval(`(() => { const sb = document.getElementById('sheetBody'); sb.scrollTop = sb.scrollHeight; const r = document.querySelector('#sheetBody button[data-n="8"]').getBoundingClientRect(), t = document.querySelector('#sheetBody button[data-n="0"]'); sb.scrollTop = 0; const r0 = t.getBoundingClientRect(); return [Math.round(r.bottom), innerHeight, Math.round(r0.top), Math.round(sb.getBoundingClientRect().top)]; })()`);
    ok(reach[0] <= reach[1] && reach[2] >= reach[3] - 1, `${w}x${h} level select scrolls to every row ${JSON.stringify(reach)}`);
    await done(B);

    // G. skip path
    B = await launch({ w, h }); D = driver(B, w, h);
    await B.goto(url); await D.openingToTitle();
    await D.tapSel('#tPlay'); await B.sleep(500);
    await D.tapSel('#l0Skip'); await B.sleep(400);
    ok(await B.eval(`__LL.G.n === 1 && __LL.G.save.l0Skipped === true && document.getElementById('overlay').classList.contains('hidden')`), `${w}x${h} G Skip to Level 1 → L1, l0Skipped`);
    await D.tapHex(-1, 1); await B.sleep(200); await D.tapHex(2, -4); await B.sleep(300);
    ok(await B.eval(`__LL.G.beat !== null`), `${w}x${h} G the beat auto-plays for a player who skipped`);
    await B.goto(url); await B.sleep(300);
    ok(await B.eval(`document.getElementById('tPlay').textContent`) === 'CONTINUE · LEVEL 1', `${w}x${h} G reload → CONTINUE · LEVEL 1`);
    ok(await B.eval(`!!document.getElementById('tLevels')`), `${w}x${h} G title offers Level select with CONTINUE`);
    await done(B);

    // H. veteran saves
    B = await launch({ w, h }); D = driver(B, w, h);
    await B.goto(url);
    await B.eval(`localStorage.setItem('lightlag.v1', JSON.stringify({ reached: 3, cleared: [1, 2], tutorialDone: true, seenOpening: true })); 1`);
    await B.goto(url); await B.sleep(300);
    ok(await B.eval(`document.getElementById('tPlay').textContent`) === 'CONTINUE · LEVEL 3' && await B.eval(`__LL.G.n`) === 3, `${w}x${h} H veteran: CONTINUE · LEVEL 3, no L0`);
    await D.tapSel('#tLevels'); await B.sleep(400);
    ok(await B.eval(`!document.querySelector('#sheetBody button[data-n="0"]').disabled && __LL.G.n === 3`), `${w}x${h} H veteran: level select row 0 enabled`);
    await B.eval(`localStorage.setItem('lightlag.v1', JSON.stringify({ reached: 1, cleared: [], tutorialDone: false, seenOpening: true })); 1`);
    await B.goto(url); await B.sleep(300);
    ok(await B.eval(`document.getElementById('tPlay').textContent`) === 'BEGIN', `${w}x${h} H L1 started, never won: BEGIN`);
    await D.tapSel('#tPlay'); await B.sleep(500);
    ok(await B.eval(`__LL.G.n === 0 && !!document.getElementById('l0Skip')`), `${w}x${h} H … → L0 entry card`);
    await done(B);

    // I. reduced motion: the run completes and the illustrations hold still; E: Restart mid-run
    B = await launch({ w, h }); D = driver(B, w, h);
    await B.goto(url);
    await B.eval(`localStorage.setItem('lightlag.v1', JSON.stringify({ seenOpening: true, settings: { sound: true, reduced: true } })); 1`);
    await B.goto(url); await B.sleep(300);
    await guidedRun(B, w, h, { label: `${w}x${h} reduced`, reduced: true, restartAt: 1, shot: w === 390 ? (n) => B.shot(path.join(out, 'reduced-' + n + '.png')) : null });
    await done(B);

    // J. storage blocked: fresh every time, BEGIN → L0 → yr 9
    B = await launch({ w, h }); D = driver(B, w, h);
    await B.send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });` });
    await B.goto(url); await D.openingToTitle();
    await guidedRun(B, w, h, { label: `${w}x${h} no-storage` });
    await done(B);

    ok(!allLogs.some((l) => l.startsWith('EXCEPTION') || l.startsWith('error')), `${w}x${h} J no console errors ${allLogs.filter((l) => l.startsWith('EXC') || l.startsWith('error')).slice(0, 3).join(' | ')}`);
    ok(allReqs.filter((u) => !u.startsWith('file:') && !u.startsWith('data:')).length === 0, `${w}x${h} J no network requests`);
  }
  console.log(fails ? `${fails} FAILED` : 'ALL OK', '->', out);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('ERROR', e.stack); process.exit(1); });
