import "dotenv/config";
const port=Number(process.env.PORT??3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error("PORT must be a valid TCP port.");
export const config={port,openRouterApiKey:process.env.OPENROUTER_API_KEY??"",openRouterModel:process.env.OPENROUTER_MODEL??"openrouter/free",composioApiKey:process.env.COMPOSIO_API_KEY??"",paypalClientId:process.env.PAYPAL_CLIENT_ID??"",paypalClientSecret:process.env.PAYPAL_CLIENT_SECRET??"",paypalPlanId:process.env.PAYPAL_PLAN_ID??"P-8SC10898FX170705XNK4PPNQ",paypalWebhookId:process.env.PAYPAL_WEBHOOK_ID??"",appOrigin:process.env.APP_ORIGIN??""};
