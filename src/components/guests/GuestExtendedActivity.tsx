import {useMemo,useRef} from "react";
import McqExamPage from "@/pages/academia/mcq/McqExamPage";
import AcademiaAdventurePlayer from "@/components/academia/AcademiaAdventurePlayer";
import {arenaStart,arenaActivityComplete} from "@/lib/arena/arenaClient";
import type {GuestAcademiaActivity} from "@/lib/guests/guestApi";
export default function GuestExtendedActivity({activity,code,token,onBack}:{activity:GuestAcademiaActivity;code:string;token:string;onBack:()=>void}){
 const work=useRef<Record<string,Record<string,string>>>({});
 const totalKey=`mathemagine.shareStart:${code}:${token}:${activity.id}`;
 const starts=useRef<Record<string,number>>({}),picked=useRef<Record<number,number>>({});
 const begin=(id:string)=>{if(starts.current[id])return;starts.current[id]=Date.now();arenaStart(code,token,id,id);};
 const elapsed=(id:string)=>Math.max(1,Date.now()-(starts.current[id]??Date.now()));
 const mcqTracking=useMemo(()=>({
  onQuestion:(n:number)=>{const q=activity.mcq?.questions.find(q=>q.n===n);if(q)begin(q.arenaId);},
  onPick:(n:number,_answer:string)=>{const q=activity.mcq?.questions.find(q=>q.n===n);if(q)picked.current[n]=elapsed(q.arenaId);},
  onSubmit:(answers:Record<number,string>)=>{for(const q of activity.mcq?.questions??[])if(answers[q.n])arenaActivityComplete(code,token,q.arenaId,picked.current[q.n]??elapsed(q.arenaId),{answer:answers[q.n]});},
  onRetry:()=>{starts.current={};picked.current={};},
 }),[activity,code,token]);
 const adventureTracking=useMemo(()=>({
  scope:`${code}:${token}`,
  onStart:()=>{try{const saved=Number(localStorage.getItem(totalKey));if(saved>0)starts.current[activity.id]=saved;}catch{}begin(activity.id);try{localStorage.setItem(totalKey,String(starts.current[activity.id]));}catch{}},
  onRestart:()=>{starts.current={};work.current={};try{localStorage.removeItem(totalKey);}catch{}},
  onQuestion:(id:string)=>{delete starts.current[id];begin(id);},
  onLine:(id:string,lineId:string,written:string)=>{(work.current[id]??={})[lineId]=written;},
  onQuestionDone:(id:string)=>arenaActivityComplete(code,token,id,elapsed(id),{completedQuestions:[id],working:work.current[id]??{}}),
  onComplete:()=>{arenaActivityComplete(code,token,activity.id,elapsed(activity.id));try{localStorage.removeItem(totalKey);}catch{}},
 }),[activity,code,token]);
 if(activity.mcq)return <McqExamPage tracking={mcqTracking} offline={{paper:activity.mcq,onBack,save:async()=>{}}}/>;
 if(activity.adventure)return <AcademiaAdventurePlayer activityId={activity.id} adventureId={activity.adventure.id} gameId={activity.adventure.game?.id??null} offline={activity.adventure} reporting={adventureTracking} onExit={onBack}/>;
 return null;
}
