// Finale timeline checks. Run: node test/finale.test.js
const SIM = require('../src/sim.js');
global.SIM = SIM;
const FIN = require('../src/finale.js');
const L = { n: 8, R: 5, drones: { V: [2, -1] }, watchers: [], standing: { target: [4, -2], listen: 3, to: 'W' }, objective: { type: 'finale' } };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const an = (plan) => FIN.analyse(L, plan.map((x) => ({ t: x[0], kind: x[1], who: x[2], arg: x[3] })));

let a = an([[10, 'PING', 'HOME', 'W']]);
ok(a.kind === 'answer' && a.A === 15 && a.endSeen === 21 && !a.probe, 'home answer y10 ' + JSON.stringify(a));
ok(a.calls.join() === '5,7,9,11,13', 'calls stop at answer ' + a.calls);
a = an([[10, 'FLASH', 'V', 'W']]);
ok(a.kind === 'answer' && a.A === 15, 'drone ask y10 ' + JSON.stringify([a.A, a.kind]));
a = an([[10, 'STANDING', 'V', null]]);
ok(a.kind === 'delegate' && a.standingAt === 12 && a.A === 20 && a.endSeen === 26, 'delegate y10 ' + JSON.stringify([a.kind, a.standingAt, a.A, a.endSeen, a.forward]));
a = an([[24, 'PING', 'HOME', 'W']]);
ok(a.probe && a.A === 29 && a.endSeen === 35, 'late answer => probe ' + JSON.stringify([a.probe, a.A]));
a = an([]);
ok(a.A === null && a.probe && a.calls.length === 8, 'hold');
// standing then later home orders are declined
const res = SIM.simulate(L, [{ t: 10, kind: 'STANDING', who: 'V' }, { t: 13, kind: 'MOVE', who: 'V', arg: [0, 0] }], 40);
ok(res.events.some((e) => e.type === 'declined'), 'declined after standing');
ok(FIN.probeSeen(27) && FIN.probeSeen(27)[1].join() === '5,-3' && FIN.probeSeen(26) === null, 'probe first seen y27 at W');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
