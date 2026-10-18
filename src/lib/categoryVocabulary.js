/** Small vocabulary aliases, never a migration of saved categories or IDs. */
export function categoryNames(cat) {
  return /^food\s*(?:&|and)\s*drinks$/i.test(cat.label.trim()) ? [...new Set([cat.label, 'Food and Drinks', 'Food & Drinks', 'Food'])] : [cat.label];
}
export function transportClarification(message, cats = []) {
  const text = String(message).replace(/[“"][^”"]*[”"]/g, ' ');
  if (!/\b(spend|spending|spent|expenses?|expenditure|transactions?|total|budget)\b/i.test(text) || !/\btransport\b/i.test(text) || /\b(public\s+transport|private\s+hire)\b/i.test(text)) return null;
  // A user's explicitly named custom Transport category retains its actual meaning.
  if (cats.some(c => /^transport$/i.test(c.label.trim()))) return null;
  const pub = cats.find(c => /^public transport$/i.test(c.label.trim()));
  const hire = cats.find(c => /^private hire$/i.test(c.label.trim()));
  return pub && hire ? { type: 'clarify', question: `Transport could include ${pub.label} and ${hire.label}. I currently support one category per query. Please resubmit your full question specifying which one, keeping its dates and filters.`, options: [] } : null;
}
