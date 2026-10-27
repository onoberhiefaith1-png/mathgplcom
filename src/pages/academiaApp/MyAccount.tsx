import { useEffect, useState } from "react";
import { mathemagineAuth as auth } from "@/lib/offline/mathemagineAuth";
import { switchLearningAccount } from "@/lib/offline/academiaStore";
import { syncLearning } from "@/lib/offline/accountSync";
type SessionChoice={id:string;title:string;trail:string};
export default function MyAccount({sessions,onSchools,onChanged}:{sessions:SessionChoice[];onSchools:()=>void;onChanged:()=>void}) {
 const [user,setUser]=useState<{id:string;email?:string}|null>(null),[profile,setProfile]=useState<any>(null);
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[role,setRole]=useState("student");
 const [signup,setSignup]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [students,setStudents]=useState<any[]>([]),[assignments,setAssignments]=useState<any[]>([]),[shares,setShares]=useState<any[]>([]);
 const [studentId,setStudentId]=useState(""),[sessionId,setSessionId]=useState(""),[title,setTitle]=useState("My class");
 const [entryName,setEntryName]=useState("required"),[entryPhoto,setEntryPhoto]=useState("off"),[shareId,setShareId]=useState("");
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setNotice("");try{await fn();}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}};
 const load=async(id:string)=>{
  const [a,b,c]=await Promise.all([auth.from("mathemagine_students").select("*").or(`teacher_id.eq.${id},student_id.eq.${id}`),auth.from("mathemagine_assignments").select("*").or(`teacher_id.eq.${id},student_id.eq.${id}`).order("created_at",{ascending:false}),auth.from("arena_shares").select("id,code,display_code,title").eq("owner_id",id).order("created_at",{ascending:false})]);
  if(a.error) throw a.error; if(b.error) throw b.error;
  setStudents(a.data??[]);setAssignments(b.data??[]);setShares(c.data??[]);
 };
 useEffect(()=>{
  let alive=true;
  const activate=async(u:any)=>{
   await switchLearningAccount(u?.id??null,!!u);if(!alive)return;setUser(u);setProfile(null);onChanged();
   if(u){
    let {data,error}=await auth.from("mathemagine_profiles").select("*").eq("user_id",u.id).maybeSingle();
    if(error)throw error;
    if(!data && u.user_metadata?.mm_role){const created=await auth.from("mathemagine_profiles").insert({user_id:u.id,role:u.user_metadata?.mm_role==="teacher"?"teacher":"student",display_name:u.user_metadata?.mm_name||"Learner"}).select().single();if(created.error)throw created.error;data=created.data;}
    if(!alive)return;setProfile(data);await syncLearning();await load(u.id);
   }
   onChanged();
  };
  void auth.auth.getSession().then(({data})=>activate(data.session?.user)).catch(e=>setNotice(e.message));
  const {data:{subscription}}=auth.auth.onAuthStateChange((event,s)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT")setTimeout(()=>{if(alive)void activate(s?.user).catch(e=>setNotice(e.message));},0);});
  const refresh=()=>{if(navigator.onLine)void syncLearning().then(onChanged).catch(()=>{});};
  const tick=setInterval(refresh,20000);let pending:ReturnType<typeof setTimeout>|undefined;
  const changed=()=>{clearTimeout(pending);pending=setTimeout(refresh,1500);};
  window.addEventListener("mathemagine:progress",changed);window.addEventListener("online",refresh);
  return()=>{alive=false;subscription.unsubscribe();clearInterval(tick);clearTimeout(pending);window.removeEventListener("mathemagine:progress",changed);window.removeEventListener("online",refresh);};
 },[]);
 const submit=()=>run(async()=>{
  if(signup){const {data,error}=await auth.auth.signUp({email:email.trim(),password,options:{data:{mm_role:role,mm_name:name.trim()||"Learner"}}});if(error)throw error;if(!data.session)setNotice("Check your email to confirm your account, then sign in here.");}
  else {const {error}=await auth.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;}
  setPassword("");
 });
 const origin=typeof window!=="undefined"?window.location.origin:"";
 const btn="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50";
 const input="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
 return <section className="mx-auto max-w-3xl space-y-5 p-4">
  <h1 className="text-2xl font-bold">My account</h1>
  <p className="text-sm text-muted-foreground">Practise immediately without signing in. Create an account to carry your learning history between devices.</p>
  <button className={btn} onClick={onSchools}>Manage saved schools</button>
  {notice&&<p role="status" className="rounded-xl border border-border p-3 text-sm">{notice}</p>}
  {!user?<form className="space-y-3 rounded-2xl border border-border p-4" onSubmit={e=>{e.preventDefault();void submit();}}>
   <h2 className="font-bold">{signup?"Create your Mathemagine account":"Sign in to Mathemagine"}</h2>
   {signup&&<><label className="block">Your name<input className={input} value={name} onChange={e=>setName(e.target.value)} required maxLength={60}/></label><label className="block">Account type<select className={input} value={role} onChange={e=>setRole(e.target.value)}><option value="student">Student</option><option value="teacher">Teacher</option></select></label></>}
   <label className="block">Email / Gmail<input type="email" autoComplete="email" className={input} value={email} onChange={e=>setEmail(e.target.value)} required/></label>
   <label className="block">Password<input type="password" autoComplete={signup?"new-password":"current-password"} minLength={8} className={input} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
   <button disabled={busy||(typeof navigator !== "undefined" && !navigator.onLine)} className={btn}>{busy?"Please wait…":signup?"Sign up":"Sign in"}</button>
   <button type="button" className={btn} onClick={()=>setSignup(!signup)}>{signup?"I already have an account":"Create an account"}</button>
   <p className="text-xs text-muted-foreground">Internet is needed for sign-in and syncing. Offline practice remains available.</p>
  </form>:<>
   <div className="rounded-2xl border border-border p-4 space-y-2"><h2 className="font-bold">{profile?.display_name??user.email} · {profile?.role??"Account"}</h2><p className="break-all text-xs">My student/account ID: {user.id}</p><button disabled={busy} className={btn} onClick={()=>void run(async()=>{await syncLearning();await load(user.id);onChanged();setNotice("Learning history and workspace synced.");})}>Sync learning history</button> <button className={btn} onClick={()=>void run(async()=>{try{await syncLearning();}catch{} await auth.auth.signOut({scope:"local"});})}>Sign out</button></div>
   {!profile&&<div className="rounded-xl border border-border p-4"><label>Choose your Mathemagine account type<select className={input} value={role} onChange={e=>setRole(e.target.value)}><option value="student">Student</option><option value="teacher">Teacher</option></select></label><button className={btn} disabled={busy} onClick={()=>void run(async()=>{const {data,error}=await auth.from("mathemagine_profiles").insert({user_id:user.id,role,display_name:name.trim()||"Learner"}).select().single();if(error)throw error;setProfile(data);await load(user.id);})}>Create my workspace</button></div>}
   {profile?.role==="teacher"&&<div className="rounded-2xl border border-border p-4 space-y-3">
    <h2 className="text-lg font-bold">Teacher workspace</h2>
    <p className="text-sm">Choose existing public activities and create a fresh class link. Each link has its own students and report.</p>
    <select aria-label="Session to share" className={input} value={sessionId} onChange={e=>setSessionId(e.target.value)}><option value="">Choose a Session</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.trail} · {s.title}</option>)}</select>
    <input aria-label="Group name" className={input} maxLength={80} value={title} onChange={e=>setTitle(e.target.value)}/>
    <label className="block">Student names<select className={input} value={entryName} onChange={e=>setEntryName(e.target.value)}>{["required","optional","off"].map(v=><option key={v}>{v}</option>)}</select></label>
    <label className="block">Student photos<select className={input} value={entryPhoto} onChange={e=>setEntryPhoto(e.target.value)}>{["off","optional","required"].map(v=><option key={v}>{v}</option>)}</select></label>
    <button className={btn} disabled={busy||!sessionId} onClick={()=>void run(async()=>{const {error}=await auth.rpc("mathemagine_create_share",{_session:sessionId,_title:title,_entry:{name:entryName,photo:entryPhoto}});if(error)throw error;await load(user.id);setNotice("Fresh link created with no student records.");})}>Create new share link</button>
    <h3 className="font-semibold">My links and reports</h3>
    {shares.map(s=><div key={s.id} className="rounded-xl border border-border p-3"><p>{s.title}</p><a className="mr-4 underline" href={`${origin}/arena/${s.code}`} target="_blank" rel="noreferrer">Student link</a><a className="underline" href={`${origin}/arena/live/${s.display_code}`} target="_blank" rel="noreferrer">Live report</a><button className={btn} onClick={()=>void navigator.clipboard.writeText(`${origin}/arena/${s.code}`).then(()=>setNotice("Student link copied."))}>Copy link</button></div>)}
    <h3 className="font-semibold">My students</h3>
    <input className={input} aria-label="Existing student account ID" placeholder="Student account ID" value={studentId} onChange={e=>setStudentId(e.target.value)}/>
    <button className={btn} disabled={busy||!studentId} onClick={()=>void run(async()=>{const {error}=await auth.from("mathemagine_students").insert({teacher_id:user.id,student_id:studentId.trim()});if(error)throw error;await load(user.id);setNotice("Invitation sent. The student accepts it in My account.");})}>Invite student</button>
    <select aria-label="Share to assign" className={input} value={shareId} onChange={e=>setShareId(e.target.value)}><option value="">Choose a link to assign</option>{shares.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select>
    {students.filter(s=>s.teacher_id===user.id).map(s=><div key={s.student_id} className="rounded-xl border border-border p-3 text-sm"><p className="break-all">{s.student_id} · {s.status}</p>{s.status==="accepted"&&<button className={btn} disabled={busy||!shareId} onClick={()=>void run(async()=>{const sh=shares.find(x=>x.id===shareId);const {error}=await auth.from("mathemagine_assignments").insert({teacher_id:user.id,student_id:s.student_id,share_id:sh.id,student_code:sh.code,title:sh.title});if(error)throw error;setNotice("Activities assigned.");})}>Assign activities</button>}</div>)}
   </div>}
   {students.filter(s=>s.student_id===user.id&&s.status==="pending").map(s=><div className="rounded-xl border border-border p-4" key={s.teacher_id}><p className="break-all">Teacher invitation: {s.teacher_id}</p>{["accepted","declined"].map(status=><button className={btn} key={status} disabled={busy} onClick={()=>void run(async()=>{const {error}=await auth.from("mathemagine_students").update({status}).eq("teacher_id",s.teacher_id).eq("student_id",user.id);if(error)throw error;await load(user.id);})}>{status==="accepted"?"Accept":"Decline"}</button>)}</div>)}
   <h2 className="font-bold">Assigned to me</h2>{assignments.filter(a=>a.student_id===user.id).map(a=><a key={a.id} className="block rounded-xl border border-border p-4 underline" href={`/arena/${a.student_code}`}>{a.title}</a>)}
  </>}
 </section>;
}
