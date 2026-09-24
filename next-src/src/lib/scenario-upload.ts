export function parseScenarios(text: string, maximum = 200): string[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const scenarios: string[] = [];
  const seen = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(line); } catch { throw new Error(`Line ${index + 1}: invalid JSON. Put one {"scenario":"…"} object on each line.`); }
    const value = typeof parsed === 'string' ? parsed : parsed && typeof parsed === 'object' && 'scenario' in parsed ? parsed.scenario : null;
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Line ${index + 1}: scenario must be nonempty text.`);
    const scenario = value.trim();
    if (scenario.length > 8000) throw new Error(`Line ${index + 1}: scenario exceeds 8,000 characters.`);
    if (seen.has(scenario)) throw new Error(`Line ${index + 1}: duplicate scenario. Each question should appear once.`);
    scenarios.push(scenario); seen.add(scenario);
  }
  if (!scenarios.length || scenarios.length > maximum) throw new Error(`Supply between 1 and ${maximum} unique scenarios.`);
  if (scenarios.reduce((n, s) => n + s.length, 0) > 400000) throw new Error('Scenario text exceeds 400,000 characters.');
  return scenarios;
}
