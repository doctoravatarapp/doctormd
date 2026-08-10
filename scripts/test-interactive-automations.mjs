import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("Supabase test credentials unavailable");
const db=createClient(url,key,{auth:{persistSession:false}}); const made=[],madeAssignments=[],madeMessages=[];
const ok=(result,label)=>{if(result.error)throw new Error(`${label}: ${result.error.message}`);return result.data};
const one=async(table,query,label)=>ok(await query.select("*").single(),label);

async function fixture(answer,{invalid=false,human=false}={}){
 const patient=ok(await db.from("patients").select("id").eq("email","doctoravatar.app@gmail.com").limit(1).single(),"test patient");
 const episode=ok(await db.from("care_episodes").select("*").eq("patient_id",patient.id).order("created_at",{ascending:false}).limit(1).single(),"test episode");
 const conv=ok(await db.from("conversations").select("*").eq("care_episode_id",episode.id).eq("status","open").limit(1).single(),"conversation");
 const flow=await one("automation_flows",db.from("automation_flows").insert({organization_id:episode.organization_id,name:`Fluxo Teste Interativo APolloMD ${crypto.randomUUID().slice(0,6)}`,status:"draft"}),"flow"); made.push(flow.id);
 const base={organization_id:episode.organization_id,flow_id:flow.id,anchor:"previous_step_completed_at",delay_value:0,delay_unit:"minutes",is_active:true};
 const msg=await one("automation_steps",db.from("automation_steps").insert({...base,position:1,name:"Início",step_type:"message",message_content:"Vamos iniciar um teste."}),"step1");
 const q=await one("automation_steps",db.from("automation_steps").insert({...base,position:2,name:"Nota",step_type:"question",message_content:"Qual nota você dá para este teste?",response_type:"number",response_min:0,response_max:10}),"step2");
 const a=await one("automation_steps",db.from("automation_steps").insert({...base,position:4,name:"Caminho A",step_type:"message",message_content:"CAMINHO A"}),"step4");
 const b=await one("automation_steps",db.from("automation_steps").insert({...base,position:5,name:"Caminho B",step_type:"message",message_content:"CAMINHO B"}),"step5");
 const c=await one("automation_steps",db.from("automation_steps").insert({...base,position:3,name:"Escolha",step_type:"condition",message_content:"Condição",condition_question_step_id:q.id,condition_operator:"greater_than_or_equal",condition_value:"8",if_true_step_id:a.id,if_false_step_id:b.id}),"step3");
 ok(await db.from("automation_flows").update({status:"active"}).eq("id",flow.id),"activate");
 const ea=await one("episode_automations",db.from("episode_automations").insert({organization_id:episode.organization_id,care_episode_id:episode.id,flow_id:flow.id,flow_version:1,status:"waiting_response",current_step_id:q.id}),"assignment");madeAssignments.push(ea.id);
 const actionBase={organization_id:episode.organization_id,episode_automation_id:ea.id,scheduled_for:new Date().toISOString(),anchor:"previous_step_completed_at",delay_value:0,delay_unit:"minutes"};
 const qa=await one("scheduled_actions",db.from("scheduled_actions").insert({...actionBase,automation_step_id:q.id,step_position:2,step_name:"Nota",message_content:"Qual nota?",step_type:"question",response_type:"number",response_min:0,response_max:10,status:"completed",executed_at:new Date().toISOString()}),"question action");
 for(const [step,pos,name,type,extra] of [[c,3,"Escolha","condition",{condition_question_step_id:q.id,condition_operator:"greater_than_or_equal",condition_value:"8",if_true_step_id:a.id,if_false_step_id:b.id}],[a,4,"Caminho A","message",{}],[b,5,"Caminho B","message",{}]])ok(await db.from("scheduled_actions").insert({...actionBase,automation_step_id:step.id,step_position:pos,step_name:name,message_content:name==="Caminho A"?"CAMINHO A":name==="Caminho B"?"CAMINHO B":"Condição",step_type:type,...extra}),`action ${pos}`);
 if(human)ok(await db.from("conversations").update({mode:"doctor"}).eq("id",conv.id),"human mode");
 const message=await one("messages",db.from("messages").insert({organization_id:episode.organization_id,conversation_id:conv.id,sender_type:"patient",content:answer,client_message_id:crypto.randomUUID()}),"patient message");madeMessages.push(message.id);
 const first=ok(await db.rpc("answer_active_automation_question",{target_conversation_id:conv.id,target_message_id:message.id,raw_answer:answer}),"answer");
 if(human){assert.equal(first.handled,false);const current=ok(await db.from("episode_automations").select("status,current_step_id").eq("id",ea.id).single(),"human current");assert.equal(current.status,"waiting_response");assert.equal(current.current_step_id,q.id);ok(await db.from("conversations").update({mode:"ai"}).eq("id",conv.id),"restore mode");return;}
 if(invalid){assert.equal(first.valid,false);const invalidCount=await db.from("automation_responses").select("id",{count:"exact",head:true}).eq("episode_automation_id",ea.id);ok(invalidCount,"invalid count");assert.equal(invalidCount.count,0);const validMessage=await one("messages",db.from("messages").insert({organization_id:episode.organization_id,conversation_id:conv.id,sender_type:"patient",content:"7",client_message_id:crypto.randomUUID()}),"valid message");madeMessages.push(validMessage.id);const valid=ok(await db.rpc("answer_active_automation_question",{target_conversation_id:conv.id,target_message_id:validMessage.id,raw_answer:"7"}),"valid answer");assert.equal(valid.valid,true);} else assert.equal(first.valid,true);
 const again=ok(await db.rpc("answer_active_automation_question",{target_conversation_id:conv.id,target_message_id:message.id,raw_answer:answer}),"duplicate");assert.equal(again.handled,false);
 const responses=ok(await db.from("automation_responses").select("*").eq("episode_automation_id",ea.id),"responses");assert.equal(responses.length,1);
 const condition=ok(await db.from("scheduled_actions").update({status:"processing"}).eq("episode_automation_id",ea.id).eq("step_position",3).select("id").single(),"claim condition");ok(await db.rpc("complete_automation_action",{target_action_id:condition.id}),"condition");
 const actions=ok(await db.from("scheduled_actions").select("step_position,status").eq("episode_automation_id",ea.id).gte("step_position",4).order("step_position"),"branches");const expected=Number(invalid?7:answer)>=8?4:5;assert.equal(actions.find(x=>x.step_position===expected)?.status,"pending");assert.equal(actions.find(x=>x.step_position!==expected)?.status,"cancelled");
 const chosen=ok(await db.from("scheduled_actions").update({status:"processing"}).eq("episode_automation_id",ea.id).eq("step_position",expected).select("id").single(),"claim branch");ok(await db.rpc("complete_automation_action",{target_action_id:chosen.id}),"branch");const sent=ok(await db.from("messages").select("id,content").eq("scheduled_action_id",chosen.id).single(),"sent branch");madeMessages.push(sent.id);assert.equal(sent.content,expected===4?"CAMINHO A":"CAMINHO B");
}

async function cleanup(){for(const id of madeAssignments.reverse())await db.from("episode_automations").delete().eq("id",id);for(const id of made.reverse())await db.from("automation_flows").delete().eq("id",id);if(madeMessages.length)await db.from("messages").delete().in("id",madeMessages);}
try{
 const {data:stale}=await db.from("automation_flows").select("id").like("name","Fluxo Teste Interativo APolloMD%");if(stale?.length){const ids=stale.map(x=>x.id);await db.from("episode_automations").delete().in("flow_id",ids);await db.from("automation_flows").delete().in("id",ids);}
 await fixture("9");await fixture("4");await fixture("abc",{invalid:true});await fixture("9",{human:true});console.log("interactive automation E2E: OK");
}finally{await cleanup();}
