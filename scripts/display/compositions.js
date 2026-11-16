(() => {
  "use strict";
  const DATA_URL = "./data/compositions.json";
  const list = document.getElementById("matches");
  const competitionFilter = document.getElementById("competition");
  const search = document.getElementById("search");
  const pitchState = document.getElementById("pitchapi-state");
  const apiState = document.getElementById("apifootball-state");
  let records = [];

  const dateText = value => {
    if (!value) return "Date de match indisponible";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "Date invalide" :
      d.toLocaleString("fr-FR", {dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Paris"}) + " (Paris)";
  };
  const labelStatus = (status, provider) => ({
    provided:"Données joueurs reçues",
    partial:"Effectif partiel — une équipe seulement",
    metadata_only:"Métadonnées uniquement — aucun joueur listé",
    not_provided: provider === "API-Football" ? "Aucune absence retournée (couverture à vérifier)" : "Non communiqué par PitchAPI",
    not_available:"Indisponible",
    collection_error:"Erreur de collecte",
    not_supported_by_provider:"Non pris en charge par le fournisseur",
    not_collected_until_official_lineup_window:"Composition officielle non collectée à cette échéance",
    mapping_not_found:"Match non rapproché entre fournisseurs",
    plan_limited:"Limitation du forfait API-Football",
    outside_plan_window:"Hors fenêtre de dates du forfait"
  }[status] || "Statut non déterminé");
  const pillClass = status => status === "provided" ? "ok" :
    status === "collection_error" ? "err" : "warn";

  function addSnapshot(parent, record) {
    const box = document.createElement("article");
    box.className = "snapshot";
    const head = document.createElement("div");
    head.className = "snapshot-head";
    const title = document.createElement("span");
    title.textContent = (record.snapshot || "Instantané") + " · " + (record.provider || "Source inconnue");
    const pill = document.createElement("span");
    pill.className = "pill " + pillClass(record.status);
    pill.textContent = labelStatus(record.status, record.provider);
    head.append(title, pill);
    box.append(head);

    const info = document.createElement("p");
    info.textContent = (record.message || labelStatus(record.status)) +
      " · Collecté : " + dateText(record.collected_at_utc);
    box.append(info);

    if (record.provider === "API-Football") {
      const mappingLabel = ({
        matched:"Match rapproché entre fournisseurs",
        outside_plan_window:"Hors fenêtre de dates du forfait",
        not_found:"Match non retrouvé dans API-Football",
        invalid_fixture_id:"Identifiant de match API-Football invalide"
      }[record.mapping_status] || "Rapprochement : " + (record.mapping_status || "inconnu"));
      info.textContent = (record.message || mappingLabel)
        + " · " + mappingLabel
        + " · Effectifs : " + ({provided:"Deux effectifs reçus",partial:"Effectif partiel",not_provided:"Effectifs non fournis"}[record.squads_status] || "Effectifs : " + (record.squads_status || "non vérifié"))
        + " · Signalements équipe/date : " + labelStatus(record.team_injuries_status, record.provider)
        + " · Compositions : " + labelStatus(record.lineups_status, record.provider)
        + " · Blessures/suspensions : " + labelStatus(record.injuries_status, record.provider)
        + " · Collecté : " + dateText(record.collected_at_utc);
      for (const [titleText, value] of [
        ["Effectif domicile · API-Football", record.home_squad],
        ["Effectif extérieur · API-Football", record.away_squad],
        ["Signalements d'absence · domicile", record.home_team_injuries],
        ["Signalements d'absence · extérieur", record.away_team_injuries],
        ["Compositions API-Football", record.lineups],
        ["Blessures et suspensions API-Football", record.injuries]
      ]) {
        if (value === null || value === undefined) continue;
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        const players = Array.isArray(value.players) ? value.players : Array.isArray(value.records) ? value.records : null;
        const countLabel = titleText.includes("Signalements") ? " signalements" : " joueurs";
        summary.textContent = titleText + (players ? " (" + players.length + countLabel + ")" : "");
        details.append(summary);
        if (players && players.length) {
          const roster = document.createElement("ul");
          roster.className = "roster-list";
          players.forEach(player => {
            const item = document.createElement("li");
            const person = player.player && typeof player.player === "object" ? player.player : player;
            const name = person.name || "Joueur sans nom";
            const number = person.number ? " · #" + person.number : "";
            const position = person.position ? " · " + person.position : "";
            const reason = person.reason || person.type;
            const date = player.fixture?.date ? " · " + dateText(player.fixture.date) : "";
            item.textContent = name + number + position + (reason ? " · " + reason : "") + date;
            roster.append(item);
          });
          details.append(roster);
        }
        const pre = document.createElement("pre");
        pre.textContent = JSON.stringify(value, null, 2);
        details.append(pre);
        box.append(details);
      }
    } else if (record.status === "provided" && record.lineups !== null && record.lineups !== undefined) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Voir la réponse détaillée du fournisseur";
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(record.lineups, null, 2);
      details.append(summary, pre);
      box.append(details);
    }
    parent.append(box);
  }

  function render() {
    const selected = competitionFilter.value;
    const term = search.value.trim().toLocaleLowerCase("fr");
    const filtered = records.filter(r => {
      const teams = [r.home_team, r.away_team].filter(Boolean).join(" ").toLocaleLowerCase("fr");
      return (!selected || r.competition === selected) && (!term || teams.includes(term));
    });
    list.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = records.length
        ? "Aucun match ne correspond à ces filtres."
        : "Aucun instantané de composition n'est encore disponible. Cela ne signifie pas qu'aucun joueur n'est absent.";
      list.append(empty);
      return;
    }

    const groups = new Map();
    filtered.forEach(record => {
      const key = String(record.match_id);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });
    for (const snapshots of groups.values()) {
      snapshots.sort((a,b) => ["J-7","J-2","J-1"].indexOf(a.snapshot) - ["J-7","J-2","J-1"].indexOf(b.snapshot));
      const first = snapshots[0];
      const card = document.createElement("article");
      card.className = "match-card";
      const heading = document.createElement("h2");
      heading.textContent = (first.home_team || "Équipe domicile") + " — " + (first.away_team || "Équipe extérieure");
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = (first.competition || "Compétition inconnue") + " · " + dateText(first.kickoff_utc);
      const snapshotList = document.createElement("div");
      snapshotList.className = "snapshot-list";
      snapshots.forEach(record => addSnapshot(snapshotList, record));
      card.append(heading, meta, snapshotList);
      list.append(card);
    }
  }

  fetch(DATA_URL + "?v=" + Date.now(), {cache:"no-store"})
    .then(response => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
    .then(payload => {
      records = Array.isArray(payload.records) ? payload.records : [];
      const sources = payload.sources || {};
      const pitch = sources.pitchapi || {};
      const api = sources.api_football || {};
      pitchState.textContent = pitch.message || ("Statut : " + (pitch.status || "inconnu"));
      apiState.textContent = api.message || "Source complémentaire nécessaire — non intégrée actuellement.";
      const competitions = [...new Set(records.map(r => r.competition).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));
      competitions.forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        competitionFilter.append(option);
      });
      render();
    })
    .catch(error => {
      pitchState.textContent = "Fichier de données indisponible : " + error.message;
      list.replaceChildren();
      const node = document.createElement("div");
      node.className = "error";
      node.textContent = "Les données de composition n'ont pas encore été publiées. Aucune conclusion ne peut être tirée sur les absences.";
      list.append(node);
    });
  competitionFilter.addEventListener("change", render);
  search.addEventListener("input", render);
})();
