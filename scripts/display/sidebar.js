/**
 * Sidebar partagée : marque, navigation et état des sources.
 * Le HTML, les styles et le comportement du bandeau sont centralisés ici.
 */
(() => {
  "use strict";
  if (document.querySelector("[data-sidebar-root]")) return;

  const currentPath = window.location.pathname.toLowerCase();
  const activePage = currentPath.endsWith("/classements.html") ? "standings"
    : currentPath.endsWith("/history.html") ? "history" : "matches";

  const markup = "<header class=\"topbar\" data-sidebar-root>\n<a class=\"brand\" href=\"./index.html\" aria-label=\"PronoFoot AI accueil\">\n<img class=\"brand-logo\" src=\"./assets/football-ai-circuit.svg\" alt=\"Logo PronoFoot\">\n<span class=\"brand-wordmark\"><span class=\"brand-name\">PronoFoot <em>AI</em></span><br><span class=\"brand-sub\">FOOTBALL PREDICTION LAB</span></span>\n</a>\n<nav class=\"nav\" aria-label=\"Navigation principale\">\n<a href=\"./index.html\" class=\"active\" aria-current=\"page\"><img class=\"nav-icon\" src=\"./assets/icon-matches.svg\" alt=\"\" aria-hidden=\"true\">Matchs à venir</a>\n<a href=\"./history.html\"><img class=\"nav-icon\" src=\"./assets/icon-history.svg\" alt=\"\" aria-hidden=\"true\">Historique</a>\n<a href=\"./classements.html\"><img class=\"nav-icon\" src=\"./assets/icon-ranking.svg\" alt=\"\" aria-hidden=\"true\">Classements</a>\n</nav>\n<button class=\"api-status status-loading\" id=\"apiStatus\" type=\"button\" aria-expanded=\"false\" aria-controls=\"sourceStatusDetails\" aria-label=\"État des sources : vérification en cours\">\n<span class=\"status-symbol\" id=\"apiStatusSymbol\" aria-hidden=\"true\">…</span><span class=\"api-status-label\">Sources : <strong id=\"apiStatusLabel\">…</strong></span>\n</button>\n<div class=\"source-status-details\" id=\"sourceStatusDetails\" hidden>\n<div class=\"source-status-heading\">État des sources de données <span id=\"statusUpdatedAt\">Chargement…</span></div>\n<div class=\"source-status-row\"><span class=\"source-status-indicator\" id=\"historyIndicator\"></span><div><strong>Historique des matchs · PitchAPI</strong><p id=\"historyStatusText\">En attente des données…</p><small id=\"historyStatusMeta\"></small></div></div>\n<div class=\"source-status-row\"><span class=\"source-status-indicator\" id=\"oddsIndicator\"></span><div><strong>Cotes · Odds-API.io</strong><p id=\"oddsStatusText\">En attente des données…</p><small id=\"oddsStatusMeta\"></small></div></div>\n<div class=\"source-status-footnote\">Vert : deux collectes récentes sans anomalie · Orange : avertissement ou données de plus de 24 h · Rouge : les deux collectes sont en échec et anciennes.</div>\n</div>\n</header>";
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  const header = template.content.firstElementChild;
  const activeLink = header.querySelector(
    activePage === "standings" ? 'a[href="./classements.html"]'
      : activePage === "history" ? 'a[href="./history.html"]'
      : 'a[href="./index.html"]'
  );
  if (activeLink) {
    activeLink.classList.add("active");
    activeLink.setAttribute("aria-current", "page");
  }
  document.body.insertBefore(header, document.body.firstChild);

  const style = document.createElement("style");
  style.id = "sidebar-styles";
  style.textContent = "/* Shared sidebar CSS: extracted complete rules and responsive media queries. */\n.topbar{height:86px;padding:0 20px;display:flex;align-items:center;gap:25px;color:#f9fbff;background:linear-gradient(110deg,#1c2c38 0%,#293b48 57%,#1b303e 100%);box-shadow:0 2px 8px #172e3b18}\n\n.brand{display:flex;align-items:center;gap:12px;min-width:290px;text-decoration:none;color:#fff}\n\n.brand-logo{width:56px;height:56px;flex:0 0 56px}\n\n.brand-wordmark{min-width:0}\n\n.brand-name{font-size:34px;line-height:1;font-weight:800;letter-spacing:-1.3px;white-space:nowrap}\n\n.brand-name em{font-style:normal;color:#05c77b}\n\n.brand-sub{font-size:13px;letter-spacing:1.35px;line-height:1.8;white-space:nowrap}\n\n.nav{display:flex;align-items:center;gap:4px;flex:1;min-width:0;height:100%}\n\n.nav a{height:49px;padding:0 13px;display:flex;align-items:center;justify-content:center;gap:9px;border-radius:10px;text-decoration:none;color:#f1f5f9;white-space:nowrap;font-size:15px;position:relative}\n\n.nav .nav-icon{display:block;width:19px;height:19px;min-width:19px;max-width:19px;min-height:19px;max-height:19px;flex:0 0 19px;object-fit:contain;opacity:1;}\n\n.nav a.active .nav-icon{opacity:1;}\n\n.nav a.active{background:#ffffff0d;color:#91edc1}\n\n.nav a.active:after{content:\"\";height:4px;position:absolute;bottom:0;left:14px;right:14px;background:#08c977;border-radius:5px}\n\n.nav a:hover{background:#ffffff0c}\n\n.api-status{border:1px solid #087f55;border-radius:28px;padding:11px 17px;white-space:nowrap;background:#006a4626;color:#c7f7dd;font-size:14px;display:flex;align-items:center;gap:9px}\n\n.api-status strong{color:#14df80;font-weight:650}\n\n@media(max-width:1550px){.topbar{gap:15px;padding:0 16px}.brand{min-width:255px}.brand-name{font-size:29px}.brand-logo{width:48px;height:48px;flex-basis:48px}.nav a{padding:0 8px;font-size:13px}.api-status{font-size:12px;padding:10px 12px}.workspace{grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr)}}\n\n@media(max-width:1120px){.topbar{height:auto;min-height:82px;flex-wrap:wrap;padding:12px 16px;gap:10px}.brand{min-width:0;flex:1}.nav{order:3;flex-basis:100%;height:45px;overflow-x:auto}.api-status{margin-left:auto}.workspace{grid-template-columns:1fr;min-height:0}.panel{min-height:360px}}\n\n@media(max-width:650px){main{padding:10px}.topbar{padding:11px 10px}.brand-logo{width:40px;height:40px;flex-basis:40px}.brand-name{font-size:24px}.brand-sub{font-size:9px;letter-spacing:1px}.api-status{font-size:10px;padding:8px 10px;gap:5px}.dot{width:9px;height:9px}.nav a{font-size:12px;padding:0 9px}.panel{min-height:280px}.footer{padding:0 10px 14px}}\n\n/* Responsive layout refinements */\n.nav a:focus-visible,.brand:focus-visible{outline:2px solid #ffffff;outline-offset:3px}\n\n@media(max-width:1120px){\n .topbar{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;height:auto;min-height:0;padding:12px 18px;gap:12px 16px}\n .brand{min-width:0;flex:initial}\n .nav{grid-column:1/-1;grid-row:2;order:initial;display:flex;flex-wrap:wrap;justify-content:flex-start;gap:6px;height:auto;min-height:46px;overflow:visible}\n .nav a{flex:0 0 auto;min-height:44px}\n .api-status{grid-column:2;grid-row:1;margin:0;justify-self:end;max-width:100%;font-size:12px;padding:9px 12px}\n}\n\n@media(max-width:650px){\n .topbar{grid-template-columns:minmax(0,1fr);padding:12px 12px 10px;gap:10px}\n .brand{grid-column:1;grid-row:1;gap:9px}\n .brand-logo{width:42px;height:42px;flex:0 0 42px}\n .brand-name{font-size:25px;letter-spacing:-.8px}\n .brand-sub{font-size:9px;letter-spacing:1px;line-height:1.5}\n .api-status{grid-column:1;grid-row:2;justify-self:start;margin:0;font-size:11px;padding:7px 10px}\n .nav{grid-column:1;grid-row:3;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;width:100%;min-height:0}\n .nav a{height:auto;min-height:58px;padding:7px 3px;display:flex;flex-direction:column;gap:4px;font-size:11px;line-height:1.2;white-space:normal;text-align:center;border-radius:8px}\n .nav .nav-icon{width:19px;height:19px;min-width:19px;max-width:19px;min-height:19px;max-height:19px;flex-basis:19px}\n .nav a.active:after{height:3px;left:10px;right:10px}\n\n}\n\n@media(max-width:360px){\n .brand-name{font-size:20px}\n .brand-logo{width:32px;height:32px;flex-basis:32px}\n .nav a{font-size:11px}\n .api-status{font-size:9px}\n}\n\n@media(max-width:650px){\n .topbar{grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;align-items:center;column-gap:8px;row-gap:10px}\n .brand{grid-column:1;grid-row:1;min-width:0;gap:7px}\n .api-status{grid-column:2;grid-row:1;justify-self:end;align-self:center;margin:0;max-width:100%}\n .nav{grid-column:1/-1;grid-row:2;margin-top:14px}\n\n .brand-logo{width:36px;height:36px;flex:0 0 36px}\n .brand-name{font-size:21px;letter-spacing:-.65px}\n .brand-sub{font-size:8px;letter-spacing:.8px;line-height:1.35}\n .nav a{font-size:14px;min-height:57px;padding:7px 3px;gap:4px}\n .nav .nav-icon{width:18px;height:18px;min-width:18px;max-width:18px;min-height:18px;max-height:18px;flex-basis:18px}\n .api-status{font-size:10px;line-height:1.15;padding:6px 8px;gap:5px;border-radius:18px}\n .api-status .dot{width:7px;height:7px;box-shadow:0 0 7px #08d46b55}\n}\n\n/* Live health indicator for the two upstream data collections */\n.topbar{position:relative}\n\n.api-status{appearance:none;font-family:inherit;cursor:pointer;gap:8px;padding:7px 12px;border-radius:22px;font-size:13px;line-height:1.2;transition:border-color .15s,background .15s}\n\n.api-status:focus-visible{outline:2px solid currentColor;outline-offset:3px}\n\n.status-symbol{width:19px;height:19px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 19px;border-radius:50%;font-size:13px;font-weight:900;line-height:1}\n\n.api-status-label{white-space:nowrap;color:#f8fafc;font-weight:650}\n\n.api-status-label strong{font-weight:800}\n\n.api-status.status-ok{border-color:#08b968;background:#063d2b;color:#08e080}\n\n.api-status.status-ok .status-symbol{background:#08c875;color:#062c20}\n\n.api-status.status-ok .api-status-label strong{color:#24e58b}\n\n.api-status.status-warning{border-color:#e5a51a;background:#49340b;color:#ffd15a}\n\n.api-status.status-warning .status-symbol{background:#f0ad24;color:#382500}\n\n.api-status.status-warning .api-status-label strong{color:#ffd34f}\n\n.api-status.status-error{border-color:#ef5350;background:#481c22;color:#ff7774}\n\n.api-status.status-error .status-symbol{background:#ef5350;color:#fff}\n\n.api-status.status-error .api-status-label strong{color:#ff7774}\n\n.api-status.status-loading .status-symbol,.source-status-indicator.status-loading{background:#718096;color:#fff}\n\n.source-status-indicator.status-ok{background:#08d46b;box-shadow:0 0 10px #08d46b55}\n\n.source-status-indicator.status-warning{background:#f0a52b;box-shadow:0 0 9px #f0a52b55}\n\n.source-status-indicator.status-error{background:#ef4444;box-shadow:0 0 9px #ef444455}\n\n.source-status-details{position:absolute;z-index:20;right:18px;top:calc(100% - 2px);width:min(430px,calc(100vw - 24px));padding:15px;background:#fff;color:#0a1b46;border:1px solid #dce6f1;border-radius:12px;box-shadow:0 12px 35px #142b4530}\n\n.source-status-heading{display:flex;justify-content:space-between;gap:12px;align-items:center;font-weight:750;font-size:13px;margin-bottom:13px}\n\n.source-status-heading span{font-size:10px;font-weight:500;color:#71839a;text-align:right}\n\n.source-status-row{display:flex;gap:10px;padding:10px 0;border-top:1px solid #edf1f6}\n\n.source-status-indicator{width:9px;height:9px;flex:0 0 9px;border-radius:50%;margin-top:5px;background:#9aa8b5}\n\n.source-status-row strong{font-size:12px}\n\n.source-status-row p{margin:3px 0;color:#4f6d99;font-size:12px}\n\n.source-status-row small{color:#7a8ba2;font-size:10px;line-height:1.4}\n\n.source-status-footnote{border-top:1px solid #edf1f6;padding-top:10px;margin-top:4px;color:#71839a;font-size:10px;line-height:1.5}\n\n@media(max-width:650px){.source-status-details{right:8px;top:calc(100% - 2px)}.api-status{max-width:100%;min-width:0}}\n\n/* Mobile header: slightly more compact brand group */\n@media(max-width:650px){\n .brand{min-width:max-content;flex-shrink:0;gap:6px}\n .brand-logo{width:36px;height:36px;flex:0 0 36px}\n .brand-name{font-size:21px;letter-spacing:-.6px}\n .brand-sub{font-size:8px;letter-spacing:.8px;line-height:1.4}\n .api-status{align-items:center}\n }\n\n@media(max-width:420px){\n .topbar{grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;column-gap:6px;row-gap:10px}\n .brand{grid-column:1;grid-row:1;justify-self:start;min-width:0;gap:5px}\n .api-status{grid-column:2;grid-row:1;justify-self:end;align-self:center;margin:0;max-width:100%;font-size:9px;padding:5px 7px;gap:4px}\n .api-status .status-symbol{width:15px;height:15px;flex-basis:15px;font-size:11px}\n .nav{grid-column:1/-1;grid-row:2;margin-top:0}\n}\n\n@media(max-width:360px){\n .brand-name{font-size:21px}\n .brand-logo{width:36px;height:36px;flex:0 0 36px}\n .api-status{font-size:10px}\n}\n\n.topbar{position:sticky;top:0;z-index:50}\n\n.topbar{position:relative;top:auto;left:auto;right:auto;width:auto;z-index:10;flex:0 0 auto}\n\n/* Contenu du header, zone principale et footer alignés sur 1600px */\n.topbar{\n padding-left:max(20px,calc((100% - 1600px)/2 + 20px));\n padding-right:max(20px,calc((100% - 1600px)/2 + 20px));\n}\n\n@media(max-width:1100px){\n\n .topbar{padding-left:16px;padding-right:16px}\n}\n\n@media(max-width:650px){\n .topbar{padding-left:12px;padding-right:12px}\n}\n\n/* Harmonisation globale des arrondis */\n.nav a,\nbutton,\n.standings-toolbar,\nselect,\ninput,\n.standings-season,\n.panel,\n.standings-table-wrap{\n  border-radius:4px!important;\n}\n\n/* Harmonisation des rayons et du badge de compétition */\n.source-status-details,\n.filter-btn,\ninput.search,\n.match-detail-panel,\n.matches-list-section,\n.match-versus{\n  border-radius:5px!important;\n}\n\n/* Le fond du header reste pleine largeur ; son contenu est centré sur 1600px */\n.topbar{\n padding-left:max(20px,calc((100% - 1600px)/2 + 20px));\n padding-right:max(20px,calc((100% - 1600px)/2 + 20px));\n}\n\n@media(max-width:1120px){\n .topbar{padding-left:16px;padding-right:16px}\n}\n\n@media(max-width:650px){\n .topbar{padding-left:12px;padding-right:12px}\n}\n\n/* Fond du header pleine largeur, sans arrondi */\n.topbar{border-radius:0!important}\n\n/* Harmonisation des coins des liens de navigation */\n.nav a{border-radius:3px!important}";
  document.head.appendChild(style);

  const STATUS_URL = "./data/site-status.json";
  const button = header.querySelector("#apiStatus");
  const details = header.querySelector("#sourceStatusDetails");
  const label = header.querySelector("#apiStatusLabel");
  const symbol = header.querySelector("#apiStatusSymbol");
  const updated = header.querySelector("#statusUpdatedAt");

  const statusText = (source) => {
    if (!source) return "Statut non disponible";
    const state = source.status || "warning";
    const collection = source.collection_status;
    if (state === "error") return "Collecte en échec ou données indisponibles";
    if (collection === "PARTIAL") return "Collecte partielle — certains matchs ou événements restent à vérifier";
    if (state === "ok" && collection === "COMPLETE") return "Collecte complète, sans erreur signalée";
    if (state === "ok") return "Collecte réussie, données à jour";
    return "Vigilance — données ou couverture à vérifier";
  };
  const formatDate = (value) => {
    if (!value) return "Date indisponible";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Date invalide"
      : date.toLocaleString("fr-FR", {dateStyle:"short", timeStyle:"short", timeZone:"Europe/Paris"}) + " (Paris)";
  };
  const setSource = (prefix, source) => {
    const indicator = header.querySelector("#" + prefix + "Indicator");
    const text = header.querySelector("#" + prefix + "StatusText");
    const metaNode = header.querySelector("#" + prefix + "StatusMeta");
    const state = source && ["ok", "warning", "error"].includes(source.status) ? source.status : "loading";
    indicator.className = "source-status-indicator status-" + state;
    text.textContent = statusText(source);
    if (!source) {
      metaNode.textContent = "Aucune information reçue depuis le fichier de statut.";
      return;
    }
    const age = Number.isFinite(source.age_hours) ? Math.round(source.age_hours * 10) / 10 + " h" : "âge inconnu";
    const lastSuccess = source.last_success_at_utc ? "Dernière réussite : " + formatDate(source.last_success_at_utc) : "Dernière réussite inconnue";
    const provider = source.provider ? source.provider + " · " : "";
    let meta;
    if (prefix === "history") {
      const coverage = Number.isFinite(source.competitions_collected) && Number.isFinite(source.competitions_total)
        ? source.competitions_collected + "/" + source.competitions_total + " compétitions collectées"
        : "couverture des compétitions non précisée";
      meta = provider + (source.records ?? 0) + " enregistrements · " + coverage
        + " · " + (source.failed_seasons ?? 0) + " saison(s) en échec · " + (source.errors ?? 0) + " erreur(s)";
    } else {
      const summary = source.summary || {};
      const markets = Number.isFinite(summary.market_count) ? summary.market_count + " marchés" : null;
      const anomalies = Number.isFinite(source.anomalies) ? source.anomalies + " anomalie(s)" : null;
      const requests = Number.isFinite(summary.requests_attempted) && Number.isFinite(summary.request_budget)
        ? summary.requests_attempted + "/" + summary.request_budget + " requêtes utilisées" : null;
      meta = provider + (source.matched_events ?? 0) + " matchs associés · " + (source.events_with_odds ?? 0)
        + " avec cotes · " + (source.unmatched ?? 0) + " non associés"
        + (markets ? " · " + markets : "") + (anomalies ? " · " + anomalies : "")
        + (requests ? " · " + requests : "") + " · " + (source.errors ?? 0) + " erreur(s)";
    }
    metaNode.textContent = meta + " · " + age + " · " + lastSuccess;
  };

  button.addEventListener("click", () => {
    const opening = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(opening));
    details.hidden = !opening;
  });
  document.addEventListener("click", (event) => {
    if (!details.hidden && !details.contains(event.target) && !button.contains(event.target)) {
      details.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }
  });
  fetch(STATUS_URL + "?v=" + Date.now(), {cache:"no-store"})
    .then(response => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
    .then(data => {
      const state = ["ok", "warning", "error"].includes(data.status) ? data.status : "warning";
      button.classList.remove("status-loading");
      button.classList.add("status-" + state);
      const words = state === "ok" ? "OK" : state === "error" ? "Erreur" : "Vigilance";
      symbol.textContent = state === "ok" ? "✓" : state === "error" ? "×" : "!";
      label.textContent = words;
      button.setAttribute("aria-label", "État des sources : " + words + ". Ouvrir le détail");
      updated.textContent = "Contrôle : " + formatDate(data.generated_at_utc);
      setSource("history", data.history);
      setSource("odds", data.odds);
    })
    .catch(() => {
      button.classList.remove("status-loading");
      button.classList.add("status-error");
      symbol.textContent = "×";
      label.textContent = "Erreur";
      button.setAttribute("aria-label", "État des sources : erreur. Ouvrir le détail");
      updated.textContent = "Fichier de statut inaccessible";
      setSource("history", null);
      setSource("odds", null);
    });
})();
