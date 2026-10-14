"""LIGHT LAG — reference rules simulator (design aid, NOT the game).

Purpose: pins down the exact rules in BRIEF-final.md and verifies that every
level is solvable, what its par is, and that the 'naive' play fails in the
intended, instructive way. Oliver: if the JS build disagrees with this file,
one of us has a bug; the brief's prose rules are the tie-breaker.

Run:  python3 sim.py          (prints a verification report for all levels)
"""
import json, os

# Axial hex coords (q, r), pointy-top, r grows downward on screen.
DIRS = {'E': (1, 0), 'NE': (1, -1), 'NW': (0, -1), 'W': (-1, 0), 'SW': (-1, 1), 'SE': (0, 1)}
HOME = (0, 0)


def dist(a, b):
    dq = a[0] - b[0]; dr = a[1] - b[1]
    return max(abs(dq), abs(dr), abs(dq + dr))


def cube_round(x, y, z):
    rx, ry, rz = round(x), round(y), round(z)
    dx, dy, dz = abs(rx - x), abs(ry - y), abs(rz - z)
    if dx > dy and dx > dz:
        rx = -ry - rz
    elif dy > dz:
        ry = -rx - rz
    else:
        rz = -rx - ry
    return (rx, rz)


def step_toward(a, b):
    """One hex step from a toward b along the standard hex line (nudged)."""
    n = dist(a, b)
    if n == 0:
        return a
    ax, az = a[0] + 1e-6, a[1] + 2e-6; ay = -ax - az
    bx, bz = b[0] + 1e-6, b[1] + 2e-6; by = -bx - bz
    t = 1.0 / n
    return cube_round(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t)


def path(a, b):
    out = [a]
    while out[-1] != b:
        out.append(step_toward(out[-1], b))
    return out


DRONE_STEP = 2  # ticks per hex (0.5 c)


def simulate(level, plan, T=80):
    """plan: list of (tick, kind, who, arg)
         kind 'MOVE'  who=drone id, arg=(q,r)
         kind 'FLASH' who=drone id, arg=None (open) or watcher id (addressed)
         kind 'PING'  who='HOME',   arg=None or watcher id   (Home's own signal)
         kind 'STANDING' who=drone id (finale only; not simulated here)
    All orders listed for tick t are transmitted from Home at tick t."""
    R = level['R']
    drones = {k: {'pos': tuple(v), 'target': None, 'next': None} for k, v in level.get('drones', {}).items()}
    ders = {d['id']: {'pos': tuple(d['pos']), 'dir': DIRS[d['dir']], 'p': d['period'], 'next': d['first'],
                      'gone': False, 'tagged': None, 'entered': dist(tuple(d['pos']), HOME) <= R}
            for d in level.get('derelicts', [])}
    recs = {r['id']: dict(r, active=None) for r in level.get('receivers', [])}
    wat = {w['id']: {'pos': tuple(w['pos']), 'kind': w['kind'], 'signed': None, 'offended': None,
                     'born': 0, 'split': w.get('split')} for w in level.get('watchers', [])}
    pulses, events, received, hist = [], [], set(), {}
    planned = {}
    for (t, kind, who, arg) in plan:
        planned.setdefault(t, []).append((kind, who, arg))

    def rec_pos(r):
        if 'cell' in r:
            return tuple(r['cell'])
        d = ders[r['ride']]
        return None if d['gone'] else d['pos']

    def record(t):
        for k, d in drones.items():
            hist.setdefault(('drone', k), {})[t] = d['pos']
        for k, d in ders.items():
            if not d['gone'] and dist(d['pos'], HOME) <= R:
                hist.setdefault(('der', k), {})[t] = d['pos']
        for k, w in wat.items():
            hist.setdefault(('wat', k), {})[t] = w['pos']

    def emit_home(t):
        for (kind, who, arg) in planned.get(t, []):
            if kind in ('MOVE', 'FLASH'):
                pulses.append({'src': HOME, 't': t, 'kind': 'order', 'to': who, 'payload': (kind, arg)})
            elif kind == 'PING':
                pulses.append({'src': HOME, 't': t, 'kind': 'signal', 'to': arg, 'payload': 'HOME'})
                events.append((t, HOME, 'flash', ('HOME', arg)))

    def arrivals(t):
        sig_at_rec = {}
        wat_in = {}
        changed = True
        while changed:  # flashes emitted this tick can arrive this tick at distance 0
            changed = False
            targets = [('drone', k, d['pos']) for k, d in drones.items()]
            targets += [('wat', k, w['pos']) for k, w in wat.items() if w['born'] <= t]
            targets += [('rec', k, rec_pos(r)) for k, r in recs.items() if rec_pos(r)]
            for i, p in enumerate(list(pulses)):
                if p['t'] > t:
                    continue
                for (typ, k, pos) in targets:
                    key = (i, typ, k)
                    if key in received:
                        continue
                    if t - p['t'] >= dist(p['src'], pos):
                        received.add(key)
                        if typ == 'wat' and p['t'] + dist(p['src'], pos) < wat[k]['born']:
                            continue  # this front passed before the watcher existed
                        changed = True
                        if typ == 'drone' and p['kind'] == 'order' and p['to'] == k:
                            kind, arg = p['payload']; d = drones[k]
                            events.append((t, d['pos'], 'order_rx', (k, kind)))
                            if kind == 'FLASH':
                                pulses.append({'src': d['pos'], 't': t, 'kind': 'signal', 'to': arg, 'payload': k})
                                events.append((t, d['pos'], 'flash', (k, arg)))
                            else:
                                d['target'] = tuple(arg); d['next'] = t + DRONE_STEP
                        elif typ == 'rec' and p['kind'] == 'signal' and p['to'] is None:
                            sig_at_rec.setdefault(k, []).append(i)
                        elif typ == 'wat':
                            wat_in.setdefault(k, []).append(p)
        for k, lst in sig_at_rec.items():
            r = recs[k]
            if r['active'] is None and len(lst) >= r['need']:
                r['active'] = t; events.append((t, rec_pos(r), 'rec_on', k))
        for k, plist in wat_in.items():
            w = wat[k]
            events.append((t, w['pos'], 'glint', k))
            addressed = [p for p in plist if p['kind'] == 'signal' and p['to'] is not None]
            if addressed:
                w['last_req'] = t
            if w['kind'] not in ('sign', 'precedent') or w['signed'] is not None or w['offended'] is not None:
                continue
            mine = [p for p in plist if p['kind'] == 'signal' and p['to'] == k]
            others = [p for p in plist if p['kind'] == 'signal' and p['to'] not in (None, k)]
            if w['kind'] == 'precedent' and others:
                w['offended'] = t; events.append((t, w['pos'], 'offended', k))   # ties are NOT first
            elif mine:
                w['signed'] = t; events.append((t, w['pos'], 'sign', k))

    QUIET = None  # design decision: offended precedents stay offended (use Rewind). Set an int to test a 'calm down' variant.

    def calm(t):
        if QUIET is None:
            return
        for k, w in wat.items():
            if w['offended'] is not None and t - w.get('last_req', w['offended']) >= QUIET:
                w['offended'] = None; events.append((t, w['pos'], 'calm', k))

    # Prehistory: the level begins mid-story. For ticks < 0, drones and watchers
    # sat still and derelicts followed their own track backwards, so Home can
    # already see (old) images of everything at tick 0.
    for tau in range(-3 * R, 0):
        for k, d in drones.items():
            hist.setdefault(('drone', k), {})[tau] = d['pos']
        for k, w in wat.items():
            hist.setdefault(('wat', k), {})[tau] = w['pos']
        for k, d in ders.items():
            steps = sum(1 for s in range(d['next'] - d['p'], tau, -d['p']) if s <= 0)
            pos = (d['pos'][0] - d['dir'][0] * steps, d['pos'][1] - d['dir'][1] * steps)
            if dist(pos, HOME) <= R:
                hist.setdefault(('der', k), {})[tau] = pos
    record(0); emit_home(0); arrivals(0)
    for t in range(1, T + 1):
        prev = {k: d['pos'] for k, d in drones.items()}
        prevd = {k: d['pos'] for k, d in ders.items()}
        # 1. movement
        for k, d in ders.items():
            if not d['gone'] and d['next'] == t:
                d['pos'] = (d['pos'][0] + d['dir'][0], d['pos'][1] + d['dir'][1]); d['next'] += d['p']
                if dist(d['pos'], HOME) <= R:
                    d['entered'] = True
                elif d.get('entered'):
                    d['gone'] = True; events.append((t, prevd[k], 'exit', k))
        for k, d in drones.items():
            if d['target'] is not None and d['next'] == t:
                d['pos'] = step_toward(d['pos'], d['target']); d['next'] += DRONE_STEP
                if d['pos'] == d['target']:
                    d['target'] = None
        # 2. scripted splits
        for k, w in list(wat.items()):
            s = w.get('split')
            if s and s['tick'] == t:
                wat[s['id']] = {'pos': tuple(s['pos']), 'kind': s['kind'], 'signed': None, 'offended': None,
                                'born': t, 'split': None}
                events.append((t, tuple(s['pos']), 'split', (k, s['id'])))
        # 3. offended precedents calm down after enough quiet; 4. Home transmits; 5. arrivals
        calm(t); emit_home(t); arrivals(t)
        # 6. tags (same cell, or swapped cells this tick)
        for k, d in ders.items():
            if d['gone'] or d['tagged'] is not None:
                continue
            for dk, dr in drones.items():
                if dr['pos'] == d['pos'] or (dr['pos'] == prevd[k] and prev[dk] == d['pos']):
                    d['tagged'] = t; events.append((t, d['pos'], 'tag', (k, dk))); break
        record(t)
    return {'events': events, 'drones': drones, 'ders': ders, 'recs': recs, 'wat': wat, 'hist': hist}


def seen_tick(ev):
    """Home sees an event at (cell, t) at t + dist(cell, Home)."""
    return ev[0] + dist(ev[1], HOME)


def seen_pos(hist_obj, now):
    """Where Home SEES an object at Home-tick `now`: its position at the latest
    true tick tau with tau + dist(pos(tau), Home) <= now. None if nothing yet."""
    best = None
    for tau in sorted(hist_obj):
        if tau + dist(hist_obj[tau], HOME) <= now:
            best = tau
    return None if best is None else (best, hist_obj[best])


def outcome(level, plan, T=80):
    res = simulate(level, plan, T)
    ev, obj = res['events'], level['objective']
    req = []
    if obj['type'] == 'tag_any':
        e = [x for x in ev if x[2] == 'tag']
        if not e:
            return None, res
        req.append(min(e, key=seen_tick))
    elif obj['type'] == 'tag':
        for i in obj['ids']:
            e = [x for x in ev if x[2] == 'tag' and x[3][0] == i]
            if not e:
                return None, res
            req.append(e[0])
    elif obj['type'] == 'rec':
        e = [x for x in ev if x[2] == 'rec_on' and x[3] == obj['id']]
        if not e:
            return None, res
        req.append(e[0])
    elif obj['type'] == 'sign':
        for k, w in res['wat'].items():
            if w['kind'] in ('sign', 'precedent'):
                e = [x for x in ev if x[2] == 'sign' and x[3] == k]
                if not e:
                    return None, res
                req.append(e[0])
    last = max(req, key=seen_tick)
    return {'confirmed_at_home': seen_tick(last), 'happened_at': last[0], 'lag': seen_tick(last) - last[0]}, res


def first_seen_move(level, der_id, horizon=60):
    """Home tick at which Home first SEES derelict `der_id` change cell.
    The projection (dashed 'now' marker + future track) unlocks at this tick."""
    res = simulate(level, [], horizon)
    h = res['hist'].get(('der', der_id), {})
    first = None
    for n in range(0, horizon):
        s = seen_pos(h, n)
        if s is None:
            continue
        if first is None:
            first = s[1]
        elif s[1] != first:
            return n
    return None


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    data = json.load(open(os.path.join(here, 'levels.json')))
    for lv in data['levels']:
        lv = dict(lv)
        lv['drones'] = {k: tuple(v) for k, v in lv.get('drones', {}).items()}
        print('=' * 70)
        print(lv['n'], lv['name'])
        for d in lv.get('derelicts', []):
            print(f"  projection for {d['id']} unlocks at Home year {first_seen_move(lv, d['id'])}")
        for label, plan in lv.get('test_plans', {}).items():
            plan = [tuple(x[:3]) + ((tuple(x[3]) if isinstance(x[3], list) else x[3]),) for x in plan]
            o, res = outcome(lv, plan)
            glints = sorted({seen_tick(e) for e in res['events'] if e[2] == 'glint' and e[3].startswith('m')})
            extra = f"  | hidden-mirror glints seen at {glints[:6]}" if glints else ''
            print(f"  {label:36s} -> {o}{extra}")
