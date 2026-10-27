import {describe,it,expect} from "vitest";
import {reportQuestions} from "../questionCatalogue";
describe("complete share question catalogue",()=>{
 it("includes 4 board questions, 50 MCQs, 6 Adventure questions and its full finish",()=>{
  const a=[...Array.from({length:4},(_,i)=>({id:`b${i}`,assessment_id:`assessment${i}`,title:"Board",kind:"question"})),{id:"mcq",title:"Paper",kind:"mcq"},{id:"adv",title:"The Becoming",kind:"adventure"}];
  const rows=reportQuestions(a,Array.from({length:50},(_,i)=>({id:`m${i}`,activity_id:"mcq",n:i+1})),Array.from({length:6},(_,i)=>({id:`a${i}`,activity_id:"adv",title:"Quest"})));
  expect(rows).toHaveLength(61);expect(new Set(rows.map(q=>q.assessmentId)).size).toBe(61);expect(rows.map(q=>q.number)).toEqual(Array.from({length:61},(_,i)=>i+1));
  expect(rows.at(-1)?.kind).toBe("adventure");
 });
 it("one board question has one identity shared by Practice and Play",()=>{
  expect(reportQuestions([{id:"activity",kind:"question",assessment_id:"same",title:"Q"}],[],[])).toEqual([{number:1,activityId:"activity",assessmentId:"same",questionId:"same",title:"Q",kind:"question",timerEnabled:true}]);
 });
 it("never counts a source paper's unassigned questions",()=>{
  const rows=reportQuestions([{id:"assigned",kind:"mcq",title:"Chosen"}],[{id:"yes",activity_id:"assigned",n:3},{id:"no",activity_id:"other",n:4}],[]);
  expect(rows.map(q=>q.assessmentId)).toEqual(["yes"]);
 });
});

it("maps Play's different hidden assessment onto the Practice question ranking",async()=>{
 const {resolveReportQuestion}=await import("../questionCatalogue");
 const rows=reportQuestions([{id:"card",kind:"question",assessment_id:"practice-assessment",title:"Q"}],[],[]);
 rows[0]!.aliases=["play-assessment"];
 expect(resolveReportQuestion(rows,"play-assessment")).toBe(resolveReportQuestion(rows,"practice-assessment"));
 expect(resolveReportQuestion(rows,"different-session")).toBeUndefined();
});
