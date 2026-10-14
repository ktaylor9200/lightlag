// LIGHT LAG — script, text and level extras. Level geometry comes from
// reference/levels.json (injected by build.js as LEVELS_JSON).
const FINALE_LEVEL = {
  n: 8, act: 3, name: 'The Last Required Signature', R: 5,
  drones: { V: [2, -1] }, watchers: [],
  world: { id: 'W', pos: [5, -3] },
  standing: { target: [4, -2], listen: 3, to: 'W' },
  objective: { type: 'finale', text: 'Petition 1: pending.' },
};

const SCRIPT = {
  1: {
    intro: null,
    end: 'Confirmed. It happened two years ago. You found out just now. This will keep happening.',
    hints: ['Wait for the dashed marker.', 'Aim at the dotted track, not the solid image.', 'Re-aim A at the hex just ahead of the dashed marker.'],
    startLog: ['Drone A is one light-year out. A derelict probe is drifting past the top edge.'],
  },
  2: {
    intro: ['Two drones. Two derelicts.', 'Light from the near one is fresh. Light from the far one is not.'],
    end: 'Objects in the past are closer than they appear.',
    glints: ['Faint glint, ring {ring}. Instrument noise. Filed.'],
    hints: ['Use the near drone for the near derelict.', "The far drone's orders take 4 years. Aim far down D2's track.", 'Year 6: move B one hex to its left. Year 7: move A to the hex just right of Home.'],
    startLog: ['Two derelicts. One is very close. One only looks far.'],
  },
  3: {
    intro: ['New order: FLASH.', 'A drone flashes the moment your order reaches it. Not before.'],
    end: 'Sent at different times, from different places, arriving together. That is all harmony is.',
    glints: ['Noise again. Filed.'],
    hints: ['Read the arrival tags on the relay.', 'Make the two numbers match by waiting before you send one.', 'Send B now. Send A in two years.'],
    startLog: ['An old relay, ring 3. It wakes for two signals arriving in the same year. It is particular about the same year.'],
  },
  4: {
    intro: ['The relay is riding a derelict.', 'It will not wait for you.'],
    end: 'Three voices, one year, one moving target. Logged.',
    glints: ['Filed.', 'Same direction as last time? Different. Filed anyway.', 'The noise is very punctual.'],
    hints: ['Pick a year after the projection appears, and work backwards.', 'Send each drone when its tag shows the chosen year.', 'Years 5, 6 and 9: C, then B, then A.'],
    startLog: ['A relay rides that derelict. Tags read "?" until Home has seen it move.'],
    actCard: ['Act I: Home.', 'Everything you saw had already happened.', 'Everything you said arrived late.', 'You did fine.'],
  },
  5: {
    intro: ['Watchers are drawn now. Some of them have rules.', 'Home can speak for itself: tap Home, then ASK, then tap a watcher.'],
    end: 'Two signatures. Neither of them was in a hurry.',
    hints: ['P must hear its own request first.', 'Ask P, then S a year later.'],
    startLog: ['Two neighbours. P will sign only if the first request it hears is addressed to it. S will sign when asked.'],
  },
  6: {
    intro: ['Two precedents. Each insists on being asked first.', "From Home that's impossible: anything you say, they both hear in the same order.", "You'll have to say it from two places."],
    end: 'Each was asked first. Both are correct.',
    codex: 'Each was asked first. Both are correct. It only worked because your two requests were outside each other\'s light cones. For events like that, not even the universe insists on an order.',
    hints: ["One place can't do it.", 'Ask from near P and near Q, close together in time.', 'X asks P now. Y asks Q two years later.'],
    startLog: ['P and Q. Both precedents. Drones X and Y each sit near one of them.'],
  },
  7: {
    intro: ['Three precedents, close together.', 'Every party must sign.'],
    end: "All parties signed. One of them didn't exist when you started asking. That happens more than you'd think.",
    hints: ['The near drone waits for the far ones.', 'Watch R.', "X and Z now, Y at year 3, then ask R\u2032 from Home once you see it."],
    startLog: ['P, Q and R. Precedents, all three. Your drones X, Y and Z are each beside one.'],
    actCard: ['Act II: Neighbours.', 'They have rules.', 'The rules are older than the reasons for them.', 'You were patient.'],
  },
  8: {
    intro: ['Act III', 'The Last Required Signature'],
    hints: [],
    startLog: [],
  },
};

const TEXT = {
  opening: ['Light is the fastest thing there is.', 'It is still slow.', 'Everything you can see has already happened.'],
  scale: [
    '1 hex = 1 light-year. 1 tick = 1 year.',
    'Light crosses one hex per year. Your drones manage half that. Derelicts, old probes on ancient courses, manage a third.',
    'Nothing is faster than light. So everything you see is old, and every order you send arrives late.',
    'Solid shapes: what Home sees (old light). Dashed shapes: what Home has calculated.',
    'Drone clocks run about 13% slow at half light speed. Home has decided not to bring it up.',
  ],
  interstitial: [
    'Reviewing filed noise.',
    'Every glint arrived exactly when an echo of your own voice would have.',
    'Something was listening. Several somethings. They acknowledged every word you sent, politely and faintly, and never interrupted.',
    'I need to reconsider several classifications.',
  ],
  finaleOpen: [
    'Petition 1. Opened before this world had oxygen.',
    'Requires: the consent of its inhabitants.',
    'Their consent cannot be requested without contacting them. That is why it is pending.',
  ],
  credits: ['LIGHT LAG', 'Concept: Vivian', 'Design: Evelyn', 'Build: Oliver', 'Polish: Claude Code', 'For Kane'],
  forestCaption: 'wind through leaves \u00b7 someone breathing behind the microphone \u00b7 a bird nobody can name',
};

const CODEX = {
  dilation: { t: 'Time dilation', b: 'Drone clocks run about 13% slow at 0.5c. Home has decided not to bring it up.' },
  hurry: { t: 'Apparent speed', b: 'Approaching things appear to hurry. Receding things appear to linger. Neither is true. Both are late.' },
  fastdrone: { t: 'Faster than light (not)', b: "Your drone appears to be travelling at the speed of light. It isn't. You're seeing its departure late and its arrival on time." },
  departure: { t: 'Departure', b: 'A drone cannot outrun the news of its own departure.' },
  lightcone: { t: 'No universal now', b: SCRIPT[6].codex },
  noise: { t: 'Instrument noise', b: 'Every glint arrived exactly when an echo of your own voice would have. It was never noise.' },
  split: { t: 'Division', b: 'Requests addressed to a parent do not count for its child. Nobody asks the new ones anything unless someone thinks to.' },
  stale: { t: 'Stale consent', b: 'Their consent was five years old when you heard it. Your answer will be five years old when it arrives. Nobody involved is wrong.' },
};

const ENDINGS = {
  answer: { name: 'The Long Hello', stamp: 'SUPERSEDED BY EVENTS' },
  delegate: { name: 'Standing', stamp: 'TRANSFERRED' },
  hold: { name: 'Pending', stamp: 'PENDING' },
};
