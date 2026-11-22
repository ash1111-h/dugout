// Loads the pure puzzle-generation code from index.html (between the GEN markers) so it can be
// tested in Node without a browser. Usage: const H = require('./harness')(pathToHtml);
const fs = require('fs');
module.exports = function load(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/const D = (\{.*?\});\s*\n\(function \(\) \{/s);
  if (!m) throw new Error('embedded data not found');
  const D = JSON.parse(m[1]);
  const a = html.indexOf('/*GEN:BEGIN*/'), b = html.indexOf('/*GEN:END*/');
  if (a < 0 || b < 0) throw new Error('GEN markers not found in ' + htmlPath);
  const code = html.slice(a, b);
  const api = new Function('D', code + '\nreturn { P, TS, TN, N, IDX, adjS, adjA, bfsS, bfsA, pairKey, genPuzzle, unlimitedPuzzle, dailyPuzzleFor, dateForDayNum, dayNumOf, mulberry32, xmur3, DIFF, WEEK, recipeFor, bestShared, pathBetween: (typeof pathBetween === "function" ? pathBetween : null), DAILY_PAIR_KEYS, FUTURE_DAILY, isModern, isRookie, genModernPuzzle, scheduledPair, pickLane, ERA_MIX, ERA_MODES, POOLS, modernEligible };')(D);
  api.D = D;
  return api;
};
