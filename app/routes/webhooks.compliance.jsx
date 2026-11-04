import { authenticate } from "../shopify.server";
import db from "../db.server";

// Mandatory privacy webhooks. The app stores no customer data: its only
// records are the shop's OAuth sessions (deleted on shop/redact). The zone
// configuration lives in the shop itself, on the delivery customization.
// `authenticate.webhook` verifies the HMAC and rejects invalid requests.
export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (topic === "SHOP_REDACT") {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
