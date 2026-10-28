import { normalizeCanvas } from "@/lib/games/types";
import { normalizeAudio } from "@/lib/academia/adventureMix";
import { adventureMediaPaths, copiedAdventureQuestion } from "@/lib/offline/extendedActivities";
/** Called only after the guest gateway has authorised this Session. */
export async function guestExtendedActivity(admin:any,a:any) {
 if(a.kind==="mcq") {
  const [{data:items},{data:paper}]=await Promise.all([
   admin.from("academia_mcq_items").select("id,n,text,options,answer").eq("activity_id",a.id).order("position"),
   admin.from("academia_mcq_papers").select("questions").eq("id",a.ref_id).maybeSingle(),
  ]);
  return {mcq:{id:a.id,title:a.title,questions:(items??[]).map((q:any)=>({...q,arenaId:q.id,solution:paper?.questions?.find((p:any)=>p.n===q.n)?.solution??null}))}};
 }
 if(a.kind!=="adventure")return {};
 const [{data:video},{data:questions},{data:points},{withDb},{loadGame}]=await Promise.all([
  admin.from("games").select("id,canvas").eq("id",a.ref_id).maybeSingle(),
  admin.from("academia_adventure_questions").select("*").eq("activity_id",a.id).order("position"),
  admin.from("academia_adventure_points").select("scene_id,pass_pct").eq("activity_id",a.id),
  import("@/lib/db/scope"),import("@/lib/slate/storage"),
 ]);
 if(!video)return {};
 const game=a.game_id?await withDb(admin,()=>loadGame(a.game_id)):null;
 const audio=normalizeAudio(a.audio),canvas=normalizeCanvas(video.canvas);
 const paths=new Set(adventureMediaPaths(video.canvas,a.audio));
 const visit=(v:any)=>{if(!v||typeof v!=="object")return;for(const [k,x]of Object.entries(v)){
  if(typeof x==="string" && ["assetId","path"].includes(k) && x.includes("/")&&!/^https?:/.test(x))paths.add(x);
  else if(x&&typeof x==="object")visit(x);
 }};visit(game);
 const assetUrls:Record<string,string>={};await Promise.all([...paths].map(async path=>{const {data}=await admin.storage.from("game-assets").createSignedUrl(path,14400);if(data?.signedUrl)assetUrls[path]=data.signedUrl;}));
 const convert=(v:any):any=>Array.isArray(v)?v.map(convert):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,convert(x)])):typeof v==="string"&&assetUrls[v]?assetUrls[v]:v;
 const ready=convert(canvas);if(ready.video)ready.video.source="url";ready.narrations=(ready.narrations??[]).map((n:any)=>({...n,source:"url"}));
 return {adventure:{id:video.id,canvas:ready,questions:(questions??[]).map(copiedAdventureQuestion),pass:Object.fromEntries((points??[]).map((p:any)=>[p.scene_id,p.pass_pct])),game,audio:convert(audio),assetUrls}};
}
