import { mathemagineAuth as auth } from "./mathemagineAuth";
import { exportLearning, importLearning, learningAccount, type CloudRecord } from "./academiaStore";
let running:Promise<void>|null=null;
export function syncLearning() {
 if(running) return running;
 running=(async()=>{
  const {data:{session}}=await auth.auth.getSession(); const id=session?.user.id;
  if(!id || learningAccount()!==id) return;
  const {data,error}=await auth.from("mathemagine_progress").select("kind,key,value,updated_at").eq("user_id",id).limit(10000);
  if(error) throw error; if(learningAccount()!==id) return;
  await importLearning((data??[]) as CloudRecord[],id);
  const local=await exportLearning(); if(learningAccount()!==id) return;
  if(local.length) {const {error}=await auth.from("mathemagine_progress").upsert(local.map(r=>({...r,user_id:id})),{onConflict:"user_id,kind,key"});if(error) throw error;}

 })().finally(()=>{running=null;});return running;
}
