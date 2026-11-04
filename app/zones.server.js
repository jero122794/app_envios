import { sameKeyword } from "./zone-matching";

// Colombian departments as Shopify's checkout reports them in
// `deliveryAddress.provinceCode` (ISO 3166-2:CO without the "CO-" prefix).
export const DEPARTMENTS = [
  { code: "AMA", name: "Amazonas" },
  { code: "ANT", name: "Antioquia" },
  { code: "ARA", name: "Arauca" },
  { code: "ATL", name: "Atlántico" },
  { code: "DC", name: "Bogotá D.C." },
  { code: "BOL", name: "Bolívar" },
  { code: "BOY", name: "Boyacá" },
  { code: "CAL", name: "Caldas" },
  { code: "CAQ", name: "Caquetá" },
  { code: "CAS", name: "Casanare" },
  { code: "CAU", name: "Cauca" },
  { code: "CES", name: "Cesar" },
  { code: "CHO", name: "Chocó" },
  { code: "COR", name: "Córdoba" },
  { code: "CUN", name: "Cundinamarca" },
  { code: "GUA", name: "Guainía" },
  { code: "GUV", name: "Guaviare" },
  { code: "HUI", name: "Huila" },
  { code: "LAG", name: "La Guajira" },
  { code: "MAG", name: "Magdalena" },
  { code: "MET", name: "Meta" },
  { code: "NAR", name: "Nariño" },
  { code: "NSA", name: "Norte de Santander" },
  { code: "PUT", name: "Putumayo" },
  { code: "QUI", name: "Quindío" },
  { code: "RIS", name: "Risaralda" },
  { code: "SAP", name: "San Andrés y Providencia" },
  { code: "SAN", name: "Santander" },
  { code: "SUC", name: "Sucre" },
  { code: "TOL", name: "Tolima" },
  { code: "VAC", name: "Valle del Cauca" },
  { code: "VAU", name: "Vaupés" },
  { code: "VID", name: "Vichada" },
];

const DEPARTMENT_CODES = new Set(DEPARTMENTS.map((d) => d.code));

// Matches the rates in the "Envíos Zonas" shipping profile. A zone with a
// department and no municipalities covers the rest of that department; a
// zone with neither is the national catch-all.
export const DEFAULT_ZONES = [
  {
    label: "Área Metropolitana de Medellín, municipios de Antioquia",
    keyword: "medellin",
    province: "ANT",
    municipalities: [],
  },
  {
    label: "Cali (capital)",
    keyword: "cali",
    province: "VAC",
    municipalities: ["Cali", "Santiago de Cali"],
  },
  {
    label: "Municipios Valle del Cauca",
    keyword: "valle del cauca",
    province: "VAC",
    municipalities: [],
  },
  {
    label: "Pereira (capital)",
    keyword: "pereira",
    province: "RIS",
    municipalities: ["Pereira"],
  },
  {
    label: "Municipios Risaralda",
    keyword: "risaralda",
    province: "RIS",
    municipalities: [],
  },
  {
    label: "Manizales (capital)",
    keyword: "manizales",
    province: "CAL",
    municipalities: ["Manizales"],
  },
  {
    label: "Municipios de Caldas",
    keyword: "caldas",
    province: "CAL",
    municipalities: [],
  },
  {
    label: "Chocó (Quibdó e Istmina)",
    keyword: "choco",
    province: "CHO",
    municipalities: ["Quibdó", "Istmina"],
  },
  {
    label: "San Andrés y Providencia",
    keyword: "san andres",
    province: "SAP",
    municipalities: [],
  },
  {
    label: "Resto del país",
    keyword: "resto del pais",
    province: "",
    municipalities: [],
  },
];

export const FUNCTION_HANDLE = "municipality-delivery-filter";
export const CUSTOMIZATION_TITLE = "Envíos por municipio";
// App-reserved namespace (namespace omitted); read by the function.
const ZONES_METAFIELD_KEY = "zones";

const CUSTOMIZATIONS_QUERY = `#graphql
  query DeliveryCustomizations {
    deliveryCustomizations(first: 25) {
      nodes {
        id
        title
        enabled
        shopifyFunction {
          handle
        }
        zones: metafield(key: "zones") {
          jsonValue
        }
      }
    }
  }
`;

const CREATE_CUSTOMIZATION_MUTATION = `#graphql
  mutation CreateDeliveryCustomization($input: DeliveryCustomizationInput!) {
    deliveryCustomizationCreate(deliveryCustomization: $input) {
      deliveryCustomization {
        id
        enabled
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_CUSTOMIZATION_MUTATION = `#graphql
  mutation UpdateDeliveryCustomization($id: ID!, $input: DeliveryCustomizationInput!) {
    deliveryCustomizationUpdate(id: $id, deliveryCustomization: $input) {
      deliveryCustomization {
        id
        enabled
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const SET_ZONES_MUTATION = `#graphql
  mutation SetZones($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors {
        field
        message
      }
    }
  }
`;

const DELIVERY_PROFILES_QUERY = `#graphql
  query DeliveryProfileRates {
    shop {
      currencyCode
    }
    deliveryProfiles(first: 10) {
      nodes {
        id
        name
        profileLocationGroups {
          locationGroupZones(first: 50) {
            nodes {
              zone {
                id
                name
                countries {
                  code {
                    countryCode
                    restOfWorld
                  }
                  provinces {
                    code
                    name
                  }
                }
              }
              methodDefinitions(first: 50) {
                nodes {
                  id
                  name
                  active
                  rateProvider {
                    ... on DeliveryRateDefinition {
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

function formatPrice({ amount, currencyCode }) {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "code",
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `${amount} ${currencyCode}`;
  }
}

function zonesMetafield(zones) {
  return {
    key: ZONES_METAFIELD_KEY,
    type: "json",
    value: JSON.stringify({ zones }),
  };
}

/**
 * Returns this app's delivery customization, `null` if it hasn't been
 * created yet, or `{ error }` when the query fails (typically because the
 * merchant hasn't approved the delivery customization scope yet).
 */
export async function getCustomization(admin) {
  try {
    const response = await admin.graphql(CUSTOMIZATIONS_QUERY);
    const json = await response.json();
    if (json.errors?.length) {
      return { error: json.errors.map((e) => e.message).join(", ") };
    }
    const nodes = json.data?.deliveryCustomizations?.nodes ?? [];
    return (
      nodes.find((node) => node.shopifyFunction?.handle === FUNCTION_HANDLE) ??
      null
    );
  } catch (error) {
    return { error: error.message ?? String(error) };
  }
}

/** Saved zones, or the defaults when nothing has been saved yet. */
export function zonesFromCustomization(customization) {
  const saved = customization?.zones?.jsonValue?.zones;
  return Array.isArray(saved)
    ? { zones: saved, saved: true }
    : { zones: DEFAULT_ZONES, saved: false };
}

async function createCustomization(admin, { enabled, zones }) {
  const response = await admin.graphql(CREATE_CUSTOMIZATION_MUTATION, {
    variables: {
      input: {
        functionHandle: FUNCTION_HANDLE,
        title: CUSTOMIZATION_TITLE,
        enabled,
        metafields: [zonesMetafield(zones)],
      },
    },
  });
  const json = await response.json();
  return json.data?.deliveryCustomizationCreate?.userErrors ?? json.errors ?? [];
}

export async function saveZones(admin, zones) {
  const existing = await getCustomization(admin);
  if (existing?.error) {
    return [{ message: existing.error }];
  }
  if (!existing) {
    // The zones live on the customization, so create it (still disabled).
    return createCustomization(admin, { enabled: false, zones });
  }

  const response = await admin.graphql(SET_ZONES_MUTATION, {
    variables: {
      metafields: [{ ownerId: existing.id, ...zonesMetafield(zones) }],
    },
  });
  const json = await response.json();
  return json.data?.metafieldsSet?.userErrors ?? json.errors ?? [];
}

export async function setCustomizationEnabled(admin, enabled) {
  const existing = await getCustomization(admin);
  if (existing?.error) {
    return [{ message: existing.error }];
  }
  if (!existing) {
    return createCustomization(admin, {
      enabled,
      zones: zonesFromCustomization(null).zones,
    });
  }

  const response = await admin.graphql(UPDATE_CUSTOMIZATION_MUTATION, {
    variables: { id: existing.id, input: { enabled } },
  });
  const json = await response.json();
  return json.data?.deliveryCustomizationUpdate?.userErrors ?? json.errors ?? [];
}

/**
 * Flattens every shipping rate in the store's delivery profiles, with the
 * Shopify shipping zone it belongs to and that zone's Colombian departments.
 * Returns `{ rates }` or `{ error }` (e.g. missing `read_shipping` scope).
 */
export async function listShippingRates(admin) {
  try {
    const response = await admin.graphql(DELIVERY_PROFILES_QUERY);
    const json = await response.json();
    if (json.errors?.length) {
      return { error: json.errors.map((e) => e.message).join(", ") };
    }

    const rates = [];
    for (const profile of json.data?.deliveryProfiles?.nodes ?? []) {
      for (const group of profile.profileLocationGroups ?? []) {
        for (const groupZone of group.locationGroupZones?.nodes ?? []) {
          const colombia = groupZone.zone?.countries?.find(
            (country) => country.code?.countryCode === "CO",
          );
          if (!colombia) continue;
          const provinces = (colombia?.provinces ?? [])
            .map((province) => province.code?.replace(/^CO-/, ""))
            .filter(Boolean);
          for (const method of groupZone.methodDefinitions?.nodes ?? []) {
            const price = method.rateProvider?.price;
            rates.push({
              id: method.id,
              name: method.name,
              active: method.active,
              price: price ? formatPrice(price) : null,
              profileName: profile.name,
              shippingZoneName: groupZone.zone?.name ?? "",
              provinces,
            });
          }
        }
      }
    }
    return { rates, shopCurrency: json.data?.shop?.currencyCode ?? null };
  } catch (error) {
    return { error: error.message ?? String(error) };
  }
}

export function parseMunicipalities(text) {
  return (text ?? "")
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * Reads the zone rows posted by the settings form (one value per zone for
 * each field, in page order) and validates them.
 */
export function zonesFromFormData(formData) {
  const labels = formData.getAll("label");
  const keywords = formData.getAll("keyword");
  const provinces = formData.getAll("province");
  const municipalities = formData.getAll("municipalities");

  const zones = labels.map((label, i) => ({
    label: String(label).trim(),
    keyword: String(keywords[i] ?? "").trim(),
    province: String(provinces[i] ?? "").trim().toUpperCase(),
    municipalities: parseMunicipalities(municipalities[i]),
  }));

  const errors = [];
  zones.forEach((zone, i) => {
    const name = zone.label || `Zona ${i + 1}`;
    if (!zone.label || !zone.keyword) {
      errors.push({
        message: `${name}: el nombre y la palabra clave son obligatorios.`,
      });
    }
    if (zone.province && !DEPARTMENT_CODES.has(zone.province)) {
      errors.push({ message: `${name}: departamento desconocido.` });
    }
    const duplicate = zones.findIndex(
      (other, j) => j < i && sameKeyword(other.keyword, zone.keyword),
    );
    if (zone.keyword && duplicate !== -1) {
      errors.push({
        message: `${name}: la palabra clave "${zone.keyword}" ya la usa otra zona.`,
      });
    }
  });

  const catchAlls = zones.filter(
    (zone) => !zone.province && zone.municipalities.length === 0,
  );
  if (catchAlls.length > 1) {
    errors.push({
      message:
        "Solo puede haber una zona nacional (sin departamento ni municipios).",
    });
  }

  return { zones, errors };
}
