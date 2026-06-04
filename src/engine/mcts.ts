import type { Game, AnalysisResult } from '../types';
import { buildGame } from './generate';
import { enhancedFit } from './score';
import { analyze } from './analyze';
import { range, todaySeed, hash, mulberry } from '../utils';

export function mctsTicket(g: Game, index: number, avoid: number[][]): number[] {
  const a = analyze(g);
  const pool = range(g);
  const its = 500;
  const C = 1.4;

  interface MCTSNode {
    n: number;
    w: number;
    children: MCTSNode[] | null;
    pick: number[];
    parent?: MCTSNode;
  }

  const root: MCTSNode = { n: 0, w: 0, children: null, pick: [] };
  const rng = mulberry(todaySeed() + hash(g.id + 'mcts') + index * 7919);

  for (let iter = 0; iter < its; iter++) {
    let node = root;
    const path: MCTSNode[] = [root];

    while (node.children && node.children.length) {
      const best = node.children.reduce((a, b) =>
        a.n
          ? (!b.n || a.w / a.n + Math.sqrt(Math.log(node.n) / a.n) < b.w / b.n + Math.sqrt(Math.log(node.n) / b.n) ? b : a)
          : b
      );
      path.push(best);
      node = best;
    }

    if (node.pick.length < g.pick && node.n > 10) {
      const used = new Set(node.pick);
      const cand = pool.filter(n => !used.has(n));
      const child: MCTSNode = {
        n: 0,
        w: 0,
        children: null,
        pick: [...node.pick, cand[Math.floor(rng() * cand.length)]],
        parent: node,
      };
      node.children = node.children || [];
      node.children.push(child);
      node = child;
      path.push(child);
    }

    let ticket = [...node.pick];
    if (ticket.length < g.pick) {
      const used = new Set(ticket);
      const cand = pool.filter(n => !used.has(n));
      while (ticket.length < g.pick && cand.length) {
        ticket.push(cand.splice(Math.floor(rng() * cand.length), 1)[0]);
      }
      ticket.sort((x, y) => x - y);
    }

    const score = enhancedFit(g, ticket, a, avoid, index, iter);
    for (const nd of path) { nd.n++; nd.w += score / 100; }
  }

  const bestChild = root.children
    ? root.children.reduce((a, b) => (a.w / a.n > b.w / b.n ? a : b))
    : null;

  return bestChild ? bestChild.pick.sort((x, y) => x - y) : buildGame(g, 'balanced', index, avoid);
}
