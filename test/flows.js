// Flow + layout checks with screenshots. Run: node test/flows.js [outdir]
const path = require('path');
const fs = require('fs');
const { launch } = require('./cdp.js');
const out = process.argv[2] || path.join(process.env.TMPDIR || '/tmp', 'll-flows');
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.join(__dirname, '..', 'lightlag.html');

const playTo = (n, label, stopYear) => `(() => { const L = __LL; L.hideOverlay(); L.loadLevel(${n});
  const plan = ${label ? `L.G.L.test_plans[${JSON.stringify(label)}]` : '[]'};
  while (L.G.now < ${stopYear} && !L.G.won) {
    for (const [t, kind, who, arg] of plan) if (t === L.G.now) { if (kind === 'MOVE') L.queueMove(who, arg); else if (kind === 'FLASH') L.queueFlash(who, arg); else L.queueFlash('HOME', arg); }
    if (L.G.now === ${stopYear} - 0) break;
    L.advance(); L.G.p = 1;
  }
  for (const [t, kind, who, arg] of plan) if (t === L.G.now) { if (kind === 'MOVE') L.queueMove(who, arg); else if (kind === 'FLASH') L.queueFlash(who, arg); else L.queueFlash('HOME', arg); }
  return L.G.now; })()`;

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

(async () => {
  let fails = 0;
  const ok = (c, m) => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + m); };
  for (const [w, h] of [[360, 640], [390, 844], [360, 560]]) {
    const B = await launch({ w, h });
    await B.goto(url);
    await B.eval(`__LL.G.save.tutorialDone = true; 1`);
    const shots = w === 390;
    const S = async (name) => { if (shots) await B.shot(path.join(out, name + '.png')); };
    // L2 mid, drone selected with queued order
    await B.eval(playTo(2, 'reference', 6));
    await B.eval(`__LL.select('B'); __LL.queueMove('B', [-3, 4]); 1`);
    let lc = await B.eval(layoutCheck);
    ok(!lc.bad.length, `${w}x${h} L2 layout board=${lc.board} ${lc.bad.join('; ')}`);
    await S('L2-y6-selected');
    await B.eval(playTo(3, 'reference', 2)); await B.eval(`__LL.select('A'); 1`); await S('L3-y2-tags');
    await B.eval(playTo(4, 'reference (sends after projection)', 9)); await B.eval(`__LL.select('A'); 1`); await S('L4-y9');
    lc = await B.eval(layoutCheck); ok(!lc.bad.length, `${w}x${h} L4 layout ${lc.bad.join('; ')}`);
    await B.eval(playTo(6, 'naive: both drones now', 4)); await S('L6-naive-y4');
    await B.eval(playTo(7, 'reference', 9)); await B.eval(`__LL.select('HOME'); 1`); await S('L7-y9-split');
    lc = await B.eval(layoutCheck); ok(!lc.bad.length, `${w}x${h} L7 layout ${lc.bad.join('; ')}`);
    // finale yr 13 with V selected
    await B.eval(`(() => { const L = __LL; L.hideOverlay(); L.loadLevel(8); for (let i = 0; i < 3; i++) document.getElementById('primary').click(); while (L.G.now < 13) { L.advance(); L.G.p = 1; } L.select('V'); return 1; })()`);
    lc = await B.eval(layoutCheck); ok(!lc.bad.length, `${w}x${h} finale layout ${lc.bad.join('; ')}`);
    await S('L8-y13');
    // win -> act card -> interstitial -> L5 by real taps
    await B.eval(playTo(4, 'reference (sends after projection)', 13));
    await B.eval(`__LL.advance(); __LL.G.p = 1; __LL.G.won`);
    await B.sleep(1900);
    await S('win-L4');
    lc = await B.eval(`(() => { const r = document.querySelector('.win').getBoundingClientRect(); const n = document.getElementById('wNext').getBoundingClientRect(); return [Math.round(r.height), Math.round(n.bottom), innerHeight]; })()`);
    ok(lc[1] <= lc[2], `${w}x${h} win screen Next button visible (bottom ${lc[1]} / vh ${lc[2]})`);
    await B.eval(`document.getElementById('wNext').click(); 1`);
    for (let i = 0; i < 4; i++) { await B.tap(w / 2, 100); }
    await S('interstitial-1');
    for (let i = 0; i < 5; i++) await B.tap(w / 2, 100);
    await B.sleep(200);
    const lvl = await B.eval(`__LL.G.n`);
    ok(lvl === 5, `${w}x${h} act card + interstitial lead to L5 (at ${lvl})`);
    await S('L5-intro');
    // ending sequence to credits
    await B.eval(`(() => { const L = __LL; L.hideOverlay(); L.loadLevel(8); for (let i = 0; i < 3; i++) document.getElementById('primary').click(); while (!L.G.won) { if (L.G.now === 10) L.G.queue.push({kind:'PING', who:'HOME', arg:'W'}); L.advance(); L.G.p = 1; } return L.G.now; })()`);
    await B.sleep(2500); await S('end-1-stamp');
    for (let i = 0; i < 3; i++) await B.tap(w / 2, 60);
    await S('end-2-forest');
    for (let i = 0; i < 3; i++) await B.tap(w / 2, 60);
    await B.sleep(3000); await S('end-3-replay');
    await B.eval(`document.getElementById('eNext').click(); 1`);
    await S('end-4-credits');
    ok(await B.eval(`!!document.getElementById('cPlay')`), `${w}x${h} ending reaches credits`);
    ok(!B.logs.some((l) => l.startsWith('EXCEPTION') || l.startsWith('error')), `${w}x${h} no console errors ${B.logs.filter((l) => l.startsWith('EXC')).slice(0, 2).join(' | ')}`);
    await B.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL OK', '->', out);
  process.exit(fails ? 1 : 0);
})();
