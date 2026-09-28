// @ts-check

/**
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunInput} CartDeliveryOptionsTransformRunInput
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunResult} CartDeliveryOptionsTransformRunResult
 */

/**
 * @type {CartDeliveryOptionsTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * The aliases used in cart_delivery_options_transform_run.graphql for the
 * fixed-handle "Municipality Zone" metaobjects under `shop`. Keep this in
 * sync with the query when adding/removing a zone.
 */
const ZONE_ALIASES = [
  "antioquiaMedellin",
  "sanAndres",
  "caliManizalesPereira",
  "nacional",
  "choco",
];

function normalize(text) {
  return (text ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * @param {CartDeliveryOptionsTransformRunInput["shop"]} shop
 */
function readZones(shop) {
  return ZONE_ALIASES.map((alias) => /** @type {any} */ (shop)?.[alias])
    .filter(Boolean)
    .map((metaobject) => {
      const config = metaobject.config?.jsonValue ?? {};
      return {
        zoneKeyword: normalize(config.zoneKeyword),
        municipalities: /** @type {string[]} */ (
          config.municipalities ?? []
        ).map(normalize),
      };
    })
    .filter((zone) => zone.zoneKeyword);
}

/**
 * Returns the zone keyword a rate title belongs to, or undefined. A title can
 * mention more than one keyword (e.g. "Nacional (Excepto San Andrés ...)"),
 * so the keyword that appears earliest wins, and the longest one on a tie.
 *
 * @param {string} title normalized rate title
 * @param {string[]} keywords normalized zone keywords
 */
function keywordForTitle(title, keywords) {
  let best;
  let bestIndex = Infinity;
  for (const keyword of keywords) {
    const index = title.indexOf(keyword);
    if (index === -1) continue;
    if (
      index < bestIndex ||
      (index === bestIndex && keyword.length > (best?.length ?? 0))
    ) {
      best = keyword;
      bestIndex = index;
    }
  }
  return best;
}

/**
 * @param {CartDeliveryOptionsTransformRunInput} input
 * @returns {CartDeliveryOptionsTransformRunResult}
 */
export function cartDeliveryOptionsTransformRun(input) {
  const zones = readZones(input.shop);
  if (zones.length === 0) {
    return NO_CHANGES;
  }

  const knownKeywords = zones.map((zone) => zone.zoneKeyword);
  const operations = [];

  for (const group of input.cart.deliveryGroups) {
    const city = normalize(group.deliveryAddress?.city);

    // A zone with an empty municipalities list is the catch-all/default
    // (e.g. "Nacional"): it matches any city not covered by a more specific
    // zone.
    const specificMatch = zones.find(
      (zone) =>
        zone.municipalities.length > 0 && zone.municipalities.includes(city),
    );
    const fallbackMatch = zones.find(
      (zone) => zone.municipalities.length === 0,
    );
    const matchedZone = specificMatch ?? fallbackMatch;

    if (!matchedZone) {
      // No zone recognizes this city. Leave every option as-is rather than
      // risk hiding everything and leaving the customer unable to check out.
      continue;
    }

    for (const option of group.deliveryOptions) {
      const title = normalize(option.title);
      const optionZoneKeyword = keywordForTitle(title, knownKeywords);

      // Only touch delivery options that belong to one of our known zones;
      // leave unrelated options (e.g. local pickup) untouched.
      if (optionZoneKeyword && optionZoneKeyword !== matchedZone.zoneKeyword) {
        operations.push({
          deliveryOptionHide: { deliveryOptionHandle: option.handle },
        });
      }
    }
  }

  return operations.length > 0 ? { operations } : NO_CHANGES;
}
