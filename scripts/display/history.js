(() => {
"use strict";
const DATA_URL="./data/prediction-history.json";
const $=id=>document.getElementById(id);
const state={records:[],archivePage:1,pageSize:20};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateValue=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)};
const localDay=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
const kickoffDate=r=>{const d=new Date(r.kickoff_utc);return Number.isNaN(d.getTime())?null:d};
const hasScore=r=>Number.isInteger(r.actual?.home_score)&&Number.isInteger(r.actual?.away_score);
const outcome=(r,key)=>{if(!hasScore(r))return "pending";const hs=r.actual.home_score,as=r.actual.away_score,total=hs+as;return (key==="over_1_5"?total>=2:key==="over_2_5"?total>=3:hs>=1&&as>=1)?"correct":"incorrect"};
function filtered(ignoreResult=false){const comp=$("competitionFilter").value,tier=$("tierFilter").value,result=$("resultFilter").value,period=$("periodFilter").value;const cutoff=period==="all"?0:Date.now()-Number(period)*86400000;return state.records.filter(r=>(!comp||r.competition===comp)&&(!tier||String(r.prediction?.over_1_5?.tier??"")===tier)&&(ignoreResult||!result||outcome(r,"over_1_5")===result)&&(!cutoff||new Date(r.kickoff_utc).getTime()>=cutoff))}
function marketCell(p){if(!p)return "—";const label=p.tier?("Niveau "+p.tier+" · "+(p.tier_label||"")):"Données insuffisantes";const hf=p.home_frequency||{},af=p.away_frequency||{};return "<strong>"+esc(label)+"</strong><small style='display:block;color:#607796;margin-top:4px'>"+esc(hf.count??"—")+"/"+esc(hf.matches??0)+" · "+esc(af.count??"—")+"/"+esc(af.matches??0)+" matchs</small>"}
function row(r,archived){const base="<td>"+esc(dateValue(r.kickoff_utc))+"</td><td>"+esc(r.competition||"—")+"</td><td class='teams'>"+esc(r.home_team)+" – "+esc(r.away_team)+"</td><td>"+marketCell(r.prediction?.over_1_5)+"</td><td>"+marketCell(r.prediction?.over_2_5)+"</td><td>"+marketCell(r.prediction?.btts)+"</td><td>"+esc(dateValue(r.snapshot_at_utc))+" · "+(r.snapshot_stage==="J-1"?"J-1":"Snapshot historique")+"</td>";return "<tr>"+base+(archived?"<td class='score'>"+esc(r.actual.home_score+" - "+r.actual.away_score)+"</td>":"")+"</tr>"}
function rateFor(rows,key){const evaluated=rows.filter(r=>hasScore(r)&&r.prediction?.[key]);const correct=evaluated.filter(r=>outcome(r,key)==="correct").length;return {correct,total:evaluated.length,pct:evaluated.length?100*correct/evaluated.length:null}}
function updateRate(id,rows,key){const rate=rateFor(rows,key);$(id).textContent=rate.pct===null?"—":rate.pct.toFixed(1).replace(".",",")+" %";$(id+"Detail").textContent=rate.correct+" / "+rate.total+" pronostics justes"}
function render(){const rows=filtered(),statsRows=filtered(true),today=localDay(new Date()),tomorrow=today+86400000;const upcoming=rows.filter(r=>{const d=kickoffDate(r);if(!d||hasScore(r))return false;const day=localDay(d);return day===today||day===tomorrow}).sort((a,b)=>a.kickoff_utc.localeCompare(b.kickoff_utc));const archived=rows.filter(hasScore).sort((a,b)=>b.kickoff_utc.localeCompare(a.kickoff_utc));const statsArchived=statsRows.filter(hasScore);
updateRate("rateOver15",statsArchived,"over_1_5");updateRate("rateOver25",statsArchived,"over_2_5");updateRate("rateBtts",statsArchived,"btts");
$("upcomingCount").textContent=upcoming.length+" match"+(upcoming.length>1?"s":"");$("rowCount").textContent=archived.length+" match"+(archived.length>1?"s":"");$("upcomingEmpty").hidden=upcoming.length!==0;$("emptyState").hidden=archived.length!==0;
$("upcomingRows").innerHTML=upcoming.map(r=>row(r,false)).join("");
const pageCount=Math.max(1,Math.ceil(archived.length/state.pageSize));state.archivePage=Math.min(state.archivePage,pageCount);const first=(state.archivePage-1)*state.pageSize;const pageRows=archived.slice(first,first+state.pageSize);
$("historyRows").innerHTML=pageRows.map(r=>row(r,true)).join("");$("archivePageInfo").textContent="Page "+state.archivePage+" / "+pageCount+" · "+archived.length+" matchs";$("archivePrev").disabled=state.archivePage<=1;$("archiveNext").disabled=state.archivePage>=pageCount;$("archivePagination").hidden=archived.length<=state.pageSize;
}
async function init(){try{const response=await fetch(DATA_URL,{cache:"no-store"});if(!response.ok)throw Error("missing");const payload=await response.json();state.records=(Array.isArray(payload.records)?payload.records:[]).filter(r=>true);[...new Set(state.records.map(r=>r.competition).filter(Boolean))].sort().forEach(name=>{const o=document.createElement("option");o.value=name;o.textContent=name;$("competitionFilter").appendChild(o)});$("archiveNotice").textContent="Snapshots chargés : "+state.records.length+" match(s). Affichage à J-1 et le jour J ; archivage après réception du score final.";render()}catch(e){$("archiveNotice").textContent="Historique indisponible : aucun snapshot n'a encore été publié.";$("upcomingEmpty").hidden=false;$("emptyState").hidden=false}}
["competitionFilter","resultFilter","periodFilter","tierFilter"].forEach(id=>$(id).addEventListener("change",()=>{state.archivePage=1;render()}));
$("archivePrev").addEventListener("click",()=>{if(state.archivePage>1){state.archivePage--;render()}});
$("archiveNext").addEventListener("click",()=>{state.archivePage++;render()});
init();
})();