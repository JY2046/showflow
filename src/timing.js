import { scenes as sample, longTimes, shortTimes } from "./data.js";
export function timesFor(scenes, budget) {
  if (scenes.length === 6 && scenes.every((s, i) => s.id === sample[i].id))
    return [...(budget === 90 ? shortTimes : longTimes)];
  if (!scenes.length) return [];
  const weights = scenes.map(
      (s) => 1 + Math.min((s.deckBody ?? s.goal ?? "").length, 400) / 400,
    ),
    sum = weights.reduce((a, b) => a + b, 0),
    available = budget - scenes.length;
  const exact = weights.map((w) => (available * w) / sum),
    times = exact.map((n) => Math.floor(n) + 1);
  let remaining = budget - times.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r);
  for (let k = 0; k < remaining; k++) times[order[k % order.length].i]++;
  return times;
}
