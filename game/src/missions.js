// The story: four missions that chain into "The Solmara Job". Each mission
// is a list of steps; a step names its objective text, its marker on the
// map and what completes it. The world advances steps and pays out on
// completion.
import { MISSION_CASH } from './config.js';

export const MISSIONS = [
  {
    id: 'm1',
    title: 'Fresh Wheels',
    intro: 'Danny Cole is back in Solmara, broke and on foot. Rico left a coupe at the garage — go get it.',
    payout: MISSION_CASH.m1,
    steps: [
      { id: 'walk-garage', text: 'Get to the Garage', target: 'garage', radius: 90, needsCar: false },
      { id: 'drive-home', text: 'Drive the coupe home to the Safehouse', target: 'safehouse', radius: 90, needsCar: true },
    ],
  },
  {
    id: 'm2',
    title: 'Hot Wheels',
    intro: 'The crew needs wheels that cannot be traced. Steal any car — then lose the heat at the Spray Shop.',
    payout: MISSION_CASH.m2,
    steps: [
      { id: 'steal-car', text: 'Steal a car (walk up to one and press E)', target: null, radius: 0, needsCar: true, steal: true },
      { id: 'spray-shop', text: 'Reach the Spray Shop to clear your wanted level', target: 'spray', radius: 90, needsCar: true },
    ],
  },
  {
    id: 'm3',
    title: 'The Pickup',
    intro: 'Rico is waiting at the Hotel Miramar. Pick him up, then scope the bank together.',
    payout: MISSION_CASH.m3,
    steps: [
      { id: 'pickup-rico', text: 'Pick up Rico at the Hotel Miramar', target: 'hotel', radius: 90, needsCar: true },
      { id: 'scope-bank', text: 'Drive Rico to the Solmara Bank', target: 'bank', radius: 110, needsCar: true },
    ],
  },
  {
    id: 'm4',
    title: 'The Solmara Job',
    intro: 'The vault is open for exactly one minute. Grab the cash, get out, and lose the cops.',
    payout: MISSION_CASH.m4,
    steps: [
      { id: 'enter-bank', text: 'Get inside the Solmara Bank on foot', target: 'bank', radius: 130, needsCar: false, onFoot: true },
      { id: 'grab-cash', text: 'Grab the cash from the vault', target: 'bank', radius: 110, needsCar: false, onFoot: true, grab: true },
      { id: 'escape', text: 'Escape to the Safehouse — lose the cops on the way', target: 'safehouse', radius: 90, needsCar: false },
    ],
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) ?? null;
}

// The objective text the HUD shows for a mission state.
export function currentObjective(missionIndex, stepIndex) {
  const mission = MISSIONS[missionIndex];
  if (!mission) return 'Free roam — explore Solmara, earn cash, stay out of trouble.';
  const step = mission.steps[stepIndex];
  return `${mission.title}: ${step.text}`;
}
