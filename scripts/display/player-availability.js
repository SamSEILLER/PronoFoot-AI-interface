(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const allowedCoverage = new Set(["checked_no_issue", "issues_found", "partial", "not_checked"]);
  const allowedCategories = new Set(["injury", "suspension", "coach_decision", "doubtful", "return", "other"]);
  const allowedStatuses = new Set(["available", "unavailable", "doubtful", "unknown"]);
  const allowedConfidence = new Set(["confirmed", "probable", "uncertain"]);
  const prompt = [
    "Tu es un assistant de recherche factuelle sur les disponibilités des joueurs de football.",
    "Analyse tous les matchs fournis dans input.matches pour la période indiquée. Recherche les blessures, suspensions, retours, incertitudes et autres indisponibilités pertinentes pour chaque équipe.",
    "RÈGLES OBLIGATOIRES :",
    "1. Ne déduis jamais une absence d'une information manquante. Ne transforme pas le silence d'une source en confirmation.",
    "2. Distingue confirmed, probable et uncertain. Utilise available, unavailable, doubtful ou unknown pour status.",
    "3. Chaque fait doit avoir une source URL HTTP(S) consultable. Sans source, n'ajoute pas le fait.",
    "4. Pour chaque équipe, renseigne coverage avec checked_no_issue, issues_found, partial ou not_checked. checked_no_issue exige une vérification explicite et une source consultée ; si tu n'as pas pu vérifier, utilise partial ou not_checked.",
    "5. Conserve tous les matchs et leurs identifiants. Ne modifie pas les noms, équipes, compétitions, saisons ni dates de coup d'envoi. N'invente aucun fait.",
    "6. Mets research_status à completed si la recherche est terminée pour les deux équipes, sinon partial. Renseigne checked_at_utc avec l'heure actuelle UTC au format ISO-8601.",
    "7. Chaque fait doit contenir player_name, team_side (home/away), category (injury/suspension/coach_decision/doubtful/return/other), status (available/unavailable/doubtful/unknown), confidence (confirmed/probable/uncertain), source_url. Ajoute details, source_title et published_at_utc si disponibles.",
    "8. Garde sources sous forme de liste d'objets {url,title}. N'ajoute que les sources réellement consultées.",
    "9. Préserve les champs de chaque match, notamment previous_observations. N'efface pas les observations antérieures.",
    "SORTIE : retourne uniquement un JSON valide, sans Markdown ni commentaire, correspondant à l'objet input avec schema_version=1, document_type=pronofoot_chatgpt_player_availability, window, instructions et matches. La sortie sera enregistrée directement comme completed.json. Ne retourne surtout pas l'enveloppe {prompt,input}."
  ].join("\n");
  let pending = null;
  let completed = null;
  let completedText = "";
  const setStatus = (id, message, kind = "") => {
    const node = $(id);
    node.className = "status" + (kind ? " " + kind : "");
    node.textContent = message;
  };
  const readJson = async file => JSON.parse(await file.text());
  const validDate = value => typeof value === "string" && !Number.isNaN(Date.parse(value));
  const validatePending = data => {
    const errors = [];
    if (!data || data.schema_version !== 1 || data.document_type !== "pronofoot_chatgpt_player_availability") errors.push("Le document ne correspond pas au format PronoFoot attendu.");
    if (!Array.isArray(data.matches) || !data.matches.length) errors.push("Aucun match dans le fichier.");
    if (Array.isArray(data.matches)) {
      const ids = new Set();
      data.matches.forEach((m, i) => {
        if (!m || typeof m.match_id !== "string" || !m.match_id) errors.push("Match " + (i + 1) + " : match_id manquant.");
        else if (ids.has(m.match_id)) errors.push("Identifiant de match dupliqué : " + m.match_id);
        else ids.add(m.match_id);
      });
    }
    return errors;
  };
  const validateCompleted = data => {
    const errors = [];
    const warnings = [];
    if (!data || data.schema_version !== 1 || data.document_type !== "pronofoot_chatgpt_player_availability") errors.push("schema_version=1 et document_type pronofoot_chatgpt_player_availability sont obligatoires.");
    if (!Array.isArray(data.matches) || !data.matches.length) errors.push("Le fichier doit contenir au moins un match.");
    const pendingIds = new Set((pending && Array.isArray(pending.matches) ? pending.matches : []).map(m => m.match_id));
    const seen = new Set();
    (Array.isArray(data && data.matches) ? data.matches : []).forEach((m, i) => {
      const label = "Match " + (i + 1);
      if (!m || typeof m !== "object" || typeof m.match_id !== "string" || !m.match_id) { errors.push(label + " : match_id manquant."); return; }
      if (seen.has(m.match_id)) errors.push(m.match_id + " : identifiant dupliqué.");
      seen.add(m.match_id);
      if (pending && !pendingIds.has(m.match_id)) errors.push(m.match_id + " : identifiant absent du pending chargé.");
      if (!["completed", "partial"].includes(m.research_status)) errors.push(m.match_id + " : research_status doit être completed ou partial.");
      if (!validDate(m.checked_at_utc)) errors.push(m.match_id + " : checked_at_utc absent ou date invalide.");
      if (!m.coverage || !["home", "away"].every(side => allowedCoverage.has(m.coverage[side]))) errors.push(m.match_id + " : coverage home/away invalide.");
      if (!Array.isArray(m.facts)) errors.push(m.match_id + " : facts doit être une liste.");
      else m.facts.forEach((f, j) => {
        const p = m.match_id + " facts[" + j + "]";
        if (!f || typeof f !== "object") { errors.push(p + " : fait invalide."); return; }
        ["player_name", "team_side", "category", "status", "confidence", "source_url"].forEach(k => { if (!f[k]) errors.push(p + " : " + k + " obligatoire."); });
        if (f.team_side && !["home", "away"].includes(f.team_side)) errors.push(p + " : team_side invalide.");
        if (f.category && !allowedCategories.has(f.category)) errors.push(p + " : category invalide.");
        if (f.status && !allowedStatuses.has(f.status)) errors.push(p + " : status invalide.");
        if (f.confidence && !allowedConfidence.has(f.confidence)) errors.push(p + " : confidence invalide.");
        if (f.source_url && !/^https?:\/\//i.test(f.source_url)) errors.push(p + " : source_url doit être HTTP(S).");
      });
      if (!Array.isArray(m.sources)) errors.push(m.match_id + " : sources doit être une liste.");
      if (m.coverage && ["home", "away"].some(side => m.coverage[side] === "checked_no_issue") && (!Array.isArray(m.sources) || !m.sources.length)) warnings.push(m.match_id + " : checked_no_issue sans source au niveau du match — vérification à confirmer.");
    });
    if (pending && Array.isArray(pending.matches)) {
      const missing = pending.matches.filter(m => !seen.has(m.match_id)).length;
      if (missing) warnings.push(missing + " match(s) du pending ne figurent pas dans completed.json.");
    }
    return {errors, warnings};
  };
  $("pendingFile").addEventListener("change", async event => {
    const file = event.target.files && event.target.files[0];
    pending = null;
    $("copyPackage").disabled = true;
    if (!file) return;
    try {
      const data = await readJson(file);
      const errors = validatePending(data);
      if (errors.length) throw new Error(errors.join("\n"));
      pending = data;
      $("pendingMeta").textContent = file.name + " · " + data.matches.length + " matchs · période " + (data.window && data.window.days ? data.window.days + " jours" : "non précisée");
      setStatus("pendingStatus", "Fichier pending.json reconnu. Tu peux maintenant copier le paquet à transmettre à ChatGPT.", "ok");
      $("copyPackage").disabled = false;
    } catch (error) {
      $("pendingMeta").textContent = file.name + " · lecture impossible";
      setStatus("pendingStatus", error.message || "JSON invalide.", "error");
    }
  });
  $("copyPackage").addEventListener("click", async () => {
    if (!pending) return;
    const packageText = JSON.stringify({prompt, input: pending}, null, 2);
    try {
      await navigator.clipboard.writeText(packageText);
      setStatus("copyStatus", "Paquet copié. Colle-le dans ChatGPT. La réponse attendue est uniquement le JSON completed.json.", "ok");
    } catch {
      setStatus("copyStatus", "Copie automatique indisponible dans ce navigateur. Autorise l'accès au presse-papiers ou ouvre la page en HTTPS.", "error");
    }
  });
  $("completedFile").addEventListener("change", async event => {
    const file = event.target.files && event.target.files[0];
    completed = null;
    completedText = "";
    $("downloadCompleted").disabled = true;
    if (!file) return;
    try {
      const raw = await file.text();
      const data = JSON.parse(raw);
      const result = validateCompleted(data);
      if (result.errors.length) throw new Error(result.errors.slice(0, 12).join("\n") + (result.errors.length > 12 ? "\n… et " + (result.errors.length - 12) + " autre(s) erreur(s)." : ""));
      completed = data;
      completedText = JSON.stringify(data, null, 2) + "\n";
      $("completedMeta").textContent = file.name + " · " + data.matches.length + " matchs";
      const message = "Structure valide : " + data.matches.length + " match(s)." + (result.warnings.length ? "\nÀ vérifier :\n• " + result.warnings.join("\n• ") : "");
      setStatus("completedStatus", message, result.warnings.length ? "warn" : "ok");
      $("downloadCompleted").disabled = false;
    } catch (error) {
      $("completedMeta").textContent = file.name + " · non validé";
      setStatus("completedStatus", error.message || "JSON invalide.", "error");
    }
  });
  $("downloadCompleted").addEventListener("click", () => {
    if (!completedText) return;
    const blob = new Blob([completedText], {type:"application/json;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "completed.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
})();
