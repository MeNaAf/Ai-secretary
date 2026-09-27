import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
export type SubscriptionStatus = "APPROVAL_PENDING" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED" | "INACTIVE";
export type SubscriptionRecord = { userId:string; paypalSubscriptionId:string; paypalPlanId:string; status:SubscriptionStatus; startTime?:string; nextBillingTime?:string; statusUpdateTime?:string; subscriberEmail?:string; createdAt:string; updatedAt:string };
type CheckoutToken={token:string;userId:string;createdAt:string;expiresAt:string;consumedAt?:string};
type BillingSnapshot={subscriptions:SubscriptionRecord[];checkouts:CheckoutToken[];webhookEvents:string[]};
const file=resolve(process.env.AI_SECRETARY_DATA_DIR??"./data","billing.json");
const subscriptions=new Map<string,SubscriptionRecord>(),checkouts=new Map<string,CheckoutToken>(),webhookEvents=new Set<string>();
function persist(){try{mkdirSync(dirname(file),{recursive:true});const temp=file+".tmp";const snapshot:BillingSnapshot={subscriptions:[...subscriptions.values()],checkouts:[...checkouts.values()],webhookEvents:[...webhookEvents]};writeFileSync(temp,JSON.stringify(snapshot),"utf8");renameSync(temp,file)}catch{}}
function hydrate(){try{if(!existsSync(file))return;const data=JSON.parse(readFileSync(file,"utf8")) as Partial<BillingSnapshot>;for(const item of data.subscriptions??[])subscriptions.set(item.paypalSubscriptionId,item);for(const item of data.checkouts??[])if(Date.parse(item.expiresAt)>Date.now()&&!item.consumedAt)checkouts.set(item.token,item);for(const id of data.webhookEvents??[])webhookEvents.add(id)}catch{}}
hydrate();
export function createCheckoutToken(userId:string){const now=new Date();const item={token:randomBytes(24).toString("base64url"),userId,createdAt:now.toISOString(),expiresAt:new Date(now.getTime()+15*60*1000).toISOString()};checkouts.set(item.token,item);persist();return item}
export function consumeCheckoutToken(token:string,userId:string){const item=checkouts.get(token);if(!item||item.userId!==userId||item.consumedAt||Date.parse(item.expiresAt)<=Date.now())return false;item.consumedAt=new Date().toISOString();persist();return true}
export function getSubscriptionForUser(userId:string){return [...subscriptions.values()].find(item=>item.userId===userId)}
export function getSubscriptionByPayPalId(id:string){return subscriptions.get(id)}
export function upsertSubscription(input:Omit<SubscriptionRecord,"createdAt"|"updatedAt">){const existing=subscriptions.get(input.paypalSubscriptionId);const item={...input,createdAt:existing?.createdAt??new Date().toISOString(),updatedAt:new Date().toISOString()};subscriptions.set(item.paypalSubscriptionId,item);persist();return item}
export function hasActiveSubscription(userId:string){return getSubscriptionForUser(userId)?.status==="ACTIVE"}
export function recordWebhookEvent(id:string){if(webhookEvents.has(id))return false;webhookEvents.add(id);persist();return true}
export function hasWebhookEvent(id:string){return webhookEvents.has(id)}