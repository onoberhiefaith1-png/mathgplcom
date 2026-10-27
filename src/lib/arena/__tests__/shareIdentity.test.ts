import {describe,it,expect,vi,afterEach} from "vitest";
import {guestLinkToken} from "@/lib/guests/guestSession";
afterEach(()=>vi.unstubAllGlobals());
describe("share participation identity",()=>{
 it("a new link never inherits another link's identity or progress",()=>{
 const data=new Map<string,string>();vi.stubGlobal("window",{localStorage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
 const a=guestLinkToken("linkA"),b=guestLinkToken("linkB");expect(a).not.toBe(b);expect(guestLinkToken("linkA")).toBe(a);expect(guestLinkToken()).not.toBe(a);
 });
});

it("two signed-in students on one device do not share link identity",()=>{
 const data=new Map<string,string>();vi.stubGlobal("window",{localStorage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
 data.set("mathemagine.learningAccount","studentA");const a=guestLinkToken("same-link");
 data.set("mathemagine.learningAccount","studentB");expect(guestLinkToken("same-link")).not.toBe(a);
 data.set("mathemagine.learningAccount","studentA");expect(guestLinkToken("same-link")).toBe(a);
});
