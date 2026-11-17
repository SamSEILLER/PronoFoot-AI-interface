(() => {
  "use strict";
  const DATA_URL = "./data/prediction-history.json";
  const $ = (id) => document.getElementById(id);
  const state = { records: [] };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dateValue = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "Date inconnue" : new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
  };
  const isEvaluable = (r) => Number.isInteger(r.actual?.home_score) && Number.isInteger(r.actual?.away_score)
    && typeof r.prediction?.over_1_5_pick === "boolean"
    && typeof r.actual?.over_1_5 === "boolean";
  const outcome = (r) => !isEvaluable(r) ? "pending" : r.prediction.over_1_5_pick === r.actual.over_1_5 ? "correct" : "incorrect";
  const pct = (n,d) => d ? (100*n/d).toFixed(1).replace(".",",")+" %" : "—";
  function filtered() {
    const comp=$("competitionFilter").value, result=$("resultFilter").value, period=$("periodFilter").value;
    const cutoff=period==="all"?0:Date.now()-Number(period)*86400000;
    return state.records.filter(r => (!comp || r.competition===comp)
      && (!result || outcome(r)===result)
      && (!cutoff || (new Date(r.kickoff_utc).getTime()>=cutoff)));
  }
  function render() {
    const rows=filtered(), evaluated=rows.filter(isEvaluable), correct=evaluated.filter(r=>outcome(r)==="correct").length;
    $("metricCount").textContent=String(evaluated.length);
    $("metricAccuracy").textContent=pct(correct,evaluated.length);
    $("metricCorrect").textContent=String(correct);
    $("metricIncorrect").textContent=String(evaluated.length-correct);
    $("rowCount").textContent=rows.length+" match"+(rows.length>1?"s":"");
    $("emptyState").hidden=rows.length!==0;
    $("historyRows").innerHTML=rows.map(r=>{
      const status=outcome(r), score=isEvaluable(r)?r.actual.home_score+" - "+r.actual.away_score:"—";
      const pick=r.prediction?.over_1_5_pick===true?"+1,5 OUI":r.prediction?.over_1_5_pick===false?"+1,5 NON":"Non renseigné";
      const probability=Number.isFinite(r.prediction?.over_1_5_probability)?pct(r.prediction.over_1_5_probability,1):"—";
      const label=status==="correct"?"Juste":status==="incorrect"?"Faux":"En attente";
      return "<tr><td>"+esc(dateValue(r.kickoff_utc))+"</td><td>"+esc(r.competition||"—")+"</td><td class='teams'>"+esc(r.home_team)+" – "+esc(r.away_team)+"</td><td class='score'>"+esc(score)+"</td><td>"+esc(pick)+"</td><td>"+esc(probability)+"</td><td><span class='pill "+status+"'>"+label+"</span></td></tr>";
    }).join("");
  }
  async function init() {
    try {
      const response=await fetch(DATA_URL,{cache:"no-store"});
      if(!response.ok) throw new Error("archive_absent");
      const payload=await response.json();
      state.records=Array.isArray(payload.records)?payload.records:[];
      const comps=[...new Set(state.records.map(r=>r.competition).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));
      comps.forEach(name=>{const option=document.createElement("option");option.value=name;option.textContent=name;$("competitionFilter").appendChild(option);});
      $("archiveNotice").textContent=state.records.length
        ? "Archive chargée : "+state.records.length+" pronostic(s) enregistré(s). Les statistiques portent uniquement sur les prévisions comparables à un résultat final."
        : "Archive initialisée mais vide : aucun ancien pronostic ne sera reconstitué artificiellement.";
      render();
    } catch(error) {
      $("archiveNotice").textContent="Archive indisponible. La page est prête, mais le moteur doit encore publier data/prediction-history.json.";
      $("emptyState").hidden=false;
      $("historyRows").innerHTML="";
      $("metricCount").textContent="0";$("metricAccuracy").textContent="—";$("metricCorrect").textContent="0";$("metricIncorrect").textContent="0";
    }
  }
  ["competitionFilter","resultFilter","periodFilter"].forEach(id=>$(id).addEventListener("change",render));
  init();
})();