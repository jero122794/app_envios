/* eslint-disable react/prop-types -- the project does not use prop-types */
import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { zoneForRateTitle } from "../zone-matching";
import {
  DEFAULT_ZONES,
  DEPARTMENTS,
  getCustomization,
  listShippingRates,
  saveZones,
  setCustomizationEnabled,
  zonesFromCustomization,
  zonesFromFormData,
} from "../zones.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const [customization, shipping] = await Promise.all([
    getCustomization(admin),
    listShippingRates(admin),
  ]);
  const { zones, saved } = zonesFromCustomization(
    customization?.error ? null : customization,
  );

  return {
    customization,
    zones,
    saved,
    shipping,
    defaults: DEFAULT_ZONES,
    departments: DEPARTMENTS,
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save-zones") {
    const { zones, errors } = zonesFromFormData(formData);
    if (errors.length) {
      return { intent, errors };
    }
    return { intent, errors: await saveZones(admin, zones) };
  }

  if (intent === "enable" || intent === "disable") {
    const errors = await setCustomizationEnabled(admin, intent === "enable");
    return { intent, errors };
  }

  return { intent, errors: [{ message: "Acción no válida." }] };
};

const SUCCESS_MESSAGES = {
  "save-zones": "Zonas guardadas",
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
            ? "El checkout solo muestra la tarifa de envío de la zona que corresponde a la dirección del cliente."
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

function RatesSection({ shipping, zones, onCreateZone }) {
  if (shipping.error) {
    return (
      <s-section heading="Tarifas del perfil de envío">
        <s-banner tone="warning" heading="No se pudieron leer las tarifas">
          <s-paragraph>
            La app necesita el permiso para leer la configuración de envíos.
            Recarga la app y acepta los nuevos permisos cuando Shopify los
            pida.
          </s-paragraph>
          <s-paragraph>
            <s-text tone="subdued">Detalle: {shipping.error}</s-text>
          </s-paragraph>
        </s-banner>
      </s-section>
    );
  }

  if (shipping.rates.length === 0) {
    return (
      <s-section heading="Tarifas del perfil de envío">
        <s-paragraph>
          No hay tarifas de envío para Colombia en los perfiles de envío de la
          tienda.
        </s-paragraph>
      </s-section>
    );
  }

  return (
    <s-section heading="Tarifas del perfil de envío">
      {shipping.shopCurrency && shipping.shopCurrency !== "COP" && (
        <s-box paddingBlockEnd="base">
          <s-banner tone="critical" heading="La tienda no está en pesos colombianos">
            <s-paragraph>
              La moneda de la tienda es {shipping.shopCurrency}, así que las
              tarifas se cobran en {shipping.shopCurrency}. Cámbiala a COP en
              Configuración → General → Moneda de la tienda.
            </s-paragraph>
          </s-banner>
        </s-box>
      )}
      <s-paragraph>
        Estas son las tarifas para Colombia configuradas en Configuración →
        Envíos y entregas. Cada tarifa debe pertenecer a una zona de la app
        para que el filtro la muestre solo a los clientes de esa zona.
      </s-paragraph>
      <s-table>
        <s-table-header-row>
          <s-table-header listSlot="primary">Tarifa</s-table-header>
          <s-table-header>Zona de envío en Shopify</s-table-header>
          <s-table-header format="currency">Precio</s-table-header>
          <s-table-header listSlot="secondary">Zona de la app</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {shipping.rates.map((rate) => {
            const zone = zoneForRateTitle(rate.name, zones);
            return (
              <s-table-row key={rate.id}>
                <s-table-cell>
                  {rate.name}
                  {!rate.active && (
                    <>
                      {" "}
                      <s-badge>Inactiva</s-badge>
                    </>
                  )}
                </s-table-cell>
                <s-table-cell>
                  {rate.profileName} · {rate.shippingZoneName}
                </s-table-cell>
                <s-table-cell>{rate.price ?? "Calculada"}</s-table-cell>
                <s-table-cell>
                  {zone ? (
                    <s-badge tone="success">{zone.label}</s-badge>
                  ) : (
                    <s-stack direction="inline" gap="small-200">
                      <s-badge tone="warning">Sin zona</s-badge>
                      <s-button
                        variant="tertiary"
                        onClick={() => onCreateZone(rate)}
                      >
                        Crear zona
                      </s-button>
                    </s-stack>
                  )}
                </s-table-cell>
              </s-table-row>
            );
          })}
        </s-table-body>
      </s-table>
      <s-box paddingBlockStart="base">
        <s-text tone="subdued">
          Las tarifas sin zona no se filtran: se muestran a todos los clientes.
        </s-text>
      </s-box>
    </s-section>
  );
}

function ZoneFields({ zone, departments, matchedRates, onRemove }) {
  const isCatchAll = !zone.province && zone.municipalities.length === 0;
  const isDepartmentWide = zone.province && zone.municipalities.length === 0;

  return (
    <s-box
      padding="base"
      border="base"
      borderRadius="base"
      background="subdued"
    >
      <s-stack gap="base">
        <s-stack direction="inline" gap="base" justifyContent="space-between">
          <s-heading>{zone.label || "Nueva zona"}</s-heading>
          <s-button variant="tertiary" tone="critical" onClick={onRemove}>
            Eliminar
          </s-button>
        </s-stack>
        <s-text-field
          label="Nombre de la zona"
          name="label"
          value={zone.label}
          required
        />
        <s-text-field
          label="Palabra clave de la tarifa"
          name="keyword"
          value={zone.keyword}
          details="Debe aparecer en el nombre de la tarifa de esta zona (palabras completas; no importan mayúsculas ni tildes)."
          required
        />
        <s-select label="Departamento" name="province" value={zone.province}>
          <s-option value="">Todo el país (sin departamento)</s-option>
          {departments.map((department) => (
            <s-option key={department.code} value={department.code}>
              {department.name}
            </s-option>
          ))}
        </s-select>
        <s-text-area
          label="Municipios"
          name="municipalities"
          value={zone.municipalities.join("\n")}
          rows={3}
          details={
            isCatchAll
              ? "Sin departamento ni municipios = zona nacional: aplica a toda dirección que no esté en otra zona."
              : isDepartmentWide
                ? "Vacío = todo el departamento, excepto los municipios que tengan su propia zona."
                : "Uno por línea (o separados por comas), como los escriben los clientes en el campo Ciudad."
          }
        />
        {matchedRates &&
          (matchedRates.length > 0 ? (
            <s-text tone="subdued">
              Tarifas de esta zona: {matchedRates.join(" · ")}
            </s-text>
          ) : (
            <s-banner tone="warning">
              Ninguna tarifa del perfil de envío contiene esta palabra clave.
            </s-banner>
          ))}
      </s-stack>
    </s-box>
  );
}

let nextRowId = 0;
const toRows = (zones) => zones.map((zone) => ({ id: nextRowId++, zone }));

export default function ShippingSettings() {
  const { customization, zones, saved, shipping, defaults, departments } =
    useLoaderData();
  const fetcher = useFetcher();
  useResultToast(fetcher);

  // Rows are uncontrolled form fields; the list only tracks which rows exist
  // and their initial values. Reset it whenever the saved zones change (not
  // on every revalidation, which would drop unsaved edits).
  const zonesKey = JSON.stringify(zones);
  const [rows, setRows] = useState(() => toRows(zones));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content
  useEffect(() => setRows(toRows(zones)), [zonesKey]);

  const rowZones = useMemo(() => rows.map((row) => row.zone), [rows]);
  const ratesByZone = useMemo(() => {
    if (!shipping.rates) return null;
    const map = new Map();
    for (const rate of shipping.rates) {
      const zone = zoneForRateTitle(rate.name, rowZones);
      if (zone) map.set(zone, [...(map.get(zone) ?? []), rate.name]);
    }
    return map;
  }, [shipping.rates, rowZones]);

  const addZone = (zone) => setRows((current) => [...current, ...toRows([zone])]);
  const createZoneFromRate = (rate) =>
    addZone({
      label: rate.name,
      keyword: rate.name,
      province: rate.provinces.length === 1 ? rate.provinces[0] : "",
      municipalities: [],
    });

  const busy = fetcher.state !== "idle";

  return (
    <s-page heading="Configuración de envíos">
      <s-button
        slot="secondary-actions"
        onClick={() => setRows(toRows(defaults))}
      >
        Restaurar valores por defecto
      </s-button>

      <StatusSection customization={customization} />

      <RatesSection
        shipping={shipping}
        zones={rowZones}
        onCreateZone={createZoneFromRate}
      />

      <s-section heading="Zonas">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="save-zones" />
          <s-stack gap="base">
            {!saved && (
              <s-banner tone="info">
                Estas zonas todavía no están guardadas en la tienda. Guárdalas
                para que el checkout las tenga en cuenta.
              </s-banner>
            )}
            {rows.map((row) => (
              <ZoneFields
                key={row.id}
                zone={row.zone}
                departments={departments}
                matchedRates={ratesByZone ? (ratesByZone.get(row.zone) ?? []) : null}
                onRemove={() =>
                  setRows((current) => current.filter((r) => r.id !== row.id))
                }
              />
            ))}
            <s-stack direction="inline" gap="base">
              <s-button
                onClick={() =>
                  addZone({
                    label: "",
                    keyword: "",
                    province: "",
                    municipalities: [],
                  })
                }
              >
                Agregar zona
              </s-button>
              <s-button
                type="submit"
                variant="primary"
                {...(busy ? { loading: true } : {})}
              >
                Guardar zonas
              </s-button>
            </s-stack>
          </s-stack>
        </fetcher.Form>
      </s-section>

      <s-section slot="aside" heading="Cómo funciona">
        <s-paragraph>
          En el checkout, la app toma el <b>departamento</b> y la{" "}
          <b>ciudad</b> de la dirección de envío y elige la zona más específica:
        </s-paragraph>
        <s-ordered-list>
          <s-list-item>
            Una zona que lista esa ciudad (por ejemplo, Cali).
          </s-list-item>
          <s-list-item>
            Si no hay, la zona del departamento sin municipios (por ejemplo,
            Municipios Valle del Cauca).
          </s-list-item>
          <s-list-item>
            Si no hay, la zona nacional (sin departamento ni municipios).
          </s-list-item>
        </s-ordered-list>
        <s-paragraph>
          Luego oculta las tarifas de las demás zonas. Una tarifa pertenece a
          una zona si su nombre contiene la <b>palabra clave</b> de esa zona.
          Las tarifas que no coinciden con ninguna palabra clave (por ejemplo,
          retiro en tienda) no se tocan.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
