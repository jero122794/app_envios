// Keep these handles in sync with the aliases used in
// extensions/municipality-delivery-filter/src/cart_delivery_options_transform_run.graphql
// The function can only read metaobjects by fixed handle, so the set of zones
// is fixed here; their contents are editable from the app.
export const DEFAULT_ZONES = [
  {
    handle: "antioquia-medellin",
    zoneLabel: "Antioquia - Medellín",
    zoneKeyword: "medellin",
    municipalities: [
      "Medellín",
      "Envigado",
      "Itagüí",
      "Sabaneta",
      "Bello",
      "La Estrella",
      "Caldas",
      "Copacabana",
      "Girardota",
      "Barbosa",
    ],
  },
  {
    handle: "san-andres",
    zoneLabel: "Archipiélago de San Andrés, Providencia y Santa Catalina",
    zoneKeyword: "san andres",
    municipalities: ["San Andrés", "Providencia", "Santa Catalina"],
  },
  {
    handle: "cali-manizales-pereira",
    zoneLabel: "Cali, Manizales y Pereira",
    zoneKeyword: "cali manizales pereira",
    municipalities: ["Cali", "Manizales", "Pereira"],
  },
  {
    handle: "nacional",
    zoneLabel: "Nacional (Excepto San Andrés y zonas de difícil acceso)",
    zoneKeyword: "nacional",
    // Empty municipalities = catch-all/default zone in the function's logic.
    municipalities: [],
  },
  {
    handle: "choco",
    zoneLabel: "Zonas Envío (Chocó)",
    zoneKeyword: "choco",
    municipalities: ["Quibdó", "Istmina", "Condoto", "Tadó"],
  },
];

export const ZONE_HANDLES = DEFAULT_ZONES.map((zone) => zone.handle);

export const FUNCTION_HANDLE = "municipality-delivery-filter";
export const CUSTOMIZATION_TITLE = "Envíos por municipio";

const UPSERT_ZONE_MUTATION = `#graphql
  mutation UpsertMunicipalityZone($handle: MetaobjectHandleInput!, $values: JSON!) {
    metaobjectUpsert(handle: $handle, values: $values) {
      metaobject {
        id
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const LIST_ZONES_QUERY = `#graphql
  query MunicipalityZones {
    metaobjects(type: "$app:municipality_zone", first: 50) {
      nodes {
        handle
        zoneLabel: field(key: "zone_label") {
          value
        }
        config: field(key: "config") {
          jsonValue
        }
      }
    }
  }
`;

const LIST_CUSTOMIZATIONS_QUERY = `#graphql
  query DeliveryCustomizations {
    deliveryCustomizations(first: 25) {
      nodes {
        id
        title
        enabled
        shopifyFunction {
          handle
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

export async function listZones(admin) {
  const response = await admin.graphql(LIST_ZONES_QUERY);
  const json = await response.json();
  const saved = new Map(
    (json.data?.metaobjects?.nodes ?? []).map((node) => [node.handle, node]),
  );

  return DEFAULT_ZONES.map((defaults) => {
    const node = saved.get(defaults.handle);
    const config = node?.config?.jsonValue ?? {};
    return {
      handle: defaults.handle,
      exists: Boolean(node),
      zoneLabel: node?.zoneLabel?.value ?? defaults.zoneLabel,
      zoneKeyword: config.zoneKeyword ?? defaults.zoneKeyword,
      municipalities: config.municipalities ?? defaults.municipalities,
    };
  });
}

export async function upsertZone(admin, zone) {
  const response = await admin.graphql(UPSERT_ZONE_MUTATION, {
    variables: {
      handle: { type: "$app:municipality_zone", handle: zone.handle },
      values: {
        zone_label: zone.zoneLabel,
        config: JSON.stringify({
          zoneKeyword: zone.zoneKeyword,
          municipalities: zone.municipalities,
          price: null,
        }),
      },
    },
  });
  const json = await response.json();
  return json.data?.metaobjectUpsert?.userErrors ?? [];
}

/**
 * Returns this app's delivery customization, `null` if it hasn't been
 * created yet, or `{ error }` when the query fails (typically because the
 * merchant hasn't approved the delivery customization scope yet).
 */
export async function getCustomization(admin) {
  try {
    const response = await admin.graphql(LIST_CUSTOMIZATIONS_QUERY);
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

export async function setCustomizationEnabled(admin, enabled) {
  const existing = await getCustomization(admin);
  if (existing?.error) {
    return [{ message: existing.error }];
  }

  const response = existing
    ? await admin.graphql(UPDATE_CUSTOMIZATION_MUTATION, {
        variables: { id: existing.id, input: { enabled } },
      })
    : await admin.graphql(CREATE_CUSTOMIZATION_MUTATION, {
        variables: {
          input: {
            functionHandle: FUNCTION_HANDLE,
            title: CUSTOMIZATION_TITLE,
            enabled,
          },
        },
      });
  const json = await response.json();
  const payload =
    json.data?.deliveryCustomizationUpdate ??
    json.data?.deliveryCustomizationCreate;
  return payload?.userErrors ?? json.errors ?? [];
}

export function parseMunicipalities(text) {
  return (text ?? "")
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter(Boolean);
}
