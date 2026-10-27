/** One report entry per question, irrespective of Practice/Play. */
export type ReportQuestion = { number: number; activityId: string; assessmentId: string; questionId: string; title: string; kind: "question" | "mcq" | "adventure-question" | "adventure"; timerEnabled: boolean };
type Activity = { id: string; title: string; kind: string; assessment_id?: string | null };
type Item = { id: string; activity_id: string; n?: number; title?: string; text?: string };
export function reportQuestions(activities: Activity[], mcq: Item[], adventure: Item[]): ReportQuestion[] {
 const out: ReportQuestion[] = [];
 const add = (a: Activity, id: string, questionId: string, title: string, kind: ReportQuestion["kind"]) => out.push({number:out.length+1,activityId:a.id,assessmentId:id,questionId,title,kind,timerEnabled:true});
 for(const a of activities) {
  if(a.kind === "mcq") for(const q of mcq.filter(q=>q.activity_id===a.id)) add(a,q.id,q.id,`${a.title} · Q${q.n}`,"mcq");
  else if(a.kind === "adventure") {
   for(const q of adventure.filter(q=>q.activity_id===a.id)) add(a,q.id,q.id,q.title || a.title,"adventure-question");
   add(a,a.id,a.id,`${a.title} · full Adventure`,"adventure");
  } else if(a.assessment_id) add(a,a.assessment_id,a.assessment_id,a.title,"question");
 }
 return out;
}
