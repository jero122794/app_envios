/* eslint-disable react/prop-types -- the project does not use prop-types */
import { useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  DEFAULT_ZONES,
  ZONE_HANDLES,
  getCustomization,
  listZones,
  parseMunicipalities,
  setCustomizationEnabled,
  upsertZone,
} from "../zones.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const [zones, customization] = await Promise.all([
    listZones(admin),
    getCustomization(admin),
  ]);

  return { zones, customization };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save-zone") {
    const handle = String(formData.get("handle"));
    if (!ZONE_HANDLES.includes(handle)) {
      return { intent, errors: [{ message: `Zona desconocida: ${handle}` }] };
    }
    const zoneLabel = String(formData.get("zoneLabel") ?? "").trim();
    const zoneKeyword = String(formData.get("zoneKeyword") ?? "").trim();
    if (!zoneLabel || !zoneKeyword) {
      return {
        intent,
        handle,
        errors: [{ message: "El nombre y la palabra clave son obligatorios." }],
      };
    }
    const errors = await upsertZone(admin, {
      handle,
      zoneLabel,
      zoneKeyword,
      municipalities: parseMunicipalities(formData.get("municipalities")),
    });
    return { intent, handle, errors };
  }

  if (intent === "reset-defaults") {
    const errors = [];
    for (const zone of DEFAULT_ZONES) {
      const zoneErrors = await upsertZone(admin, zone);
      errors.push(
        ...zoneErrors.map((e) => ({ message: `${zone.handle}: ${e.message}` })),
      );
    }
    return { intent, errors };
  }

  if (intent === "enable" || intent === "disable") {
    const errors = await setCustomizationEnabled(admin, intent === "enable");
    return { intent, errors };
  }

  return { intent, errors: [{ message: "Acción no válida." }] };
};

const SUCCESS_MESSAGES = {
  "save-zone": "Zona guardada",
  "reset-defaults": "Zonas restauradas a los valores por defecto",
  enable: "Filtro de envíos activado",
  disable: "Filtro de envíos desactivado",
};

function useResultToast(fetcher) {
  const shopify = useAppBridge();
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const { intent, errors } = fetcher.data;
    if (errors?.length) {
      shopify.toast.show(errors.map((e) => e.message).join(" · "), {
        isError: true,
      });
    } else {
      shopify.toast.show(SUCCESS_MESSAGES[intent] ?? "Listo");
    }
  }, [fetcher.state, fetcher.data, shopify]);
}

function StatusSection({ customization }) {
  const fetcher = useFetcher();
  useResultToast(fetcher);
  const busy = fetcher.state !== "idle";

  if (customization?.error) {
    return (
      <s-section heading="Estado del filtro en el checkout">
        <s-banner tone="warning" heading="Faltan permisos">
          <s-paragraph>
            La app necesita el permiso para gestionar personalizaciones de
            envío. Recarga la app y acepta los nuevos permisos cuando Shopify
            los pida.
          </s-paragraph>
          <s-paragraph>
            <s-text tone="subdued">Detalle: {customization.error}</s-text>
          </s-paragraph>
        </s-banner>
      </s-section>
    );
  }

  const enabled = Boolean(customization?.enabled);
  const intent = enabled ? "disable" : "enable";

  return (
    <s-section heading="Estado del filtro en el checkout">
      <s-stack direction="inline" gap="base" alignItems="center">
        {enabled ? (
          <s-badge tone="success">Activo</s-badge>
        ) : (
          <s-badge tone="critical">Inactivo</s-badge>
        )}
        <s-text>
          {enabled
            ? "El checkout solo muestra la tarifa de envío de la zona que corresponde a la ciudad del cliente."
            : "El checkout está mostrando todas las tarifas de envío sin filtrar."}
        </s-text>
      </s-stack>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value={intent} />
        <s-box paddingBlockStart="base">
          <s-button
            type="submit"
            variant={enabled ? "secondary" : "primary"}
            {...(busy ? { loading: true } : {})}
          >
            {enabled ? "Desactivar filtro" : "Activar filtro"}
          </s-button>
        </s-box>
      </fetcher.Form>
    </s-section>
  );
}

function ZoneForm({ zone }) {
  const fetcher = useFetcher();
  useResultToast(fetcher);
  const busy = fetcher.state !== "idle";
  const isCatchAll = zone.municipalities.length === 0;

  return (
    <s-section heading={zone.zoneLabel}>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="save-zone" />
        <input type="hidden" name="handle" value={zone.handle} />
        <s-stack gap="base">
          {!zone.exists && (
            <s-banner tone="info">
              Esta zona todavía no está guardada en la tienda. Guárdala para
              que el checkout la tenga en cuenta.
            </s-banner>
          )}
          <s-text-field
            label="Nombre de la zona"
            name="zoneLabel"
            value={zone.zoneLabel}
            required
          />
          <s-text-field
            label="Palabra clave de la tarifa"
            name="zoneKeyword"
            value={zone.zoneKeyword}
            details="Debe aparecer en el nombre de la tarifa de envío de esta zona, en Configuración → Envíos (no importan mayúsculas ni tildes)."
            required
          />
          <s-text-area
            label="Municipios"
            name="municipalities"
            value={zone.municipalities.join("\n")}
            rows={5}
            details={
              isCatchAll
                ? "Vacío = zona por defecto: aplica a cualquier ciudad que no esté en otra zona."
                : "Uno por línea (o separados por comas). Déjalo vacío para que sea la zona por defecto."
            }
          />
          <s-stack direction="inline" gap="base">
            <s-button
              type="submit"
              variant="primary"
              {...(busy ? { loading: true } : {})}
            >
              Guardar zona
            </s-button>
          </s-stack>
        </s-stack>
      </fetcher.Form>
    </s-section>
  );
}

export default function ShippingSettings() {
  const { zones, customization } = useLoaderData();
  const resetFetcher = useFetcher();
  useResultToast(resetFetcher);

  const resetDefaults = () =>
    resetFetcher.submit({ intent: "reset-defaults" }, { method: "POST" });

  return (
    <s-page heading="Configuración de envíos">
      <s-button
        slot="secondary-actions"
        onClick={resetDefaults}
        {...(resetFetcher.state !== "idle" ? { loading: true } : {})}
      >
        Restaurar valores por defecto
      </s-button>

      <StatusSection customization={customization} />

      {zones.map((zone) => (
        // Re-mount when the saved values change so the uncontrolled fields
        // pick up the new values after a save or reset.
        <ZoneForm
          key={`${zone.handle}:${zone.zoneLabel}:${zone.zoneKeyword}:${zone.municipalities.join("|")}`}
          zone={zone}
        />
      ))}

      <s-section slot="aside" heading="Cómo funciona">
        <s-paragraph>
          En el checkout, la app toma la <b>ciudad</b> de la dirección de
          envío, busca la zona que la incluye y oculta las tarifas de las
          demás zonas.
        </s-paragraph>
        <s-paragraph>
          Una tarifa pertenece a una zona si su nombre contiene la{" "}
          <b>palabra clave</b> de esa zona. Las tarifas que no coinciden con
          ninguna palabra clave (por ejemplo, retiro en tienda) no se tocan.
        </s-paragraph>
        <s-paragraph>
          Las tarifas y sus precios se configuran en{" "}
          <b>Configuración → Envíos y entregas</b>, en el perfil &quot;Envíos
          Zonas&quot;.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
