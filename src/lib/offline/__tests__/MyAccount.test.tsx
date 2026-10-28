import {JSDOM} from "jsdom";
import {act} from "react";import {createRoot,type Root} from "react-dom/client";
import {beforeEach,afterEach,it,expect,vi} from "vitest";
const state=vi.hoisted(()=>({user:null as any,profile:null as any,rows:[] as any[]}));
vi.mock("@/lib/offline/mathemagineAuth",()=>({mathemagineAuth:{auth:{getSession:async()=>({data:{session:state.user?{user:state.user}:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>{}}}})},from:(table:string)=>{const chain:any={select:()=>chain,eq:()=>chain,or:()=>chain,order:()=>Promise.resolve({data:table==="mathemagine_students"?state.rows:[]}),maybeSingle:async()=>({data:state.profile}),then:(resolve:any)=>resolve({data:[]})};return chain;}}}));
vi.mock("@/lib/offline/academiaStore",()=>({switchLearningAccount:vi.fn(async()=>{})}));
vi.mock("@/lib/offline/accountSync",()=>({syncLearning:vi.fn(async()=>{})}));
import MyAccount from "@/pages/academiaApp/MyAccount";
let root:Root,host:HTMLElement;
beforeEach(()=>{state.user=null;state.profile=null;state.rows=[];const dom=new JSDOM("<!doctype html><body></body>",{url:"https://example.test"});for(const k of ["window","document","navigator","HTMLElement","Node"])vi.stubGlobal(k,(dom.window as any)[k]);vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
async function mount(){await act(async()=>{root.render(<MyAccount sessions={[{id:"s",title:"Introduction",trail:"Year 1"}]} onSchools={()=>{}} onChanged={()=>{}}/>);await Promise.resolve();});}
it("keeps anonymous entry optional and offers registration inside My account",async()=>{await mount();expect(host.textContent).toContain("without signing in");expect(host.querySelector('input[type=email]')).not.toBeNull();const b=[...host.querySelectorAll("button")].find(b=>b.textContent==="Create an account")!;await act(async()=>b.click());expect(host.textContent).toContain("Student");expect(host.textContent).toContain("Teacher");expect(host.querySelector('input[autocomplete=new-password]')).not.toBeNull();});
it("teacher workspace reuses public Sessions and exposes own links and invitations",async()=>{state.user={id:"teacher",email:"teacher@example.test",user_metadata:{}};state.profile={role:"teacher",display_name:"Teacher"};await mount();expect(host.textContent).toContain("Teacher workspace");expect(host.textContent).toContain("Create new share link");expect(host.textContent).toContain("Invite student");expect(host.querySelector('select[aria-label="Session to share"]')?.textContent).toContain("Introduction");});
it("student account does not render teacher sharing controls",async()=>{state.user={id:"student",email:"student@example.test",user_metadata:{}};state.profile={role:"student",display_name:"Learner"};await mount();expect(host.textContent).toContain("Assigned to me");expect(host.textContent).not.toContain("Create new share link");});
