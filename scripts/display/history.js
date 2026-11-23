(() => {
"use strict";
const $=id=>document.getElementById(id);
const state={versions:[],records:[],page:1,pageSize:10,market:"over_1_5"};
const MARKETS=[
 {id:"over_1_5",label:"+1,5 buts",short:"+1,5"},
 {id:"over_2_5",label:"+2,5 buts",short:"+2,5"},
 {id:"btts",label:"Les deux équipes marquent",short:"BTTS"}
];
const TIER_LABELS={1:"Très favorable",2:"Favorable",3:"Mitigé",4:"Défavorable"};
const esc=v=>String(v??"—").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dateValue=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)};
const hasScore=r=>Number.isInteger(r.actual?.home_score)&&r.actual.home_score>=0&&Number.isInteger(r.actual?.away_score)&&r.actual.away_score>=0;
function tierFor(r,key){const p=r.prediction?.[key];return Number.isInteger(p?.tier)&&p.tier>=1&&p.tier<=4?p.tier:null}
function frequency(value){if(!value||!Number.isFinite(value.percentage))return "N/D";return value.count+" / "+value.matches+" · "+Number(value.percentage).toLocaleString("fr-FR",{maximumFractionDigits:1})+" %"}
function engineRecords(){return state.records}
function renderEngine(){const version=state.versions[0];$("engineDescription").textContent=version?.description||"Classification V1 fondée sur les fréquences historiques des équipes."; $("engineTags").innerHTML='<span class="tag active">V1 · moteur unique</span>';$("engineVersion").value="v1"}
function renderStats(){
 const rows=engineRecords();
 $("overallRate").textContent=rows.length;
 $("overallBar").style.width="100%";
 $("overallDetail").textContent="Snapshots V1 conservés · aucune sélection OUI/NON";
 $("totalEvaluated").textContent=rows.filter(r=>MARKETS.some(m=>tierFor(r,m.id)!==null)).length;
 $("totalHits").textContent=rows.filter(r=>MARKETS.some(m=>tierFor(r,m.id)!==null)).length;
 $("totalFailed").textContent=rows.filter(r=>MARKETS.every(m=>tierFor(r,m.id)===null)).length;
 $("totalPending").textContent=rows.filter(hasScore).length;
 $("marketGrid").innerHTML=MARKETS.map(m=>{
  const counts=[1,2,3,4].map(t=>rows.filter(r=>tierFor(r,m.id)===t).length);
  const insufficient=rows.filter(r=>tierFor(r,m.id)===null).length;
  return '<div class="market-tile '+(state.market===m.id?"selected":"")+'" data-market="'+m.id+'"><div class="market-top"><span class="market-name">'+m.label+'</span><span class="market-pct">'+(counts.reduce((a,b)=>a+b,0))+'</span></div><div class="market-detail">N1 : '+counts[0]+' · N2 : '+counts[1]+' · N3 : '+counts[2]+' · N4 : '+counts[3]+' · Insuffisants : '+insufficient+'</div></div>'
 }).join("");
 $("marketGrid").querySelectorAll("[data-market]").forEach(b=>b.addEventListener("click",()=>{state.market=b.dataset.market;state.page=1;renderStats();renderMatches()}));
}
function populateCompetitions(){const select=$("competitionFilter"),current=select.value;select.innerHTML='<option value="">Toutes les compétitions</option>';[...new Set(state.records.map(r=>r.competition).filter(Boolean))].sort().forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=v.replaceAll("-"," ");select.appendChild(o)});if([...select.options].some(o=>o.value===current))select.value=current}
function filteredMatches(){const competition=$("competitionFilter").value,status=$("statusFilter").value,period=$("periodFilter").value,cutoff=period==="all"?0:Date.now()-Number(period)*86400000;return state.records.filter(r=>{if(competition&&r.competition!==competition)return false;if(status==="pending"&&hasScore(r))return false;if(status==="evaluated"&&!hasScore(r))return false;const t=new Date(r.kickoff_utc).getTime();if(cutoff&&(!Number.isFinite(t)||t<cutoff))return false;return true}).sort((a,b)=>new Date(b.kickoff_utc)-new Date(a.kickoff_utc))}
function matchRow(r){const key=state.market,p=r.prediction?.[key]||{},tier=tierFor(r,key),score=hasScore(r)?r.actual.home_score+" – "+r.actual.away_score:'<span class="pill amber">En attente</span>',status=hasScore(r)?'<span class="pill green">Score reçu</span>':'<span class="pill amber">En attente</span>',competition=(r.competition||"Compétition inconnue").replaceAll("-"," ");const tierHtml=tier===null?'<span class="pill amber">Données insuffisantes</span>':'<span class="pill '+(tier<=2?"green":"")+'">Niveau '+tier+' · '+TIER_LABELS[tier]+'</span>';return '<tr><td>'+esc(dateValue(r.kickoff_utc))+'<small class="sub">'+esc(competition)+'</small></td><td><span class="match">'+esc(r.home_team)+" – "+esc(r.away_team)+'</span><small class="sub">Snapshot '+esc(r.snapshot_stage||"")+' · '+esc(dateValue(r.snapshot_at_utc))+'</small></td><td>'+esc(frequency(p.home_frequency))+'</td><td>'+esc(frequency(p.away_frequency))+'</td><td>'+tierHtml+'</td><td>'+score+'</td><td>'+status+'</td></tr>'}
function renderMatches(){const rows=filteredMatches(),market=MARKETS.find(m=>m.id===state.market);$("matchesTitle").textContent="4. Rencontres · "+market.label;$("rowCount").textContent=rows.length+" rencontre"+(rows.length>1?"s":"");$("emptyState").hidden=rows.length!==0;const pages=Math.max(1,Math.ceil(rows.length/state.pageSize));state.page=Math.min(state.page,pages);const start=(state.page-1)*state.pageSize;$("historyRows").innerHTML=rows.slice(start,start+state.pageSize).map(matchRow).join("");$("archivePageInfo").textContent="Page "+state.page+" / "+pages+" · "+rows.length+" rencontres · 10 par page";$("archivePrev").disabled=state.page<=1;$("archiveNext").disabled=state.page>=pages;$("archivePagination").hidden=rows.length<=state.pageSize}
async function loadSelected(){const version=state.versions[0];if(!version)throw new Error("Aucun moteur V1 publié.");const res=await fetch("./data/"+encodeURIComponent(version.archive),{cache:"no-store"});if(!res.ok)throw new Error("Archive V1 introuvable.");const payload=await res.json();if(!Array.isArray(payload.records))throw new Error("Format d'archive invalide.");state.records=payload.records.filter(r=>r&&typeof r==="object");state.page=1;populateCompetitions();renderEngine();renderStats();renderMatches();$("archiveNotice").className="notice";$("archiveNotice").textContent=state.records.length+" snapshots V1 chargés · niveaux historiques 1 à 4 · aucune sélection OUI/NON."}
async function init(){try{const res=await fetch("./data/prediction-history-index.json",{cache:"no-store"});if(!res.ok)throw new Error("Catalogue des moteurs introuvable.");const payload=await res.json();state.versions=(Array.isArray(payload.versions)?payload.versions:[]).filter(v=>v.id==="v1");if(!state.versions.length)throw new Error("Moteur V1 introuvable.");const select=$("engineVersion");select.innerHTML="";const o=document.createElement("option");o.value="v1";o.textContent="Moteur V1";select.appendChild(o);select.disabled=true;await loadSelected()}catch(e){$("archiveNotice").className="notice error";$("archiveNotice").textContent="Impossible de charger les archives : "+e.message;$("emptyState").hidden=false}}
["competitionFilter","statusFilter","periodFilter"].forEach(id=>$(id).addEventListener("change",()=>{state.page=1;renderMatches()}));
$("archivePrev").addEventListener("click",()=>{if(state.page>1){state.page--;renderMatches()}});
$("archiveNext").addEventListener("click",()=>{state.page++;renderMatches()});
init();
})();