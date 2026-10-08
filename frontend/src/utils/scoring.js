// Client-side priority-mixer ranking. The API returns up to three plans
// (plan + alternatives); we blend and re-rank them instantly as the
// sustainability/cost/yield sliders move, per the product spec.

function collectPlans(result) {
  if (!result) return [];
  const all = { [result.plan.objective]: result.plan, ...(result.alternatives || {}) };
  return Object.values(all);
}

// yieldScore approximates how much each plan's nutrient supply moves the
// farmer toward the full crop need — more supply (up to the cap) scores higher.
function yieldScoreFor(plan) {
  const supplied = (plan.supply?.N ?? 0) + (plan.supply?.P ?? 0) * 2 + (plan.supply?.K ?? 0);
  return supplied;
}

export function rankPlans(result, mixer) {
  const plans = collectPlans(result);
  if (!plans.length) return [];

  const costs = plans.map((p) => p.cost);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const yields = plans.map(yieldScoreFor);
  const minYield = Math.min(...yields);
  const maxYield = Math.max(...yields);

  const wS = (mixer.sustainability ?? 0) / 100;
  const wC = (mixer.cost ?? 0) / 100;
  const wY = (mixer.yieldW ?? 0) / 100;

  const scored = plans.map((plan, i) => {
    const costScore = maxCost === minCost ? 100 : 100 * (1 - (plan.cost - minCost) / (maxCost - minCost));
    const yieldScore = maxYield === minYield ? 100 : 100 * ((yields[i] - minYield) / (maxYield - minYield));
    const blended = wS * plan.sustainability_score + wC * costScore + wY * yieldScore;
    return { plan, costScore: Math.round(costScore), yieldScore: Math.round(yieldScore), blended: Math.round(blended * 10) / 10 };
  });

  scored.sort((a, b) => b.blended - a.blended);
  return scored;
}

export function topObjective(result, mixer) {
  const ranked = rankPlans(result, mixer);
  return ranked[0]?.plan.objective || result?.plan?.objective || "balanced_inm";
}

export function mixerSentenceKey(mixer) {
  if (mixer.sustainability >= 60) return "mixerSentenceEco";
  if (mixer.cost >= 55) return "mixerSentenceBudget";
  if (mixer.yieldW >= 45) return "mixerSentenceYield";
  return "mixerSentenceBalanced";
}

// A short, human reason the top plan is what it is, for "why this plan moved to the top".
export function whyTopPick(ranked, mixer) {
  if (!ranked.length) return "";
  const top = ranked[0];
  const dominant =
    mixer.sustainability >= mixer.cost && mixer.sustainability >= mixer.yieldW
      ? "sustainability"
      : mixer.cost >= mixer.yieldW
      ? "cost saving"
      : "yield";
  return `Because you weighted ${dominant} highest, the ${top.plan.objective.replace("_", " ")} plan scored best (${top.blended}/100 blended score).`;
}
