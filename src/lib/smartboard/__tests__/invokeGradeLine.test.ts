import { JSDOM } from 'jsdom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke:api.invoke}}}));
import { invokeGradeLine } from '../invokeGradeLine';
import { waitForGradeSave } from '@/lib/arena/waitForGradeSave';
beforeEach(()=>{const dom=new JSDOM('<!doctype html>',{url:'https://example.test'});vi.stubGlobal('window',dom.window);vi.stubGlobal('CustomEvent',dom.window.CustomEvent);api.invoke.mockReset();});
afterEach(()=>vi.unstubAllGlobals());
it('wakes a waiting Arena confirmation only after a successful persisted grade',async()=>{
 let woke=false;const waiting=waitForGradeSave(10000).then(()=>woke=true);
 api.invoke.mockResolvedValue({data:{correct:true,score:50},error:null});
 await invokeGradeLine({body:{assessmentId:'a',questionId:'q',lineId:'last',persist:true}});await waiting;expect(woke).toBe(true);
});
it('does not announce a dry run or a failed marking write as saved',async()=>{
 const events:unknown[]=[];window.addEventListener('arena:grade-saved',e=>events.push(e));
 api.invoke.mockResolvedValueOnce({data:{correct:true},error:null}).mockResolvedValueOnce({data:null,error:Error('offline')});
 await invokeGradeLine({body:{assessmentId:'a',persist:false}});await invokeGradeLine({body:{assessmentId:'a',persist:true}});expect(events).toHaveLength(0);
});
it('keeps link and participant namespaces separate while ordering their writes',async()=>{
 let resolve!: (v:unknown)=>void;api.invoke.mockImplementationOnce(()=>new Promise(r=>resolve=r)).mockResolvedValue({data:{correct:false},error:null});
 const first=invokeGradeLine({body:{assessmentId:'a',guestSlug:'link-A',participantKey:'p',lineId:'1'}});
 const next=invokeGradeLine({body:{assessmentId:'a',guestSlug:'link-A',participantKey:'p',lineId:'2'}});
 await invokeGradeLine({body:{assessmentId:'a',guestSlug:'link-B',participantKey:'p',lineId:'3'}});expect(api.invoke).toHaveBeenCalledTimes(2);
 resolve({data:{correct:true},error:null});await Promise.all([first,next]);expect(api.invoke).toHaveBeenCalledTimes(3);expect(api.invoke.mock.calls[2][1].body.lineId).toBe('2');
});
