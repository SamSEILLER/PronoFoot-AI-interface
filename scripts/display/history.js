(() => {
"use strict";
const DATA_URL="./data/prediction-history.json";
const $=id=>document.getElementById(id);
const state={records:[]};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateValue=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d)};
const pct=(n,d)=>d?(100*n/d).toFixed(0)+" %":"—";
const markets=[["over_1_5","+1,5"],["over_2_5","+2,5"],["btts","BTTS"]];
function outcome(r,key){const a=r.actual||{};if(!Number.isInteger(a.home_score)||!Number.isInteger(a.away_score))return "pending";const total=a.home_score+a.away_score;const hit=key==="over_1_5"?total>=2:key==="over_2_5"?total>=3:a.home_score>=1&&a.away_score>=1;return hit?"correct":"incorrect"}
function filtered(){
const comp=$("competitionFilter").value,tier=$("tierFilter").value,result=$("resultFilter").value,period=$("periodFilter").value;
const cutoff=period==="all"?0:Date.now()-Number(period)*86400000;
return state.records.filter(r=>(!comp||r.competition===comp)&&(!tier||String(r.prediction?.over_1_5?.tier??"")===tier)
&&(!result||outcome(r,"over_1_5")===result)&&(!cutoff||new Date(r.kickoff_utc).getTime()>=cutoff));
}
function marketCell(p){if(!p)return "—";const label=p.tier?("Niveau "+p.tier+" · "+(p.tier_label||"")):"Données insuffisantes";const hf=p.home_frequency||{},af=p.away_frequency||{};return "<strong>"+esc(label)+"</strong><small style='display:block;color:#607796;margin-top:4px'>"+esc(hf.count??"—")+"/"+esc(hf.matches??0)+" · "+esc(af.count??"—")+"/"+esc(af.matches??0)+" matchs</small>"}
function render(){
const rows=filtered(),evaluated=rows.filter(r=>Number.isInteger(r.actual?.home_score)&&Number.isInteger(r.actual?.away_score));
const correct=evaluated.filter(r=>outcome(r,"over_1_5")==="correct").length;
$("metricCount").textContent=String(rows.length);$("metricAccuracy").textContent=pct(correct,evaluated.length);
$("metricCorrect").textContent=String(rows.length);$("metricIncorrect").textContent=String(evaluated.length);
$("rowCount").textContent=rows.length+" match"+(rows.length>1?"s":"");$("emptyState").hidden=rows.length!==0;
$("historyRows").innerHTML=rows.map(r=>"<tr><td>"+esc(dateValue(r.kickoff_utc))+"</td><td>"+esc(r.competition||"—")+"</td><td class='teams'>"+esc(r.home_team)+" – "+esc(r.away_team)+"</td><td>"+marketCell(r.prediction?.over_1_5)+"</td><td>"+marketCell(r.prediction?.over_2_5)+"</td><td>"+marketCell(r.prediction?.btts)+"</td><td>"+esc(dateValue(r.snapshot_at_utc))+" · J-2</td><td class='score'>"+(Number.isInteger(r.actual?.home_score)?esc(r.actual.home_score+" - "+r.actual.away_score):"En attente")+"</td></tr>").join("");
}
async function init(){try{const response=await fetch(DATA_URL,{cache:"no-store"});if(!response.ok)throw Error("missing");const payload=await response.json();state.records=(Array.isArray(payload.records)?payload.records:[]).filter(r=>r.snapshot_stage==="J-2");
[...new Set(state.records.map(r=>r.competition).filter(Boolean))].sort().forEach(name=>{const o=document.createElement("option");o.value=name;o.textContent=name;$("competitionFilter").appendChild(o)});
$("archiveNotice").textContent="Archive J-2 chargée : "+state.records.length+" match(s). Les fréquences des trois expérimentations sont figées à la date du snapshot.";
render()}catch(e){$("archiveNotice").textContent="Archive J-2 indisponible : aucun snapshot n'a encore été publié."; $("emptyState").hidden=false}}
["competitionFilter","resultFilter","periodFilter","tierFilter"].forEach(id=>$(id).addEventListener("change",render));init();
})();