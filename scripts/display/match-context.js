/* Import local du contexte effectifs/absences fourni par ChatGPT. */
(() => {
  "use strict";
  const STORAGE_KEY = "pronofoot.matchContext.v1";
  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  const button = document.getElementById("matchContextImportButton");
  const input = document.getElementById("matchContextFileInput");
  const statusNode = document.getElementById("matchContextImportStatus");
  let documentData = null;
  const normalize = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const safeText = (value) => typeof value === "string" ? value.trim() : "";
  const validDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const setStatus = (message, kind) => {
    if (!statusNode) return;
    statusNode.textContent = message;
    statusNode.dataset.state = kind || "neutral";
    statusNode.hidden = !message;
  };
  const validatePerson = (person, path) => {
    if (!person || typeof person !== "object" || Array.isArray(person)) throw new Error(path + " doit être un objet.");
    if (!safeText(person.name)) throw new Error("Nom de joueur manquant dans " + path + ".");
    if (person.status && !["confirmed","probable","uncertain","unavailable"].includes(person.status)) throw new Error("Statut invalide pour " + person.name + ".");
  };
  const validateTeam = (team, path) => {
    if (!team || typeof team !== "object" || Array.isArray(team)) throw new Error(path + " doit être un objet.");
    ["injuries","suspensions","doubtful","expected_lineup","confirmed_lineup"].forEach(key => {
      if (team[key] !== undefined && !Array.isArray(team[key])) throw new Error(path + "." + key + " doit être une liste.");
      (team[key] || []).forEach((person, index) => validatePerson(person, path + "." + key + "[" + index + "]"));
    });
  };
  const validatePayload = (payload) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Le fichier doit contenir un objet JSON.");
    if (payload.schema_version !== "1.0") throw new Error("Version de format non prise en charge. Version attendue : 1.0.");
    if (!validDate(payload.generated_at_utc)) throw new Error("generated_at_utc est absent ou invalide.");
    if (!payload.period || !validDate(payload.period.from_utc) || !validDate(payload.period.to_utc) || Date.parse(payload.period.to_utc) < Date.parse(payload.period.from_utc)) throw new Error("La période from_utc / to_utc est absente ou invalide.");
    if (payload.period.days_included !== 7 || payload.period.timezone !== "Europe/Paris") throw new Error("La période doit couvrir 7 jours calendaires en Europe/Paris.");
    if (!Array.isArray(payload.matches)) throw new Error("Le champ matches doit être une liste.");
    const seen = new Set();
    payload.matches.forEach((match, index) => {
      const path = "matches[" + index + "]";
      if (!match || typeof match !== "object" || Array.isArray(match)) throw new Error(path + " est invalide.");
      if (!safeText(match.provider_match_id) && !(safeText(match.competition_slug) && validDate(match.kickoff_utc) && safeText(match.home_team) && safeText(match.away_team))) throw new Error(path + " doit avoir provider_match_id ou compétition, date et équipes.");
      if (!validDate(match.kickoff_utc)) throw new Error(path + ".kickoff_utc est invalide.");
      const kickoffMs = Date.parse(match.kickoff_utc);
      if (kickoffMs < Date.parse(payload.period.from_utc) || kickoffMs > Date.parse(payload.period.to_utc)) throw new Error(path + " est en dehors de la période déclarée.");
      if (!validDate(match.verified_at_utc)) throw new Error(path + ".verified_at_utc est invalide.");
      if (!Array.isArray(match.sources)) throw new Error(path + ".sources doit être une liste.");
      match.sources.forEach((source, sourceIndex) => {
        if (!source || typeof source !== "object" || !safeText(source.name) || !/^https:\/\//i.test(safeText(source.url))) throw new Error(path + ".sources[" + sourceIndex + "] doit contenir name et URL HTTPS.");
      });
      validateTeam(match.home, path + ".home");
      validateTeam(match.away, path + ".away");
      const key = safeText(match.provider_match_id) || [match.competition_slug,match.kickoff_utc,normalize(match.home_team),normalize(match.away_team)].join("|");
      if (seen.has(key)) throw new Error("Doublon détecté : " + key);
      seen.add(key);
    });
    return payload;
  };
  const save = (payload) => {
    const serialized = JSON.stringify(payload);
    if (serialized.length > MAX_FILE_BYTES) throw new Error("Fichier trop volumineux (limite 2 Mo).");
    try { localStorage.setItem(STORAGE_KEY, serialized); } catch (_) { throw new Error("Stockage local indisponible ou saturé dans ce navigateur."); }
    documentData = payload;
  };
  const load = () => {
    if (documentData) return documentData;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) documentData = validatePayload(JSON.parse(stored));
    } catch (error) {
      console.warn("Contexte Match Context local illisible :", error);
      setStatus("Contexte enregistré illisible : réimportez un fichier JSON.", "error");
    }
    return documentData;
  };
  const matchEntry = (match) => {
    const data = load();
    if (!data || !match) return null;
    const providerId = String(match.provider_match_id || match.match_id || match.id || "");
    if (providerId) {
      const exact = data.matches.find(item => String(item.provider_match_id || item.match_id || "") === providerId);
      if (exact) return exact;
    }
    const kickoff = Date.parse(match.kickoff_utc);
    return data.matches.find(item => String(item.competition_slug || "") === String(match.competition_slug || "") && Date.parse(item.kickoff_utc) === kickoff && normalize(item.home_team) === normalize(match.home_team) && normalize(item.away_team) === normalize(match.away_team)) || null;
  };
  const renderList = (title, items) => {
    const rows = (items || []).map(item => {
      const status = item.status || "uncertain";
      const statusLabel = ({confirmed:"Confirmé",probable:"Probable",uncertain:"Incertain",unavailable:"Non disponible"})[status] || "Incertain";
      return "<li><strong>" + escape(item.name) + "</strong>" + (item.position ? " · " + escape(item.position) : "") + ' <span class="mc-status mc-' + escape(status) + '">' + statusLabel + "</span>" + (item.reason ? "<small>" + escape(item.reason) + "</small>" : "") + "</li>";
    }).join("");
    return '<section class="mc-team-block"><h4>' + escape(title) + "</h4>" + (rows ? "<ul>" + rows + "</ul>" : "<p>Aucune information fournie pour cette rubrique.</p>") + "</section>";
  };
  const renderTeam = (name, team) => {
    const value = team || {};
    return '<div class="mc-team"><h3>' + escape(name) + "</h3>" + renderList("Blessures",value.injuries) + renderList("Suspensions",value.suspensions) + renderList("Doutes / incertains",value.doubtful) + renderList("Composition probable",value.expected_lineup) + renderList("Composition confirmée",value.confirmed_lineup) + "</div>";
  };
  const renderInto = (body, match) => {
    if (!body) return;
    const entry = matchEntry(match);
    if (!entry) { body.innerHTML = '<p class="mc-empty">Aucun contexte importé pour ce match. Importez un JSON Match Context couvrant cette rencontre.</p>'; return; }
    const verified = new Date(entry.verified_at_utc);
    const generated = new Date(documentData.generated_at_utc);
    const sources = entry.sources.map(source => '<li><a href="' + escape(source.url) + '" target="_blank" rel="noopener noreferrer">' + escape(source.name) + "</a>" + (source.published_at_utc ? " · publié le " + escape(source.published_at_utc) : "") + "</li>").join("");
    body.innerHTML = '<div class="mc-context"><div class="mc-meta"><strong>Vérifié le ' + escape(verified.toLocaleString("fr-FR")) + "</strong><span>Fichier généré le " + escape(generated.toLocaleString("fr-FR")) + "</span></div>" + renderTeam(match.home_team,entry.home) + renderTeam(match.away_team,entry.away) + '<section class="mc-sources"><h4>Sources consultées</h4>' + (sources ? "<ul>" + sources + "</ul>" : "<p>Aucune source URL fournie.</p>") + '</section><p class="mc-disclaimer">Les statuts reflètent les informations du fichier importé à la date indiquée. Une composition probable n’est pas une composition officielle.</p></div>';
  };
  if (button && input) {
    button.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) { setStatus("Fichier trop volumineux (limite 2 Mo).","error"); input.value=""; return; }
      try {
        const payload = validatePayload(JSON.parse(await file.text()));
        save(payload);
        setStatus(payload.matches.length + " match(s) importé(s) · stockage local à ce navigateur.","success");
        document.dispatchEvent(new CustomEvent("pronofoot:match-context-updated"));
      } catch (error) { setStatus("Import refusé : " + error.message,"error"); }
      finally { input.value=""; }
    });
    const existing = load();
    if (existing && !statusNode?.textContent) setStatus(existing.matches.length + " match(s) déjà importé(s) · stockage local.","success");
  }
  window.PronoFootMatchContext = { renderInto, getForMatch: matchEntry };
})();
