import { randomBytes,scryptSync,timingSafeEqual } from "node:crypto";
import { existsSync,mkdirSync,readFileSync,renameSync,writeFileSync } from "node:fs";
import { dirname,resolve } from "node:path";
import { db,query } from "../db.js";

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

export async function register(email:string,password:string){
  email=email.trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email))throw new Error("A valid email is required.");
  if(password.length<8)throw new Error("Password must be at least 8 characters.");
  const id=crypto.randomUUID(),salt=randomBytes(16).toString("hex"),createdAt=new Date().toISOString(),passwordHash=hash(password,salt);
  if(db){
    const existing=await query<{id:string}>("SELECT id FROM users WHERE email=$1 LIMIT 1",[email]);
    if(existing[0])throw new Error("An account with that email already exists.");
    await query("INSERT INTO users (id,email,password_hash,salt,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$5)",[id,email,passwordHash,salt,createdAt]);
    return {id,email,createdAt};
  }
  if([...users.values()].some(u=>u.email===email))throw new Error("An account with that email already exists.");
  const u={id,email,passwordHash,salt,createdAt};users.set(id,u);persist();return pub(u);
}

export async function login(email:string,password:string){
  email=email.trim().toLowerCase();
  let u:User|undefined;
  if(db){
    const rows=await query<User>('SELECT id,email,password_hash AS "passwordHash",salt,created_at AS "createdAt" FROM users WHERE email=$1 LIMIT 1',[email]);
    u=rows[0];
  }else u=[...users.values()].find(x=>x.email===email);
  if(!u)throw new Error("Invalid email or password.");
  const a=Buffer.from(hash(password,u.salt),"hex"),b=Buffer.from(u.passwordHash,"hex");
  if(a.length!==b.length||!timingSafeEqual(a,b))throw new Error("Invalid email or password.");
  const s={id:randomBytes(32).toString("hex"),userId:u.id,expiresAt:new Date(Date.now()+2592000000).toISOString()},key=sessionKey(s.id);
  if(db)await query("INSERT INTO sessions (id,user_id,expires_at) VALUES ($1,$2,$3)",[key,u.id,s.expiresAt]);
  else{sessions.set(key,{...s,id:key});persist();}
  return{user:pub(u),sessionId:s.id};
}

export async function userFromSession(id:string|undefined){
  if(!id)return;
  const key=sessionKey(id);
  if(db){
    const rows=await query<{userId:string;expiresAt:string;email:string;createdAt:string}>('SELECT s.user_id AS "userId",s.expires_at AS "expiresAt",u.email,u.created_at AS "createdAt" FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 LIMIT 1',[key]);
    const s=rows[0];if(!s)return;
    if(Date.parse(s.expiresAt)<=Date.now()){await query("DELETE FROM sessions WHERE id=$1",[key]);return;}
    return{id:s.userId,email:s.email,createdAt:s.createdAt};
  }
  const s=sessions.get(key);if(!s)return;
  if(Date.parse(s.expiresAt)<=Date.now()){sessions.delete(key);persist();return}
  const u=users.get(s.userId);return u?pub(u):undefined;
}

export async function logout(id:string|undefined){
  if(!id)return;
  const key=sessionKey(id);
  if(db){await query("DELETE FROM sessions WHERE id=$1",[key]);return;}
  sessions.delete(key);persist();
}

export function sessionCookie(id:string,maxAge=2592000){
  const secure=process.env.NODE_ENV==="production"?" Secure":"";
  return "ai_secretary_session="+id+"; Path=/; HttpOnly; SameSite=Lax; Max-Age="+maxAge+secure
}
export function clearSessionCookie(){return "ai_secretary_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"}
