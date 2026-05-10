// Starter database of common New York Vehicle & Traffic Law (VTL) codes.
// Source: NY DMV public penalty schedules + NYS Bar Association published ranges.
// Fines and points are typical ranges — actual penalties depend on court and history.

window.NY_VTL_CODES = {
  '1110(a)': { desc: 'Failure to obey traffic-control device', fine: '$150–$300', points: 2 },
  '1111(d)': { desc: 'Failure to obey traffic signal (red light)', fine: '$150–$300', points: 3 },
  '1129(a)': { desc: 'Following too closely (tailgating)', fine: '$150–$300', points: 4 },
  '1142(a)': { desc: 'Failure to obey stop sign', fine: '$150–$300', points: 3 },
  '1144': { desc: 'Failure to yield to emergency vehicle', fine: '$275–$400', points: 4 },
  '1146': { desc: 'Failure to exercise due care (pedestrian)', fine: '$50–$425', points: 2 },
  '1160': { desc: 'Improper turn — required position', fine: '$150–$300', points: 2 },
  '1163': { desc: 'Failure to signal a turn', fine: '$150', points: 2 },
  '1172': { desc: 'Failure to stop before entering a stop intersection', fine: '$150–$300', points: 3 },
  '1180(a)': { desc: 'Maximum speed limits — general', fine: 'varies', points: '3–11' },
  '1180(b)': { desc: 'Speeding (1–10 mph over)', fine: '$45–$150', points: 3 },
  '1180(c)': { desc: 'Speeding (11–20 mph over)', fine: '$90–$300', points: 4 },
  '1180(d)': { desc: 'Speeding (21–30 mph over)', fine: '$180–$600', points: 6 },
  '1180(f)': { desc: 'Speed not reasonable for conditions', fine: '$45–$150', points: 3 },
  '1192(1)': { desc: 'Driving while ability impaired (DWAI)', fine: '$300–$500 + license action', points: 'serious' },
  '1192(2)': { desc: 'DWI — BAC .08 or higher', fine: '$500–$1,000 + license revoked', points: 'serious' },
  '1192(3)': { desc: 'Common-law DWI', fine: '$500–$1,000 + license revoked', points: 'serious' },
  '1225-c': { desc: 'Cell phone use while driving', fine: '$50–$200', points: 5 },
  '1225-d': { desc: 'Texting / portable electronic device', fine: '$50–$200', points: 5 },
  '375(2)': { desc: 'Vehicle equipment violation', fine: '$25–$150', points: 0 },
  '375(35)': { desc: 'Windshield cracked or obstructed', fine: '$25–$150', points: 0 },
  '375(12-a)(b)': { desc: 'Window tint too dark (>30%)', fine: '$25–$150', points: 0 },
  '401': { desc: 'Operating an unregistered vehicle', fine: '$75–$300', points: 0 },
  '402': { desc: 'Missing or improper plates', fine: '$25–$200', points: 0 },
  '509': { desc: 'Operating without a license', fine: '$75–$300', points: 0 },
  '511': { desc: 'Aggravated unlicensed operation', fine: '$200–$5,000', points: 'serious — misdemeanor possible' },
  '600(1)': { desc: 'Leaving the scene of a property-damage accident', fine: 'up to $250', points: 'serious' },
  '600(2)': { desc: 'Leaving the scene of an injury accident', fine: 'up to $1,000 + jail', points: 'serious — felony possible' },
  '1163(d)': { desc: 'Improper lane change without signaling', fine: '$150', points: 2 },
  '1180-a': { desc: 'Speeding in school zone (1–10 over)', fine: '$90–$300', points: 3 },
};

// Normalize a user-entered string into a lookup key.
// Examples: "1180b" → "1180(b)", "1180 b" → "1180(b)", "vtl 1192-2" → "1192(2)"
window.lookupVTL = function(input) {
  if (!input) return null;
  const t = input.toLowerCase().replace(/vtl|nys|new york/g, '').trim();
  // Try direct keys first
  if (window.NY_VTL_CODES[t]) return { code: t, ...window.NY_VTL_CODES[t] };
  // Try variants — strip parens & dashes
  const normalized = t.replace(/[\s()-]/g, '');
  for (const [key, val] of Object.entries(window.NY_VTL_CODES)) {
    if (key.replace(/[\s()-]/g, '').toLowerCase() === normalized) {
      return { code: key, ...val };
    }
  }
  // Substring match — let "1180" match all 1180(*)
  const candidates = Object.keys(window.NY_VTL_CODES).filter(k => {
    const stripped = k.replace(/[\s()-]/g, '').toLowerCase();
    return stripped.startsWith(normalized) && normalized.length >= 3;
  });
  if (candidates.length === 1) return { code: candidates[0], ...window.NY_VTL_CODES[candidates[0]] };
  return null;
};
