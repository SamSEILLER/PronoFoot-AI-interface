(() => {
"use strict";
const DATA_URL="./data/prediction-history.json";
const $=id=>document.getElementById(id);
const state={records:[],archivePage:1,pageSize:20};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateValue=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)};
const hasScore=r=>Number.isInteger(r.actual?.home_score)&&Number.isInteger(r.actual?.away_score);
const hasStarted=r=>{const d=new Date(r.kickoff_utc);return !Number.isNaN(d.getTime())&&d.getTime()<=Date.now()};
const outcome=(r,key)=>{if(!hasScore(r))return "pending";const hs=r.actual.home_score,as=r.actual.away_score,total=hs+as;return (key==="over_1_5"?total>=2:key==="over_2_5"?total>=3:hs>=1&&as>=1)?"correct":"incorrect"};
function filtered(ignoreResult=false){const comp=$("competitionFilter").value,tier=$("tierFilter").value,result=$("resultFilter").value,period=$("periodFilter").value;const cutoff=period==="all"?0:Date.now()-Number(period)*86400000;return state.records.filter(r=>(hasScore(r)||hasStarted(r))&&(!comp||r.competition===comp)&&(!tier||String(r.prediction?.over_1_5?.tier??"")===tier)&&(ignoreResult||!result||outcome(r,"over_1_5")===result)&&(!cutoff||new Date(r.kickoff_utc).getTime()>=cutoff))}
function marketCell(p){if(!p)return "—";const label=p.tier?("Niveau "+p.tier+" · "+(p.tier_label||"")):"Données insuffisantes";const hf=p.home_frequency||{},af=p.away_frequency||{};return "<strong>"+esc(label)+"</strong><small style='display:block;color:#607796;margin-top:4px'>"+esc(hf.count??"—")+"/"+esc(hf.matches??0)+" · "+esc(af.count??"—")+"/"+esc(af.matches??0)+" matchs</small>"}
function row(r){const score=hasScore(r)?r.actual.home_score+" - "+r.actual.away_score:"Score en attente";const base="<td>"+esc(dateValue(r.kickoff_utc))+"</td><td>"+esc(r.competition||"—")+"</td><td class='teams'>"+esc(r.home_team)+" – "+esc(r.away_team)+"</td><td>"+marketCell(r.prediction?.over_1_5)+"</td><td>"+marketCell(r.prediction?.over_2_5)+"</td><td>"+marketCell(r.prediction?.btts)+"</td><td>"+esc(dateValue(r.snapshot_at_utc))+" · "+(r.snapshot_stage==="J-1"?"J-1":"Snapshot historique")+"</td>";return "<tr>"+base+"<td class='score'>"+esc(score)+"</td></tr>"}
function rateFor(rows,key){const evaluated=rows.filter(r=>hasScore(r)&&r.prediction?.[key]);const correct=evaluated.filter(r=>outcome(r,key)==="correct").length;return {correct,total:evaluated.length,pct:evaluated.length?100*correct/evaluated.length:null}}
function updateRate(id,rows,key){const rate=rateFor(rows,key);$(id).textContent=rate.pct===null?"—":rate.pct.toFixed(1).replace(".",",")+" %";$(id+"Detail").textContent=rate.correct+" / "+rate.total+" pronostics justes"}
function paginate(items,page){const pages=Math.max(1,Math.ceil(items.length/state.pageSize));const safePage=Math.min(page,pages);const first=(safePage-1)*state.pageSize;return {items:items.slice(first,first+state.pageSize),page:safePage,pages}}
function render(){const rows=filtered(),statsRows=filtered(true),archived=rows.sort((a,b)=>b.kickoff_utc.localeCompare(a.kickoff_utc)),statsArchived=statsRows.filter(hasScore);
updateRate("rateOver15",statsArchived,"over_1_5");updateRate("rateOver25",statsArchived,"over_2_5");updateRate("rateBtts",statsArchived,"btts");
$("rowCount").textContent=archived.length+" match"+(archived.length>1?"s":"");$("emptyState").hidden=archived.length!==0;
const ar=paginate(archived,state.archivePage);state.archivePage=ar.page;$("historyRows").innerHTML=ar.items.map(row).join("");$("archivePageInfo").textContent="Page "+ar.page+" / "+ar.pages+" · "+archived.length+" matchs";$("archivePrev").disabled=ar.page<=1;$("archiveNext").disabled=ar.page>=ar.pages;$("archivePagination").hidden=archived.length<=state.pageSize;
}
async function init(){try{const response=await fetch(DATA_URL,{cache:"no-store"});if(!response.ok)throw Error("missing");const payload=await response.json();state.records=Array.isArray(payload.records)?payload.records:[];[...new Set(state.records.map(r=>r.competition).filter(Boolean))].sort().forEach(name=>{const o=document.createElement("option");o.value=name;o.textContent=name;$("competitionFilter").appendChild(o)});$("archiveNotice").textContent="Snapshots chargés : "+state.records.length+" match(s). Seuls les matchs dont le coup d'envoi est passé sont affichés ici ; les scores sont renseignés dès leur réception.";render()}catch(e){$("archiveNotice").textContent="Historique indisponible : aucun snapshot n'a encore été publié.";$("emptyState").hidden=false}}
["competitionFilter","resultFilter","periodFilter","tierFilter"].forEach(id=>$(id).addEventListener("change",()=>{state.archivePage=1;render()}));
$("archivePrev").addEventListener("click",()=>{if(state.archivePage>1){state.archivePage--;render()}});
$("archiveNext").addEventListener("click",()=>{state.archivePage++;render()});
init();
})();