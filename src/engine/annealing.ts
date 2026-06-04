import type { Game, DrawRow, MLFeatures } from '../types';
import { mulberry, range, sample } from '../utils';
import { mlFeatures } from './ml';
import { scoreTicket } from './score';
import { analyze } from './analyze';

export function saTicket(
  g: Game,
  hist: DrawRow[],
  seed: number,
  onProgress?: (pct: number) => void,
): number[] {
  const rng = mulberry(seed);
  const nums = range(g);
  const pickCount = g.pick;
  const initialTemp = 100;
  const finalTemp = 0.01;
  const steps = Math.max(200, pickCount * 20);
  const alpha = Math.pow(finalTemp / initialTemp, 1 / steps);

  // Initial random solution
  let current = sample(nums, pickCount, rng);
  let currentEnergy = -scoreTicket(g, current);

  let best = [...current];
  let bestEnergy = currentEnergy;

  const reportEvery = Math.max(1, Math.floor(steps / 20));

  for (let i = 0; i < steps; i++) {
    const temp = initialTemp * Math.pow(alpha, i);

    // Generate neighbor: swap one element
    const neighbor = [...current];
    const swapOutIdx = Math.floor(rng() * pickCount);
    let swapIn: number;
    do {
      swapIn = nums[Math.floor(rng() * nums.length)];
    } while (neighbor.includes(swapIn));
    neighbor[swapOutIdx] = swapIn;
    neighbor.sort((a, b) => a - b);

    const neighborEnergy = -scoreTicket(g, neighbor);
    const delta = neighborEnergy - currentEnergy;

    if (delta < 0 || rng() < Math.exp(-delta / temp)) {
      current = neighbor;
      currentEnergy = neighborEnergy;

      if (currentEnergy < bestEnergy) {
        best = [...current];
        bestEnergy = currentEnergy;
      }
    }

    if (onProgress && i % reportEvery === 0) {
      onProgress(i / steps);
    }
  }

  return best;
}
