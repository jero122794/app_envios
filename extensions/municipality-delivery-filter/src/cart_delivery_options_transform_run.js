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

function normalize(text) {
  return (text ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Lowercase words only, padded with spaces so keywords match whole words. */
function words(text) {
  return ` ${normalize(text).replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/** Accepts both "ANT" and "CO-ANT". */
function normalizeProvince(code) {
  return (code ?? "").toString().trim().toUpperCase().replace(/^CO-/, "");
}

/**
 * Stored shape (metafield `zones`, type json):
 * { zones: [{ label, keyword, province, municipalities: string[] }] }
 *
 * @param {any} jsonValue
 */
function readZones(jsonValue) {
  const zones = Array.isArray(jsonValue?.zones) ? jsonValue.zones : [];
  return zones
    .map((zone) => ({
      keyword: words(zone?.keyword),
      province: normalizeProvince(zone?.province),
      municipalities: (Array.isArray(zone?.municipalities)
        ? zone.municipalities
        : []
      ).map(normalize),
    }))
    .filter((zone) => zone.keyword.trim());
}

/**
 * Picks the zone for an address, most specific first:
 * 1. a zone listing the city (and, if it has one, in the same department);
 * 2. a zone for the whole department (department set, no municipalities);
 * 3. the national catch-all (no department, no municipalities).
 *
 * @param {ReturnType<typeof readZones>} zones
 * @param {string} city normalized city
 * @param {string} province normalized province code
 */
function zoneForAddress(zones, city, province) {
  const sameProvince = (zone) =>
    !zone.province || !province || zone.province === province;

  return (
    zones.find(
      (zone) =>
        zone.municipalities.length > 0 &&
        zone.municipalities.includes(city) &&
        sameProvince(zone),
    ) ??
    (province
      ? zones.find(
          (zone) =>
            zone.municipalities.length === 0 && zone.province === province,
        )
      : undefined) ??
    zones.find((zone) => zone.municipalities.length === 0 && !zone.province)
  );
}

/**
 * Returns the zone keyword a rate title belongs to, or undefined. A title can
 * mention more than one keyword (e.g. "Nacional (Excepto San Andrés ...)"),
 * so the keyword that appears earliest wins, and the longest one on a tie.
 *
 * @param {string} title rate title passed through `words`
 * @param {string[]} keywords keywords passed through `words`
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
  const zones = readZones(input.deliveryCustomization?.zones?.jsonValue);
  if (zones.length === 0) {
    return NO_CHANGES;
  }

  const knownKeywords = zones.map((zone) => zone.keyword);
  const operations = [];

  for (const group of input.cart.deliveryGroups) {
    const matchedZone = zoneForAddress(
      zones,
      normalize(group.deliveryAddress?.city),
      normalizeProvince(group.deliveryAddress?.provinceCode),
    );

    if (!matchedZone) {
      // No zone recognizes this address. Leave every option as-is rather than
      // risk hiding everything and leaving the customer unable to check out.
      continue;
    }

    for (const option of group.deliveryOptions) {
      const optionZoneKeyword = keywordForTitle(
        words(option.title),
        knownKeywords,
      );

      // Only touch delivery options that belong to one of our known zones;
      // leave unrelated options (e.g. local pickup) untouched.
      if (optionZoneKeyword && optionZoneKeyword !== matchedZone.keyword) {
        operations.push({
          deliveryOptionHide: { deliveryOptionHandle: option.handle },
        });
      }
    }
  }

  return operations.length > 0 ? { operations } : NO_CHANGES;
}
