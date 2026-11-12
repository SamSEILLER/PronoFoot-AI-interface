(() => {
"use strict";
const $ = (s, r=document) => r.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = v => String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const parisParts = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
const nowKey = (()=>{const o=Object.fromEntries(parisParts.map(x=>[x.type,x.value]));return o.year+"-"+o.month+"-"+o.day;})();
const shift = (key,n)=>{const [y,m,d]=key.split("-").map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10)};
const timeFmt = new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"});
const dateFmt = new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"2-digit",month:"short",timeZone:"Europe/Paris"});
const fullDateFmt = new Intl.DateTimeFormat("fr-FR",{dateStyle:"long",timeZone:"Europe/Paris"});
const num = (v,d=2)=>Number.isFinite(Number(v))?Number(v).toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d}):"—";
const avg = (t,k)=>t&&Number(t.played)>0?Number(t[k])/Number(t.played):null;
const stamp = v => v ? new Date(v).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Paris"}) : "Non précisée";
const ranges = {"today-tomorrow":[0,1],"days-2-3":[2,3],"days-4-6":[4,6],"days-7-13":[7,13]};
const state = {data:{},matches:[],selected:null,range:"days-7-13",competition:"all",query:""};
const urls = {matches:"./data/matches_future.json",standings:"./data/standings.json",predictions:"./data/goal-predictions.json",season:"./data/season-goals.json",form:"./data/recent-form.json",h2h:"./data/head-to-head.json",odds:"./data/odds_latest.json",status:"./data/site-status.json"};
async function load(){
 const entries=await Promise.all(Object.entries(urls).map(async([k,u])=>{const r=await fetch(u+"?v="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error(k+" : HTTP "+r.status);return [k,await r.json()]}));
 state.data=Object.fromEntries(entries);state.matches=Array.isArray(state.data.matches)?state.data.matches:[];
 if(!state.matches.length) throw new Error("Le calendrier ne contient aucun match.");
 buildFilters();renderMatches();renderDataHealth();
 $("#loading").hidden=true;$("#app").hidden=false;
}
function buildFilters(){
 const comps=[...new Map(state.matches.map(m=>[m.competition_slug,m.competition])).entries()].sort((a,b)=>a[1].localeCompare(b[1],"fr"));
 $("#competition").innerHTML='<option value="all">Toutes les compétitions</option>'+comps.map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join("");
 const labels={"today-tomorrow":"J à J+1","days-2-3":"J+2 à J+3","days-4-6":"J+4 à J+6","days-7-13":"J+7 à J+13"};
 $("#periods").innerHTML=Object.entries(labels).map(([k,v])=>'<button class="period '+(k===state.range?"active":"")+'" data-range="'+k+'">'+v+'</button>').join("");
 $("#periods").addEventListener("click",e=>{const b=e.target.closest("[data-range]");if(!b)return;state.range=b.dataset.range;$("#periods").querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));renderMatches()});
 $("#competition").addEventListener("change",e=>{state.competition=e.target.value;renderMatches()});
 $("#team-search").addEventListener("input",e=>{state.query=norm(e.target.value);renderMatches()});
}
function filtered(){
 const [a,b]=ranges[state.range],first=shift(nowKey,a),last=shift(nowKey,b);
 return state.matches.filter(m=>m.date>=first&&m.date<=last)
 .filter(m=>state.competition==="all"||m.competition_slug===state.competition)
 .filter(m=>!state.query||norm(m.home_team).includes(state.query)||norm(m.away_team).includes(state.query))
 .sort((x,y)=>String(x.kickoff_utc).localeCompare(String(y.kickoff_utc)));
}
function logo(m,side,small=false){const url=m.provider_record?.[side+"_team"]?.image_url;return url?'<img class="'+(small?"crest":"big-crest")+'" src="'+esc(url)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<span class="'+(small?"crest":"big-crest")+'">⚽</span>'}
function renderMatches(){
 const rows=filtered();$("#match-count").textContent=rows.length+" match"+(rows.length>1?"s":"");
 $("#calendar-date").textContent=({ "today-tomorrow":"J à J+1","days-2-3":"J+2 à J+3","days-4-6":"J+4 à J+6","days-7-13":"J+7 à J+13"})[state.range];
 $("#matches").innerHTML=rows.length?rows.map(m=>{
 const active=state.selected?.match_id===m.match_id;
 return '<button class="match-row '+(active?"selected":"")+'" data-match="'+esc(m.match_id)+'"><span class="match-time">'+timeFmt.format(new Date(m.kickoff_utc))+'</span><span class="competition"><span class="league-mark">◆</span>'+esc(m.competition)+'</span><span class="fixture"><span class="team">'+logo(m,"home",true)+'<span class="team-name">'+esc(m.home_team)+'</span></span><span class="vs">VS</span><span class="team away">'+logo(m,"away",true)+'<span class="team-name">'+esc(m.away_team)+'</span></span></span><span class="chevron">›</span></button>';
 }).join(""):'<div class="empty">Aucun match dans cette période avec ces filtres.</div>';
 $("#matches").querySelectorAll("[data-match]").forEach(b=>b.addEventListener("click",()=>{state.selected=rows.find(m=>m.match_id===b.dataset.match);renderMatches();renderDetail()}));
 if(state.selected&&!rows.some(m=>m.match_id===state.selected.match_id)){state.selected=null;renderDetailEmpty()}
 if(!state.selected&&rows.length){state.selected=rows[0];renderMatches();renderDetail()}
}
function indexById(arr,key){return new Map((arr||[]).map(x=>[String(x[key]),x]))}
function renderDetailEmpty(){ $("#detail").innerHTML='<div class="empty">Sélectionne une rencontre pour afficher ses données.</div>'}
function renderDetail(){
 const m=state.selected;if(!m)return renderDetailEmpty();
 const pred=state.data.predictions.matches?.[m.match_id]?.expected_goals;
 const has=pred?.status==="estimated"&&Number.isFinite(Number(pred.lambda_home))&&Number.isFinite(Number(pred.lambda_away));
 const standings=state.data.standings.competitions?.find(c=>c.id===m.competition_slug&&c.season===m.season);
 const pos=new Map((standings?.standings||[]).map(t=>[String(t.team_id),t]));
 const hp=pos.get(String(m.home_team_id)),ap=pos.get(String(m.away_team_id));
 const season=state.data.season.competitions?.find(c=>c.id===m.competition_slug&&c.season===m.season);
 const teams=indexById(season?.teams,"team_id");
 const ht=teams.get(String(m.home_team_id)),at=teams.get(String(m.away_team_id));
 const avg=(t,k)=>t&&Number(t.played)>0?Number(t[k])/Number(t.played):null;
 const homeLogo=logo(m,"home"),awayLogo=logo(m,"away");
 $("#detail").innerHTML='<div class="detail-top"><div class="competition-title"><span class="league-large">◆</span><span>'+esc(m.competition)+' · '+esc(m.season)+'</span></div><span class="match-date">'+esc(fullDateFmt.format(new Date(m.kickoff_utc)))+' · '+timeFmt.format(new Date(m.kickoff_utc))+'</span></div>'+
 '<div class="teams-detail"><div class="detail-team">'+homeLogo+'<div><strong>'+esc(m.home_team)+'</strong><span class="rank">'+(hp?"#"+hp.position+" · "+hp.points+" pts":"Classement indisponible")+'</span></div></div><span class="versus">VS</span><div class="detail-team right">'+awayLogo+'<div><strong>'+esc(m.away_team)+'</strong><span class="rank">'+(ap?"#"+ap.position+" · "+ap.points+" pts":"Classement indisponible")+'</span></div></div></div>'+
 '<div class="lambda-grid"><div class="lambda-card"><span class="lambda-label">λ '+esc(m.home_team)+'</span><strong class="lambda-value">'+(has?num(pred.lambda_home):"—")+'</strong></div><div class="lambda-card"><span class="lambda-label">λ '+esc(m.away_team)+'</span><strong class="lambda-value">'+(has?num(pred.lambda_away):"—")+'</strong></div><div class="lambda-card total"><span class="lambda-label">λ Total attendu</span><strong class="lambda-value">'+(has?num(pred.total_expected_goals):"—")+'</strong></div></div>'+
 '<div class="lambda-note">'+(has?"Modèle "+esc(pred.model)+" · "+esc(pred.samples?.home??"—")+" matchs domicile / "+esc(pred.samples?.away??"—")+" matchs extérieur · modèle non calibré.":"Estimation indisponible pour cette rencontre.")+'</div>'+
 '<div class="averages">'+averageCard(m.home_team,ht)+averageCard(m.away_team,at)+'</div>'+
 '<div class="accordions">'+
 '<details class="accordion" open><summary><span class="accordion-icon">▦</span><div><div class="accordion-title">Vue d’ensemble</div><div class="accordion-sub">Forme récente et confrontations directes</div></div><span class="arrow">⌄</span></summary><div class="accordion-content" id="overview"></div></details>\n <details class="accordion" id="classements"><summary><span class="accordion-icon">🏆</span><div><div class="accordion-title">Classement complet</div><div class="accordion-sub">Tableau de la compétition et de la saison du match</div></div><span class="arrow">⌄</span></summary><div class="accordion-content" id="standings"></div></details>'+
 '<details class="accordion"><summary><span class="accordion-icon">✺</span><div><div class="accordion-title">Analyse &amp; IA</div><div class="accordion-sub">Statistiques de buts de la compétition et de la saison</div></div><span class="arrow">⌄</span></summary><div class="accordion-content" id="analysis"></div></details>'+
 '<details class="accordion"><summary><span class="accordion-icon">▱</span><div><div class="accordion-title">Cotes</div><div class="accordion-sub">Données réelles Odds-API.io / Unibet</div></div><span class="arrow">⌄</span></summary><div class="accordion-content" id="odds"></div></details>'+
 '<details class="accordion"><summary><span class="accordion-icon">▥</span><div><div class="accordion-title">Statistiques détaillées</div><div class="accordion-sub">Données domicile / extérieur et indicateurs saison</div></div><span class="arrow">⌄</span></summary><div class="accordion-content" id="stats"></div></details></div>';
 renderOverview(m);renderStandings(m,standings);renderAnalysis(m,season,ht,at);renderOdds(m);renderStats(m,ht,at);
}
function averageCard(name,t){
 const played=Number(t?.played)||0,forAvg=avg(t,"goals_for"),against=avg(t,"goals_against");
 return '<div class="average-card"><strong>'+esc(name)+'</strong><div class="average-metric"><span>Moy. buts marqués</span><b>'+(forAvg===null?"—":num(forAvg))+'</b></div><div class="average-metric"><span>Moy. buts encaissés</span><b>'+(against===null?"—":num(against))+'</b></div><small>'+played+' matchs terminés · '+esc(state.selected.season)+'</small></div>';
}
function formFor(name,slug){
 const team=state.data.form.teams?.[norm(name)];const all=Array.isArray(team?.matches)?team.matches.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))):[];
 const same=all.filter(x=>String(x.competition_id||"").toLowerCase()===String(slug||"").toLowerCase()).slice(-5);
 const other=all.filter(x=>String(x.competition_id||"").toLowerCase()!==String(slug||"").toLowerCase()).slice(-2);
 return {matches:same.concat(other).sort((a,b)=>String(a.date).localeCompare(String(b.date))),same};
}
function h2hFor(m){
 const h=norm(m.home_team),a=norm(m.away_team);
 const pair=Object.values(state.data.h2h.pairs||{}).find(p=>{const x=norm(p.team_a),y=norm(p.team_b);return (x===h&&y===a)||(x===a&&y===h)});
 return (pair?.matches||[]).slice().sort((x,y)=>String(y.date).localeCompare(String(x.date)));
}
function renderOverview(m){
 const body=$("#overview");const cards=[m.home_team,m.away_team].map(name=>{
 const f=formFor(name,m.competition_slug),counts={V:0,N:0,D:0};
 f.same.forEach(x=>{if(counts[x.result]!==undefined)counts[x.result]++});
 const chips=f.matches.map(x=>'<span class="form-chip '+(x.result==="V"?"win":x.result==="N"?"draw":x.result==="D"?"loss":"")+'" title="'+esc(x.date+" · "+x.opponent+" · "+x.score)+'">'+esc(x.result||"—")+'</span>').join("");
 return '<section class="history-team-form"><div class="history-team-heading"><strong>'+esc(name)+'</strong><span>'+f.matches.length+' matchs</span></div><div class="history-form-results">'+(chips||"Historique indisponible")+'</div><div class="history-form-stats"><span><b>'+counts.V+'</b><small>Victoires</small></span><span><b>'+counts.N+'</b><small>Nuls</small></span><span><b>'+counts.D+'</b><small>Défaites</small></span></div><small class="muted">5 derniers matchs de la compétition + jusqu’à 2 autres compétitions.</small></section>';
 }).join("");
 const rows=h2hFor(m);const hrows=rows.map(x=>'<div class="h2h-row"><span>'+esc(dateFmt.format(new Date(x.date)))+'</span><span>'+esc(x.home)+'</span><b>'+esc(x.score_home)+' – '+esc(x.score_away)+'</b><span>'+esc(x.away)+'</span></div>').join("");
 body.innerHTML='<div class="history-grid">'+cards+'</div><h4>Confrontations directes · toutes compétitions</h4>'+(rows.length?'<div class="h2h-list">'+hrows+'</div>':'<p class="muted">Aucune confrontation directe disponible dans les archives.</p>')+'<p class="data-meta">Historique généré le '+esc(stamp(state.data.form.generated_at_utc))+' · PitchAPI.</p>';
}

function renderStandings(m,competition){
 const body=$("#standings");
 if(!competition||!Array.isArray(competition.standings)||!competition.standings.length){body.innerHTML='<p>Classement indisponible pour cette compétition et cette saison.</p>';return}
 const rows=competition.standings.map(t=>'<tr class="'+([String(m.home_team_id),String(m.away_team_id)].includes(String(t.team_id))?'highlight':'')+'"><td>'+esc(t.position)+'</td><td>'+esc(t.team_name)+'</td><td>'+esc(t.played)+'</td><td>'+esc(t.wins)+'</td><td>'+esc(t.draws)+'</td><td>'+esc(t.losses)+'</td><td>'+esc(t.goals_for)+':'+esc(t.goals_against)+'</td><td>'+esc(t.goal_difference)+'</td><td><b>'+esc(t.points)+'</b></td></tr>').join("");
 body.innerHTML='<div class="standings-meta">'+esc(competition.name)+' · '+esc(competition.season)+' · '+competition.standings.length+' équipes</div><div class="table-scroll"><table class="standings-table"><thead><tr><th>#</th><th>Équipe</th><th>J</th><th>V</th><th>N</th><th>D</th><th>BP:BC</th><th>Diff.</th><th>Pts</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="muted">Source : standings.json · mis à jour le '+esc(stamp(state.data.standings.updated_at||state.data.standings.generated_at))+'</p>';
}
\nfunction renderAnalysis(m,competition,home,away){
 const body=$("#analysis");
 if(!competition||competition.season!==m.season){body.innerHTML='<p>Statistiques indisponibles : aucune donnée pour cette compétition et cette saison. Aucun remplacement par une autre saison ou compétition.</p>';return}
 const renderTeam=(name,t)=>{
 if(!t)return '<section class="stat-team"><h4>'+esc(name)+'</h4><p>Données insuffisantes.</p></section>';
 const played=Number(t.played)||0;
 const markets=[["over_0_5","Over 0,5"],["over_1_5","Over 1,5"],["over_2_5","Over 2,5"],["over_3_5","Over 3,5"],["under_2_5","Under 2,5"]];
 const bars=markets.map(([k,label])=>{const v=t.markets?.[k];const pct=v&&Number(v.played)===played?Number(v.percentage):null;return '<div class="market-row"><span>'+label+'</span><div class="bar"><i style="width:'+(pct===null?0:Math.max(0,Math.min(100,pct)))+'%"></i></div><b>'+(pct===null?"—":num(pct,1)+" %")+'</b><small>'+(v?esc(v.count)+" / "+esc(v.played):"Donnée indisponible")+'</small></div>'}).join("");
 return '<section class="stat-team"><div class="stat-team-heading"><h4>'+esc(name)+'</h4><span>'+played+' matchs</span></div><div class="stat-pills"><span>Marqués <b>'+esc(t.goals_for)+'</b></span><span>Encaissés <b>'+esc(t.goals_against)+'</b></span><span>Moyenne totale <b>'+num(t.average_total_goals)+'</b></span></div>'+bars+'</section>';
 };
 body.innerHTML='<div class="season-meta"><strong>'+esc(competition.name)+'</strong><span>'+esc(competition.season)+' · '+esc(competition.matches_counted)+' matchs retenus dans la compétition</span></div><div class="season-grid">'+renderTeam(m.home_team,home)+renderTeam(m.away_team,away)+'</div><p class="muted">Fréquences historiques calculées sur les matchs terminés de la même compétition et de la même saison. Elles ne constituent pas des probabilités prédictives. Source : '+esc(state.data.season.provider)+' · '+esc(stamp(state.data.season.generated_at_utc))+'</p>';
}
function renderOdds(m){
 const d=state.data.odds;const event=(d.events||[]).find(x=>String(x.pitchapi_match_id)===String(m.match_id));
 const body=$("#odds");
 if(!event||!Array.isArray(event.markets)||!event.markets.length){body.innerHTML='<div class="empty-state"><strong>Cotes indisponibles</strong><p>'+esc(d.status||"Aucun événement associé")+' · '+esc(d.bookmaker||"Bookmaker")+'. Aucune cote n’est affichée car aucune donnée exploitable n’est présente pour ce match.</p><small>Mise à jour : '+esc(stamp(d.generated_at_utc))+'</small></div>';return}
 body.innerHTML='<div class="odds-meta">'+esc(event.bookmaker||d.bookmaker||"Bookmaker")+' · Odds-API.io · '+esc(stamp(d.generated_at_utc))+'</div>'+event.markets.map(mk=>'<section class="odds-market"><h4>'+esc(mk.name)+'</h4>'+((mk.outcomes||[]).map(o=>'<div class="odds-line"><span>'+esc(o.name||o.label)+'</span><b>'+(Number.isFinite(Number(o.price))?num(o.price):"—")+'</b></div>').join("")||"Aucune cote exploitable")+'</section>').join("");
}
function renderStats(m,home,away){
 const body=$("#stats");
 const side=(name,t,key)=>{if(!t)return '<section><h4>'+esc(name)+'</h4><p>Données saison indisponibles.</p></section>';return '<section class="stat-team"><h4>'+esc(name)+'</h4><div class="stat-pills"><span>Domicile <b>'+esc(t.home_played??"—")+' matchs</b></span><span>Buts + <b>'+esc(t.home_goals_for??"—")+'</b></span><span>Buts − <b>'+esc(t.home_goals_against??"—")+'</b></span></div><div class="stat-pills"><span>Extérieur <b>'+esc(t.away_played??"—")+' matchs</b></span><span>Buts + <b>'+esc(t.away_goals_for??"—")+'</b></span><span>Buts − <b>'+esc(t.away_goals_against??"—")+'</b></span></div><p class="muted">Buts inscrits 2+ : '+esc(t.scored_2plus_count??"—")+' · Matchs sans marquer : '+esc(t.scored_0_count??"—")+'</p></section>'};
 body.innerHTML='<div class="season-grid">'+side(m.home_team,home,"home")+side(m.away_team,away,"away")+'</div><p class="muted">Données agrégées de saison issues de season-goals.json. Les données absentes restent affichées comme indisponibles.</p>';
}
function renderDataHealth(){
 const s=state.data.status,h=s.history||{},o=s.odds||{};
 $("#data-health").innerHTML='<span class="health-dot '+(s.status==="ok"?"ok":"warn")+'"></span><strong>Sources '+esc(s.label||s.status||"État inconnu")+'</strong><span>Historique : '+esc(h.competitions_collected??"—")+'/'+esc(h.competitions_total??"—")+' compétitions · '+esc(stamp(h.last_success_at_utc))+'</span><span>Cotes : '+esc(o.collection_status||"—")+' · '+esc(stamp(o.last_success_at_utc))+'</span>';
 $("#data-generated").textContent="Données de statut mises à jour le "+stamp(s.generated_at_utc)+" · calendrier : "+state.matches.length+" rencontres · "+state.data.standings.competitions.length+" classements disponibles.";
}
$("#retry").addEventListener("click",()=>{ $("#error").hidden=true;$("#loading").hidden=false;load().catch(fail)});
function fail(e){$("#loading").hidden=true;$("#error").hidden=false;$("#error-message").textContent=e.message||String(e)}
load().catch(fail);
})();