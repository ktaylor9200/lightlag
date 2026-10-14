// Misc interaction checks. Run: node test/misc.js
const path = require('path');
const { launch } = require('./cdp.js');
const url = 'file://' + path.join(__dirname, '..', 'lightlag.html');
(async () => {
  const B = await launch({ w: 390, h: 844 });
  let fails = 0;
  const ok = (c, m) => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + m); };
  await B.goto(url);
  await B.eval(`__LL.G.save.tutorialDone = true; __LL.hideOverlay(); __LL.loadLevel(1); 1`);
  // until news from year 0
  await B.eval(`__LL.untilNews(); 1`); await B.sleep(3500);
  const y = await B.eval(`__LL.G.now`);
  ok(y >= 1 && y <= 8, `until-news stops early (year ${y})`);
  // smart rewind button in L5 naive
  await B.eval(`(() => { const L = __LL; L.loadLevel(5); L.queueFlash('HOME','P'); L.queueFlash('HOME','S'); for (let i = 0; i < 6; i++) { L.advance(); L.G.p = 1; } return 1; })()`);
  await B.sleep(200);
  const hasBtn = await B.eval(`!!document.querySelector('#logact button') && document.querySelector('#logact button').textContent`);
  ok(!!hasBtn, `smart rewind button shown: ${hasBtn}`);
  await B.eval(`document.querySelector('#logact button').click(); 1`);
  ok(await B.eval(`__LL.G.now === 0 && __LL.G.plan.length === 0`), 'smart rewind returns to year 0 with no plan');
  // menu rewind
  await B.eval(`__LL.advance(); __LL.advance(); document.getElementById('menuBtn').click(); document.getElementById('mRewind').click(); 1`);
  ok(await B.eval(`__LL.G.now`) === 1, 'menu rewind 1 year');
  // hint ladder
  await B.eval(`document.getElementById('menuBtn').click(); document.getElementById('mHint').click(); document.getElementById('hMore').click(); 1`);
  ok((await B.eval(`document.querySelectorAll('.hints p').length`)) === 2, 'hint ladder step 2');
  await B.eval(`document.getElementById('sheetBack').click(); 1`);
  // inspector on a watcher
  await B.eval(`(() => { const g = __LL.geomOf(); const c = document.getElementById('board').getBoundingClientRect(); const p = g.px(3, -3); __LL.onBoardTap(p[0], p[1]); return 1; })()`);
  const sheet = await B.eval(`document.getElementById('sheetBody').innerText.slice(0, 160)`);
  ok(/precedent/i.test(sheet), 'inspect watcher P: ' + JSON.stringify(sheet.slice(0, 80)));
  await B.eval(`document.getElementById('sheetBack').click(); 1`);
  // empty hex toast
  await B.eval(`(() => { const g = __LL.geomOf(); const p = g.px(-2, 0); __LL.onBoardTap(p[0], p[1]); return 1; })()`);
  ok(/Ring 2/.test(await B.eval(`document.getElementById('toast').textContent`)), 'empty hex toast');
  ok(!B.logs.some((l) => l.startsWith('EXCEPTION')), 'no exceptions ' + B.logs.filter((l) => l.startsWith('EXC')).join(' | '));
  await B.close();
  console.log(fails ? `${fails} FAILED` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
