// Minimal headless-Chrome driver over CDP (no deps). Usage in scripts:
//   const B = await require('./cdp.js').launch({w:390,h:844}); await B.goto(url); await B.eval('1+1'); await B.shot('x.png'); await B.close();
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function launch({ w = 390, h = 844, dpr = 2, mobile = true } = {}) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const prof = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'cdp-'));
  const proc = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  let ws = null;
  for (let i = 0; i < 80 && !ws; i++) {
    await new Promise((r) => setTimeout(r, 150));
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const pg = list.find((x) => x.type === 'page');
      if (pg) ws = pg.webSocketDebuggerUrl;
    } catch (e) {}
  }
  if (!ws) throw new Error('chrome did not start');
  const sock = new WebSocket(ws);
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
  let id = 0; const pend = new Map(); const logs = []; const reqs = [];
  sock.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { const { res, rej } = pend.get(d.id); pend.delete(d.id); d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result); }
    else if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
    else if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + JSON.stringify(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    else if (d.method === 'Network.requestWillBeSent') reqs.push(d.params.request.url);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); sock.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const B = {
    send, logs, reqs,
    async goto(url) { await send('Page.navigate', { url }); await new Promise((r) => setTimeout(r, 800)); },
    async eval(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; },
    async shot(file) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); },
    async tap(x, y) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await new Promise((r) => setTimeout(r, 120));
    },
    async click(x, y) {
      for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      await new Promise((r) => setTimeout(r, 120));
    },
    async sleep(ms) { await new Promise((r) => setTimeout(r, ms)); },
    async close() { try { sock.close(); } catch (e) {} proc.kill('SIGKILL'); try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {} },
  };
  return B;
}
module.exports = { launch };
