import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type User={id:string;email:string;passwordHash:string;salt:string;createdAt:string};
type Session={id:string;userId:string;expiresAt:string};
const file=resolve(process.env.AI_SECRETARY_DATA_DIR??"./data","auth.json");
const users=new Map<string,User>(),sessions=new Map<string,Session>();
function sessionKey(id:string){return scryptSync(id,"ai-secretary-session",32).toString("hex")}
function persist(){try{mkdirSync(dirname(file),{recursive:true});const tmp=file+".tmp";writeFileSync(tmp,JSON.stringify({users:[...users.values()],sessions:[...sessions.values()]}),"utf8");renameSync(tmp,file)}catch{}}
function hydrate(){try{if(!existsSync(file))return;const d=JSON.parse(readFileSync(file,"utf8"));for(const u of d.users??[])users.set(u.id,u);for(const s of d.sessions??[])if(Date.parse(s.expiresAt)>Date.now()){const key=s.id.length===64?s.id:sessionKey(s.id);sessions.set(key,{...s,id:key})}}catch{}}
function hash(p:string,s:string){return scryptSync(p,s,64).toString("hex")}
function pub(u:User){return{id:u.id,email:u.email,createdAt:u.createdAt}}
hydrate();
export function register(email:string,password:string){email=email.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))throw new Error("A valid email is required.");if(password.length<8)throw new Error("Password must be at least 8 characters.");if([...users.values()].some(u=>u.email===email))throw new Error("An account with that email already exists.");const id=crypto.randomUUID(),salt=randomBytes(16).toString("hex");const u={id,email,passwordHash:hash(password,salt),salt,createdAt:new Date().toISOString()};users.set(id,u);persist();return pub(u)}
export function login(email:string,password:string){email=email.trim().toLowerCase();const u=[...users.values()].find(x=>x.email===email);if(!u)throw new Error("Invalid email or password.");const a=Buffer.from(hash(password,u.salt),"hex"),b=Buffer.from(u.passwordHash,"hex");if(a.length!==b.length||!timingSafeEqual(a,b))throw new Error("Invalid email or password.");const s={id:randomBytes(32).toString("hex"),userId:u.id,expiresAt:new Date(Date.now()+30*24*60*60*1000).toISOString()};sessions.set(sessionKey(s.id),{...s,id:sessionKey(s.id)});persist();return{user:pub(u),sessionId:s.id}}
export function userFromSession(id:string|undefined){if(!id)return;const key=sessionKey(id),s=sessions.get(key);if(!s)return;if(Date.parse(s.expiresAt)<=Date.now()){sessions.delete(key);persist();return}const u=users.get(s.userId);return u?pub(u):undefined}
export function logout(id:string|undefined){if(id){sessions.delete(sessionKey(id));persist()}}
export function sessionCookie(id:string,maxAge=2592000){const secure=process.env.NODE_ENV==="production"?" Secure":"";return `ai_secretary_session=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`}
export function clearSessionCookie(){return "ai_secretary_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"}
