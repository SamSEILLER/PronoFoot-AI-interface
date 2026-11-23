(() => {
"use strict";
const $ = id => document.getElementById(id);
const state = { records: [], versions: [], page: 1, pageSize: 10 };
const esc = value => String(value ?? "—").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dateValue = value => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d);
};
const hasScore = r => Number.isInteger(r.actual?.home_score) && r.actual.home_score >= 0 && Number.isInteger(r.actual?.away_score) && r.actual.away_score >= 0;
const hasStarted = r => { const d = new Date(r.kickoff_utc); return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now(); };
const totalGoals = r => r.actual.home_score + r.actual.away_score;
function resultFor(r, key) {
  if (!hasScore(r)) return "pending";
  const h = r.actual.home_score, a = r.actual.away_score, g = h + a;
  return key === "over_1_5" ? (g >= 2 ? "correct" : "incorrect") :
    key === "over_2_5" ? (g >= 3 ? "correct" : "incorrect") :
    (h >= 1 && a >= 1 ? "correct" : "incorrect");
}
function filtered() {
  const competition = $("competitionFilter").value;
  const tier = $("marketFilter").value;
  const status = $("statusFilter").value;
  const period = $("periodFilter").value;
  const cutoff = period === "all" ? 0 : Date.now() - Number(period) * 86400000;
  return state.records.filter(r => {
    if (!hasStarted(r)) return false;
    if (competition && r.competition !== competition) return false;
    const t = r.prediction?.over_1_5?.tier;
    if (tier === "none" && t != null) return false;
    if (tier && tier !== "none" && String(t ?? "") !== tier) return false;
    if (status === "pending" && hasScore(r)) return false;
    if (status === "evaluated" && !hasScore(r)) return false;
    const time = new Date(r.kickoff_utc).getTime();
    if (cutoff && (!Number.isFinite(time) || time < cutoff)) return false;
    return true;
  }).sort((a,b) => new Date(b.kickoff_utc) - new Date(a.kickoff_utc));
}
function tierMarkup(p) {
  if (!p) return '<span class="pill">Non renseigné</span>';
  const n = p.tier;
  const cls = n === 1 ? "green" : n === 4 ? "red" : n === 2 ? "amber" : "";
  const label = n ? "Niveau " + n + " · " + (p.tier_label || "") : "Données insuffisantes";
  const h = p.home_frequency || {}, a = p.away_frequency || {};
  const detail = "Domicile " + (h.count ?? "—") + "/" + (h.matches ?? 0) + " · Extérieur " + (a.count ?? "—") + "/" + (a.matches ?? 0);
  return '<span class="pill '+cls+'">'+esc(label)+'</span><small>'+esc(detail)+'</small>';
}
function over15Status(r) {
  const p = r.prediction?.over_1_5;
  if (typeof p?.pick !== "boolean") return '<span class="pill">Sélection absente</span>';
  if (!hasScore(r)) return '<span class="pill amber">En attente</span>';
  const hit = (p.pick && totalGoals(r) >= 2) || (!p.pick && totalGoals(r) < 2);
  return '<span class="pill '+(hit ? "green" : "red")+'">'+(hit ? "Sélection juste" : "Sélection fausse")+'</span>';
}
function row(r) {
  const score = hasScore(r) ? '<span class="score">'+esc(r.actual.home_score+' – '+r.actual.away_score)+'</span>' : '<span class="pill amber">Score en attente</span>';
  const competition = (r.competition || "Compétition inconnue").replaceAll("-", " ");
  return '<tr><td>'+esc(dateValue(r.kickoff_utc))+'<small class="sub">'+esc(competition)+'</small></td>'+
    '<td><span class="match">'+esc(r.home_team)+' – '+esc(r.away_team)+'</span><small class="sub">ID '+esc(r.match_id)+'</small></td>'+
    '<td class="market">'+tierMarkup(r.prediction?.over_1_5)+'<small>Pick : '+(r.prediction?.over_1_5?.pick === true ? "OUI" : r.prediction?.over_1_5?.pick === false ? "NON" : "—")+'</small></td>'+
    '<td class="market">'+tierMarkup(r.prediction?.over_2_5)+'</td>'+
    '<td class="market">'+tierMarkup(r.prediction?.btts)+'</td>'+
    '<td>'+esc(dateValue(r.snapshot_at_utc))+'<small class="sub">'+esc(r.snapshot_stage || "Snapshot")+'</small></td>'+
    '<td>'+score+(hasScore(r) ? '<small class="sub">'+over15Status(r)+'</small>' : '')+'</td></tr>';
}
function rateOver15(rows) {
  const evaluated = rows.filter(r => hasScore(r) && typeof r.prediction?.over_1_5?.pick === "boolean");
  const hits = evaluated.filter(r => {
    const actual = totalGoals(r) >= 2;
    return actual === r.prediction.over_1_5.pick;
  }).length;
  return {hits,total:evaluated.length,pct:evaluated.length ? 100*hits/evaluated.length : null};
}
function render() {
  const rows = filtered();
  const evaluated = rows.filter(hasScore);
  const pending = rows.length - evaluated.length;
  const rate = rateOver15(rows);
  $("metricTotal").textContent = rows.length;
  $("metricEvaluated").textContent = evaluated.length;
  $("metricEvaluatedDetail").textContent = rows.length ? (100*evaluated.length/rows.length).toFixed(0)+" % des matchs affichés" : "Aucun match affiché";
  $("metricPending").textContent = pending;
  $("metricOver15").textContent = rate.pct === null ? "N/D" : rate.pct.toFixed(1).replace(".",",")+" %";
  $("metricOver15Detail").textContent = rate.hits+" / "+rate.total+" sélections explicites évaluées";
  $("rowCount").textContent = rows.length+" match"+(rows.length>1?"s":"");
  $("emptyState").hidden = rows.length !== 0;
  const pages = Math.max(1,Math.ceil(rows.length/state.pageSize));
  state.page = Math.min(state.page,pages);
  const start = (state.page-1)*state.pageSize;
  $("historyRows").innerHTML = rows.slice(start,start+state.pageSize).map(row).join("");
  $("archivePageInfo").textContent = "Page "+state.page+" / "+pages+" · "+rows.length+" matchs · 10 par page";
  $("archivePrev").disabled = state.page <= 1;
  $("archiveNext").disabled = state.page >= pages;
  $("archivePagination").hidden = rows.length <= state.pageSize;
}
function populateCompetitions() {
  const select = $("competitionFilter"), current = select.value;
  select.innerHTML = '<option value="">Toutes les compétitions</option>';
  [...new Set(state.records.map(r=>r.competition).filter(Boolean))].sort().forEach(value => {
    const option = document.createElement("option");
    option.value = value; option.textContent = value.replaceAll("-"," ");
    select.appendChild(option);
  });
  if ([...select.options].some(o=>o.value===current)) select.value=current;
}
async function loadVersion(id) {
  const version = state.versions.find(v=>v.id===id);
  if (!version) throw new Error("Version non disponible.");
  const response = await fetch("./data/"+encodeURIComponent(version.archive),{cache:"no-store"});
  if (!response.ok) throw new Error("Archive "+version.archive+" introuvable.");
  const payload = await response.json();
  if (!Array.isArray(payload.records)) throw new Error("Format d'archive invalide : tableau records absent.");
  state.records = payload.records.filter(r=>r && typeof r==="object");
  state.page = 1;
  populateCompetitions();
  $("versionDescription").textContent = version.description || version.label;
  $("versionCount").textContent = state.records.length+" snapshots · "+esc(version.label);
  $("archiveNotice").className = "notice";
  $("archiveNotice").textContent = version.label+" chargée. Les matchs non commencés sont conservés dans l'archive mais masqués de ce journal.";
  render();
}
async function init() {
  try {
    const response = await fetch("./data/prediction-history-index.json",{cache:"no-store"});
    if (!response.ok) throw new Error("Catalogue des versions introuvable.");
    const payload = await response.json();
    state.versions = Array.isArray(payload.versions) ? payload.versions : [];
    const select = $("engineVersion");
    state.versions.forEach(v=>{
      const option=document.createElement("option"); option.value=v.id; option.textContent=v.label; select.appendChild(option);
    });
    if (!state.versions.some(v=>v.id==="v2")) {
      const option=document.createElement("option"); option.value="v2"; option.textContent="Moteur V2 — en préparation"; option.disabled=true; select.appendChild(option);
    }
    if (!state.versions.length) throw new Error("Aucune archive versionnée disponible.");
    const active = state.versions.find(v=>v.id===payload.active_version) || state.versions[0];
    select.value=active.id;
    await loadVersion(active.id);
  } catch(error) {
    $("archiveNotice").className="notice error";
    $("archiveNotice").textContent="Impossible de charger les archives : "+error.message;
    $("emptyState").hidden=false;
  }
}
["competitionFilter","marketFilter","statusFilter","periodFilter"].forEach(id=>{
  $(id).addEventListener("change",()=>{state.page=1;render();});
});
$("engineVersion").addEventListener("change",()=>loadVersion($("engineVersion").value).catch(error=>{
  $("archiveNotice").className="notice error"; $("archiveNotice").textContent=error.message;
}));
$("archivePrev").addEventListener("click",()=>{if(state.page>1){state.page--;render();}});
$("archiveNext").addEventListener("click",()=>{state.page++;render();});
init();
})();