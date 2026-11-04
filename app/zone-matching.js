// Mirrors the rate-title matching in
// extensions/municipality-delivery-filter/src/cart_delivery_options_transform_run.js
// so the admin can show which zone each shipping rate will belong to at
// checkout. Keep both in sync.

function normalize(text) {
  return (text ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function words(text) {
  return ` ${normalize(text).replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/**
 * Returns the zone whose keyword a rate title belongs to, or undefined. The
 * keyword that appears earliest in the title wins, the longest one on a tie.
 */
export function zoneForRateTitle(title, zones) {
  const normalizedTitle = words(title);
  let best;
  let bestIndex = Infinity;
  let bestLength = 0;
  for (const zone of zones) {
    const keyword = words(zone.keyword);
    if (!keyword.trim()) continue;
    const index = normalizedTitle.indexOf(keyword);
    if (index === -1) continue;
    if (
      index < bestIndex ||
      (index === bestIndex && keyword.length > bestLength)
    ) {
      best = zone;
      bestIndex = index;
      bestLength = keyword.length;
    }
  }
  return best;
}

export function sameKeyword(a, b) {
  return words(a) === words(b);
}
