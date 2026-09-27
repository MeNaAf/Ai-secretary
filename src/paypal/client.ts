import { config } from "../config.js";
const DEFAULT_BASE="https://api-m.paypal.com";
let tokenCache:{accessToken:string;expiresAt:number}|null=null;
function baseUrl(){return(process.env.PAYPAL_BASE_URL||DEFAULT_BASE).replace(/\/$/,"")}
function requireCredentials(){if(!config.paypalClientId||!config.paypalClientSecret)throw new Error("PayPal server credentials are not configured.")}
async function getAccessToken(){
  requireCredentials();
  if(tokenCache&&tokenCache.expiresAt>Date.now()+30000)return tokenCache.accessToken;
  const basic=Buffer.from(config.paypalClientId+":"+config.paypalClientSecret).toString("base64");
  const response=await fetch(baseUrl()+"/v1/oauth2/token",{method:"POST",headers:{Authorization:"Basic "+basic,"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},body:"grant_type=client_credentials"});
  const data=await response.json().catch(()=>({})) as {access_token?:string;expires_in?:number;error_description?:string};
  if(!response.ok||!data.access_token)throw new Error(data.error_description||"PayPal authentication failed.");
  tokenCache={accessToken:data.access_token,expiresAt:Date.now()+Math.max(60,data.expires_in??300)*1000};
  return data.access_token;
}
async function paypalRequest<T>(path:string,init:RequestInit={}){
  const accessToken=await getAccessToken();
  const response=await fetch(baseUrl()+path,{...init,headers:{Accept:"application/json","Content-Type":"application/json",Authorization:"Bearer "+accessToken,...(init.headers??{})}});
  const data=await response.json().catch(()=>({})) as T & {message?:string;name?:string};
  if(!response.ok)throw new Error(data.message||data.name||"PayPal request failed ("+response.status+").");
  return data;
}
export type PayPalSubscription={id?:string;status?:string;plan_id?:string;start_time?:string;status_update_time?:string;billing_info?:{next_billing_time?:string};subscriber?:{email_address?:string;payer_id?:string};custom_id?:string};
export async function getSubscription(id:string){return paypalRequest<PayPalSubscription>("/v1/billing/subscriptions/"+encodeURIComponent(id)+"?fields=plan,last_failed_payment")}
export async function cancelSubscription(id:string){await paypalRequest<void>("/v1/billing/subscriptions/"+encodeURIComponent(id)+"/cancel",{method:"POST",body:JSON.stringify({reason:"User cancelled AI Secretary Pro subscription."})})}
export async function verifyWebhook(headers:Record<string,string>,webhookEvent:unknown){
  if(!config.paypalWebhookId)throw new Error("PAYPAL_WEBHOOK_ID is not configured.");
  const required=["paypal-transmission-id","paypal-transmission-time","paypal-cert-url","paypal-auth-algo","paypal-transmission-sig"];
  for(const key of required)if(!headers[key])return false;
  const result=await paypalRequest<{verification_status?:string}>("/v1/notifications/verify-webhook-signature",{method:"POST",body:JSON.stringify({auth_algo:headers["paypal-auth-algo"],cert_url:headers["paypal-cert-url"],transmission_id:headers["paypal-transmission-id"],transmission_sig:headers["paypal-transmission-sig"],transmission_time:headers["paypal-transmission-time"],webhook_id:config.paypalWebhookId,webhook_event:webhookEvent})});
  return result.verification_status==="SUCCESS";
}