import type { IncomingMessage, ServerResponse } from "node:http";
import { getSubscription, verifyWebhook } from "../paypal/client.js";
import { getSubscriptionByPayPalId, recordWebhookEvent, upsertSubscription } from "../billing/store.js";
function send(res:ServerResponse,status:number,body:unknown){res.writeHead(status,{"content-type":"application/json; charset=utf-8"});res.end(JSON.stringify(body))}
export async function paypalWebhookResponse(req:IncomingMessage,res:ServerResponse,readBody:(req:IncomingMessage)=>Promise<string>){
  if(req.method!=="POST"||new URL(req.url??"/","http://localhost").pathname!=="/api/paypal/webhook")return false;
  const raw=await readBody(req);let event:any;try{event=JSON.parse(raw)}catch{return send(res,400,{error:"Invalid webhook payload."})}
  const headers:Record<string,string>={};for(const key of ["paypal-transmission-id","paypal-transmission-time","paypal-cert-url","paypal-auth-algo","paypal-transmission-sig"]){const value=req.headers[key];if(typeof value==="string")headers[key]=value}
  try{
    if(!(await verifyWebhook(headers,event)))return send(res,400,{error:"Invalid PayPal webhook signature."});
    if(!event.id||!(await recordWebhookEvent(String(event.id))))return send(res,200,{ok:true,duplicate:true});
    const type=String(event.event_type??"");
    const subscriptionId=event.resource?.id&&type.startsWith("BILLING.SUBSCRIPTION.")?String(event.resource.id):event.resource?.billing_agreement_id?String(event.resource.billing_agreement_id):"";
    if(subscriptionId){const local=await getSubscriptionByPayPalId(subscriptionId);if(local)try{const remote=await getSubscription(subscriptionId);if(remote.plan_id===local.paypalPlanId)await upsertSubscription({...local,status:(remote.status as typeof local.status)||local.status,startTime:remote.start_time??local.startTime,nextBillingTime:remote.billing_info?.next_billing_time??local.nextBillingTime,statusUpdateTime:remote.status_update_time??local.statusUpdateTime,subscriberEmail:remote.subscriber?.email_address??local.subscriberEmail})}catch{}}
    return send(res,200,{ok:true});
  }catch(error){return send(res,500,{error:error instanceof Error?error.message:"Webhook processing failed."})}
}