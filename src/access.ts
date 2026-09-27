import { hasActiveSubscription } from "./billing/store.js";
export function requireActiveSubscription(userId:string){
  if(hasActiveSubscription(userId))return;
  const error=new Error("AI Secretary Pro subscription required.");
  (error as Error & {statusCode?:number;code?:string}).statusCode=402;
  (error as Error & {statusCode?:number;code?:string}).code="SUBSCRIPTION_REQUIRED";
  throw error;
}