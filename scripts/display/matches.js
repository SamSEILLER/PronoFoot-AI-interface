/**
 * Affiche tous les matchs futurs depuis le fichier public agrégé par le moteur V2.
 * Les dates sources sont UTC ; l'affichage est converti en heure de Paris.
 */
(() => {
  const DATA_URL = "./data/matches_future.json";
  const NOW = Date.now();
  const STANDINGS_URL = "./data/standings.json";
  const GOAL_PREDICTIONS_URL = "./data/goal-predictions.json";

  // Codes d'affichage uniques des 12 compétitions suivies.
  // Les identifiants PitchAPI et les slugs de données restent inchangés.
  const COMPETITION_DISPLAY_CODES = {
    "gb-premier-league":"PL", "premier league":"PL",
    "de-bundesliga":"BUN", "bundesliga":"BUN",
    "es-la-liga":"LL", "la liga":"LL", "laliga":"LL",
    "it-serie-a":"SA", "serie a":"SA",
    "fr-ligue-1":"L1", "ligue 1":"L1",
    "fr-ligue-2":"L2", "ligue 2":"L2",
    "be-first-division-a":"BPL", "belgian pro league":"BPL", "first division a":"BPL",
    "pt-primeira-liga":"PPL", "primeira liga":"PPL", "liga portugal":"PPL",
    "us-mls":"MLS", "mls":"MLS",
    "uefa-champions-league":"LDC", "champions league":"LDC", "uefa champions league":"LDC",
    "uefa-europa-league":"UEL", "europa league":"UEL", "uefa europa league":"UEL",
    "jp-j1-league":"J1", "j1 league":"J1", "japan j1 league":"J1", "j league":"J1"
  };
  const normalizeCompetitionKey = (value) => String(value || "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/\s+/g, " ");
  const getCompetitionDisplayCode = (value, fallbackName = "") => {
    const key = normalizeCompetitionKey(value);
    const nameKey = normalizeCompetitionKey(fallbackName);
    return COMPETITION_DISPLAY_CODES[key] || COMPETITION_DISPLAY_CODES[nameKey] || "";
  };

  const list = document.getElementById("upcomingMatchesList");
  const template = document.getElementById("upcomingMatchTemplate");
  if (!list || !template) return;

  // Les infobulles sont montées directement dans body pour échapper aux overflow:hidden.
  const historyTooltip = document.createElement("div");
  historyTooltip.className = "history-tooltip-portal";
  historyTooltip.setAttribute("role", "tooltip");
  historyTooltip.hidden = true;
  document.body.appendChild(historyTooltip);
  let activeHistoryTooltip = null;
  const hideHistoryTooltip = () => {
    historyTooltip.hidden = true;
    activeHistoryTooltip = null;
  };
  const showHistoryTooltip = (chip) => {
    const content = chip?.getAttribute("data-tooltip");
    if (!content) return hideHistoryTooltip();
    activeHistoryTooltip = chip;
    historyTooltip.textContent = content;
    historyTooltip.hidden = false;
    const rect = chip.getBoundingClientRect();
    const tip = historyTooltip.getBoundingClientRect();
    const margin = 8;
    let left = rect.left + rect.width / 2 - tip.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tip.width - margin));
    let top = rect.top - tip.height - 9;
    if (top < margin) top = rect.bottom + 9;
    if (top + tip.height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - tip.height - margin);
    historyTooltip.style.left = left + "px";
    historyTooltip.style.top = top + "px";
  };
  document.addEventListener("pointerover", (event) => {
    const chip = event.target.closest?.(".history-form-chip[data-tooltip]");
    if (chip) showHistoryTooltip(chip);
  });
  document.addEventListener("pointerout", (event) => {
    const chip = event.target.closest?.(".history-form-chip[data-tooltip]");
    if (chip && !chip.contains(event.relatedTarget)) hideHistoryTooltip();
  });
  document.addEventListener("focusin", (event) => {
    const chip = event.target.closest?.(".history-form-chip[data-tooltip]");
    if (chip) showHistoryTooltip(chip);
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.closest?.(".history-form-chip[data-tooltip]")) hideHistoryTooltip();
  });
  window.addEventListener("scroll", hideHistoryTooltip, true);
  window.addEventListener("resize", hideHistoryTooltip);

  const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Paris"
  });
  const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris"
  });

  const safeLogoUrl = (value) => {
    if (typeof value !== "string") return "";
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  };

  const setText = (root, field, value) => {
    const node = root.querySelector('[data-field="' + field + '"]');
    if (node) node.textContent = value == null ? "" : String(value);
    return node;
  };

  const setLogo = (root, field, value, teamName) => {
    const image = root.querySelector('[data-field="' + field + '"]');
    const url = safeLogoUrl(value);
    if (!image || !url) return;
    image.src = url;
    image.alt = "Logo " + teamName;
    image.hidden = false;
    image.addEventListener("error", () => {
      image.hidden = true;
      image.removeAttribute("src");
    }, { once: true });
  };

  // Indexe les statistiques de classement par compétition et identifiant d'équipe.
  const buildStandingsIndex = (data) => {
    const index = new Map();
    const competitions = Array.isArray(data?.competitions) ? data.competitions : [];
    competitions.forEach((competition) => {
      const teams = new Map();
      (Array.isArray(competition.standings) ? competition.standings : []).forEach((row) => {
        const teamId = row.team_id || row.team?.id;
        if (!teamId) return;
        const played = Number(row.played ?? row.matches_played);
        const position = Number(row.position);
        teams.set(String(teamId), {
          played: Number.isInteger(played) && played >= 0 ? played : null,
          position: Number.isInteger(position) && position > 0 ? position : null
        });
      });
      if (teams.size) index.set(String(competition.id), { season: competition.season || data.season, teams });
    });
    return index;
  };

  const buildGoalPredictionsIndex = (data) => {
    const source = data?.matches && typeof data.matches === "object" ? data.matches : {};
    return new Map(Object.entries(source).map(([key, value]) => [String(key), value]));
  };

  const competitionCountryFlags = {
    "be-first-division-a":"BE",
    "de-bundesliga":"DE",
    "es-la-liga":"ES",
    "fr-ligue-1":"FR",
    "fr-ligue-2":"FR",
    "gb-premier-league":"GB",
    "it-serie-a":"IT",
    "jp-j1-league":"JP",
    "pt-primeira-liga":"PT",
    "us-mls":"US",
    "uefa-champions-league":"EU",
    "uefa-europa-league":"EU"
  };
  const getCompetitionCountryFlag = (match) => {
    const slug = String(match?.competition_slug || "").trim().toLowerCase();
    if (competitionCountryFlags[slug]) return competitionCountryFlags[slug];
    const name = normalizeCompetitionKey(match?.competition);
    if (name.includes("champions league") || name.includes("ligue des champions")
      || name.includes("europa league") || name.includes("ligue europa")) return "EU";
    if (name === "ligue 1" || name === "ligue 2") return "FR";
    if (name === "mls" || name.includes("major league soccer")) return "US";
    return "";
  };
  const countryFlagHtml = (code, className) => code
    ? '<img class="' + className + '" src="./assets/flags/' + code.toLowerCase() + '.svg" alt="Drapeau ' + code + '" width="20" height="14" loading="lazy" decoding="async">'
    : "";

  let selectedMatchKey = "";

  const getEstimatedPhase = (match, standingsIndex) => {
    const competition = standingsIndex.get(String(match.competition_slug || ""));
    if (!competition || (competition.season && match.season && competition.season !== match.season)) return "";
    const homePlayed = competition.teams.get(String(match.home_team_id || ""))?.played;
    const awayPlayed = competition.teams.get(String(match.away_team_id || ""))?.played;
    if (!Number.isInteger(homePlayed) || !Number.isInteger(awayPlayed)) return "";
    return "Journée " + (Math.min(homePlayed, awayPlayed) + 1);
  };

  const renderMatch = (match, standingsIndex) => {
    const kickoff = new Date(match.kickoff_utc);
    if (!match.home_team || !match.away_team || !Number.isFinite(kickoff.getTime())) return null;

    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".upcoming-match-card");
    const time = card.querySelector('[data-field="kickoff"]');
    if (time) {
      time.innerHTML = '<span class="match-date"></span><span class="match-time"></span>';
      time.querySelector(".match-date").textContent = dateFormatter.format(kickoff);
      time.querySelector(".match-time").textContent = timeFormatter.format(kickoff);
      time.dateTime = kickoff.toISOString();
    }

    const competitionName = match.competition || "";
    const competitionDisplayName = ({
      "uefa-champions-league":"Ligue des champions",
      "uefa-europa-league":"Ligue Europa"
    })[String(match.competition_slug || "").trim().toLowerCase()] || competitionName;
    const competitionKey = competitionName.trim().toLowerCase();
    const competitionCodes = {
      "premier league":"PL", "championship":"CH", "ligue 1":"L1", "ligue 2":"L2",
      "la liga":"LL", "laliga":"LL", "serie a":"SA", "bundesliga":"BL",
      "eredivisie":"ED", "primeira liga":"P", "pro league":"BPL", "belgian pro league":"BPL",
      "champions league":"C1", "uefa champions league":"C1", "europa league":"EL",
      "uefa europa league":"EL", "conference league":"C4", "coupe de france":"CDF"
    };
    const competitionCode = competitionCodes[competitionKey]
      || competitionName.trim().split(/\s+/).filter(Boolean).map(word => word[0]).join("").slice(0, 3).toUpperCase()
      || "—";
    const competitionElement = setText(card, "competition", competitionDisplayName || competitionCode);
    if (competitionElement) competitionElement.title = competitionName || competitionCode;
    const phase = getEstimatedPhase(match, standingsIndex);
    const roundLabel = phase || match.round || "";
    const roundDisplay = typeof roundLabel === "string"
      ? roundLabel.replace(/\bJournée\s*(\d+)\b/gi, "J$1")
      : roundLabel;
    const round = setText(card, "round", roundDisplay);
    if (round) round.hidden = !phase && !match.round;

    setText(card, "home-name", match.home_team);
    setText(card, "away-name", match.away_team);
    const competitionStandings = standingsIndex.get(String(match.competition_slug || ""));
    const seasonMatches = !competitionStandings?.season || !match.season || competitionStandings.season === match.season;
    const homePosition = seasonMatches ? competitionStandings?.teams.get(String(match.home_team_id || ""))?.position : null;
    const awayPosition = seasonMatches ? competitionStandings?.teams.get(String(match.away_team_id || ""))?.position : null;
    const formatPosition = (position) => {
      const rankText = String(position ?? "").trim().replace(/^#\s*/, "").replace(/(?:er|e|ème|eme)$/i, "");
      const rank = Number(rankText);
      return Number.isInteger(rank) && rank > 0 ? "# " + rank : "";
    };
    const homePositionNode = setText(card, "home-position", formatPosition(homePosition));
    const awayPositionNode = setText(card, "away-position", formatPosition(awayPosition));
    if (homePositionNode) homePositionNode.hidden = !homePosition;
    if (awayPositionNode) awayPositionNode.hidden = !awayPosition;
    setLogo(card, "home-logo", match.provider_record?.home_team?.image_url, match.home_team);
    setLogo(card, "away-logo", match.provider_record?.away_team?.image_url, match.away_team);
    const matchKey = String(match.id || [match.competition_slug, match.kickoff_utc, match.home_team, match.away_team].join("|"));
    card.dataset.matchKey = matchKey;
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-pressed", String(matchKey === selectedMatchKey));
    card.setAttribute("aria-label", "Sélectionner le match " + match.home_team + " contre " + match.away_team);
    if (matchKey === selectedMatchKey) card.classList.add("is-selected");
    return fragment;
  };

  Promise.all([
    fetch(DATA_URL + "?v=" + Date.now(), { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); }),
    fetch(STANDINGS_URL + "?v=" + Date.now(), { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
      .catch((error) => { console.warn("Classements indisponibles : numéros de classement et de journée masqués.", error); return null; }),
    fetch(GOAL_PREDICTIONS_URL + "?v=" + Date.now(), { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
      .catch((error) => { console.warn("Estimations de buts attendus indisponibles.", error); return null; }),
    fetch("./data/match-analytics.json?v=" + Date.now(), { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
      .catch((error) => { console.warn("Statistiques détaillées et tirs récents indisponibles.", error); return null; }),
    fetch("./data/prediction-history.json?v=" + Date.now(), { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
      .catch((error) => { console.warn("Archive des pronostics expérimentaux indisponible.", error); return null; })
  ])
    .then(([matches, standings, goalPredictions, matchAnalytics, predictionHistory]) => {
      const matchRecords = matches;
      if (!Array.isArray(matchRecords)) throw new Error("Format de données inattendu");

      const standingsIndex = buildStandingsIndex(standings);
      const goalPredictionsIndex = buildGoalPredictionsIndex(goalPredictions);
      const predictionHistoryIndex = new Map((Array.isArray(predictionHistory?.records) ? predictionHistory.records : [])
        .map(record => [String(record.match_id || ""), record]));
      const matchAnalyticsIndex = new Map();
      (Array.isArray(matchAnalytics?.competitions) ? matchAnalytics.competitions : []).forEach((competition) => {
        const matchesById = new Map((Array.isArray(competition.matches) ? competition.matches : [])
          .map((item) => [String(item.match_id), item]));
        const teams = new Map((Array.isArray(competition.teams) ? competition.teams : [])
          .map((team) => [String(team.team_id), team]));
        matchAnalyticsIndex.set(String(competition.id), { matchesById, teams, generatedAt: matchAnalytics.generated_at_utc });
      });
      const now = NOW;
      const upcoming = matchRecords
        .filter((match) => match && match.match_category === "future" && match.status !== "cancelled")
        .filter((match) => match.home_team && match.away_team)
        .map((match) => ({ match, kickoff: Date.parse(match.kickoff_utc) }))
        .filter((entry) => Number.isFinite(entry.kickoff) && entry.kickoff > now)
        .sort((a, b) => a.kickoff - b.kickoff);

      const dateButtons = Array.from(document.querySelectorAll("[data-date-filter]"));
      const teamSearch = document.getElementById("matchTeamSearch");
      const competitionFilter = document.getElementById("competitionFilter");
      const countNode = document.getElementById("matchPeriodCount");
      let activeDateFilter = "today-tomorrow";
      let activeCompetition = "";
      if (competitionFilter) {
        const competitions = new Map();
        upcoming.forEach(({ match }) => {
          const slug = String(match.competition_slug || "");
          const name = String(match.competition || slug);
          if (slug) competitions.set(slug, name);
        });
        [...competitions.entries()]
          .sort((a, b) => a[1].localeCompare(b[1], "fr"))
          .forEach(([slug, name]) => {
            const option = document.createElement("option");
            option.value = slug;
            option.textContent = name;
            competitionFilter.appendChild(option);
          });
      }
      const dateFilterRanges = {
        "today-tomorrow": [0, 1],
        "days-2-3": [2, 3],
        "days-4-6": [4, 6],
        "days-7-13": [7, 13]
      };

      const parisDateKey = (timestamp) => {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
        }).formatToParts(new Date(timestamp));
        const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        return values.year + "-" + values.month + "-" + values.day;
      };
      const shiftDateKey = (key, days) => {
        const [year, month, day] = key.split("-").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day + days));
        return date.toISOString().slice(0, 10);
      };
      const weekdayFormatter = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long", timeZone: "Europe/Paris"
      });
      const shortWeekdayFormatter = new Intl.DateTimeFormat("fr-FR", {
        weekday: "short", timeZone: "Europe/Paris"
      });
      const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
        day: "numeric", month: "short", timeZone: "Europe/Paris"
      });
      const updateFilterLabels = () => {
        const today = parisDateKey(NOW);
        Object.entries(dateFilterRanges).forEach(([key, [startOffset, endOffset]]) => {
          const first = shiftDateKey(today, startOffset);
          const last = shiftDateKey(today, endOffset);
          const firstDate = new Date(first + "T12:00:00Z");
          const lastDate = new Date(last + "T12:00:00Z");
          const title = document.querySelector('[data-filter-title="' + key + '"]');
          const dates = document.querySelector('[data-filter-dates="' + key + '"]');
          if (title) {
            const firstDay = weekdayFormatter.format(firstDate);
            const lastDay = weekdayFormatter.format(lastDate);
            title.textContent = key === "days-7-13"
              ? "+1 semaine"
              : key === "days-4-6"
              ? Array.from({ length: endOffset - startOffset + 1 }, (_, index) => {
                  const dayKey = shiftDateKey(today, startOffset + index);
                  const dayDate = new Date(dayKey + "T12:00:00Z");
                  const abbreviation = shortWeekdayFormatter.format(dayDate);
                  return abbreviation.charAt(0).toLocaleUpperCase("fr") + abbreviation.slice(1);
                }).join(" · ")
              : firstDay.charAt(0).toLocaleUpperCase("fr") + firstDay.slice(1)
                + (startOffset === endOffset ? "" : " & " + lastDay);
          }
          if (dates) {
            dates.textContent = startOffset === 0
              ? shortDateFormatter.format(firstDate) + " & " + shortDateFormatter.format(lastDate)
              : shortDateFormatter.format(firstDate) + " – " + shortDateFormatter.format(lastDate);
          }
        });
      };
      updateFilterLabels();

      const detailPanel = document.getElementById("matchDetailPanel");
      const detailTabs = [
        { id:"overview", label:"Vue d'ensemble", icon:"<svg viewBox='0 0 24 24' aria-hidden='true'><rect x='3.5' y='3.5' width='7' height='7' rx='1.5'/><rect x='13.5' y='3.5' width='7' height='7' rx='1.5'/><rect x='3.5' y='13.5' width='7' height='7' rx='1.5'/><rect x='13.5' y='13.5' width='7' height='7' rx='1.5'/></svg>" },
        { id:"odds", label:"Cotes", icon:"<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M3.5 6.5h17v13h-17z'/><path d='M3.5 10h17M7 3.5v3M17 3.5v3M7.5 14h3M13.5 14h3M7.5 17h3'/></svg>" }
      ];
      let selectedDetailMatch = null;
      let compositionRecords = null;
      let compositionGeneratedAt = null;
      const compositionDataPromise = fetch("./data/compositions.json?v=" + Date.now(), { cache:"no-store" })
        .then(response => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
        .then(payload => {
          compositionGeneratedAt = payload?.generated_at_utc || null;
          return Array.isArray(payload.records) ? payload.records : [];
        })
        .catch(error => { console.warn("Données de composition indisponibles :", error); return null; })
        .then(records => {
          compositionRecords = records;
          if (selectedDetailMatch) renderMatchCompositions(selectedDetailMatch);
          return records;
        });
      let chatgptAvailabilityRecords = null;
      const chatgptAvailabilityPromise = fetch("./data/player-availability.json?v=" + Date.now(), { cache:"no-store" })
        .then(response => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
        .then(payload => Array.isArray(payload.records) ? payload.records : [])
        .catch(error => { console.warn("Données de disponibilité ChatGPT indisponibles :", error); return null; })
        .then(records => {
          chatgptAvailabilityRecords = records;
          if (selectedDetailMatch) renderMatchCompositions(selectedDetailMatch);
          return records;
        });
      let oddsEvents = null;
      const oddsDataPromise = fetch("./data/odds_latest.json?v=" + Date.now(), { cache:"no-store" })
        .then(response => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
        .then(payload => { oddsEvents = Array.isArray(payload?.events) ? payload.events : []; return oddsEvents; })
        .catch(error => { console.warn("Cotes OddsAPI indisponibles :", error); oddsEvents = []; return oddsEvents; });
      const weatherDataPromise = fetch("./data/weather.json?v=" + Date.now(), { cache:"no-store" })
        .then(response => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
        .then(payload => payload?.matches && typeof payload.matches === "object" ? payload.matches : {})
        .catch(error => {
          console.warn("Prévisions météo indisponibles :", error);
          return {};
        });
      let historyDataPromise = null;
      const loadHistoryData = () => {
        if (!historyDataPromise) {
          historyDataPromise = Promise.all([
            fetch("./data/recent-form.json?v=" + Date.now(), { cache:"no-store" })
              .then(response => { if (!response.ok) throw new Error("recent-form HTTP " + response.status); return response.json(); }),
            fetch("./data/head-to-head.json?v=" + Date.now(), { cache:"no-store" })
              .then(response => { if (!response.ok) throw new Error("head-to-head HTTP " + response.status); return response.json(); })
          ]).then(([recentForm, headToHead]) => ({ recentForm, headToHead }))
            .catch(error => {
              console.warn("Historique des équipes indisponible :", error);
              return { recentForm:{ teams:{} }, headToHead:{ pairs:{} } };
            });
        }
        return historyDataPromise;
      };
      const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
      const renderWeather = (body, match) => {
        body.innerHTML = "<p class=\"match-detail-empty\">Chargement de la prévision météo…</p>";
        weatherDataPromise.then(records => {
          if (selectedDetailMatch !== match || !body.isConnected) return;
          const matchId = String(match.id || match.match_id || "");
          const weather = records[matchId];
          if (!weather || typeof weather !== "object") {
            body.innerHTML = "<p class=\"match-detail-empty\">Aucune prévision météo disponible pour cette rencontre. Elle apparaîtra après une collecte réussie à J-7 ou J-2.</p>";
            return;
          }
          const hour = weather.forecast_hour || {};
          const number = (value, suffix = "", decimals = 0) => value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
            ? "Indisponible" : Number(value).toFixed(decimals) + suffix;
          const weatherCode = Number(hour.weather_code);
          const weatherLabels = {0:"Ciel dégagé",1:"Principalement dégagé",2:"Partiellement nuageux",3:"Couvert",45:"Brouillard",48:"Brouillard givrant",51:"Bruine légère",53:"Bruine modérée",55:"Bruine dense",56:"Bruine verglaçante",57:"Bruine verglaçante dense",61:"Pluie faible",63:"Pluie modérée",65:"Pluie forte",66:"Pluie verglaçante faible",67:"Pluie verglaçante forte",71:"Neige faible",73:"Neige modérée",75:"Neige forte",77:"Grains de neige",80:"Averses faibles",81:"Averses modérées",82:"Averses violentes",85:"Averses de neige faibles",86:"Averses de neige fortes",95:"Orage",96:"Orage avec grêle faible",99:"Orage avec forte grêle"};
          const condition = weatherLabels[weatherCode] || "Conditions non renseignées";
          const collected = weather.retrieved_at_utc ? new Date(weather.retrieved_at_utc) : null;
          const collectedLabel = collected && Number.isFinite(collected.getTime())
            ? new Intl.DateTimeFormat("fr-FR", {dateStyle:"short",timeStyle:"short",timeZone:"Europe/Paris"}).format(collected)
            : "Date de collecte inconnue";
          const location = [weather.stadium?.stadium_name, weather.stadium?.city].filter(Boolean).join(" · ") || "Lieu non précisé";
          const stage = weather.collection_stage ? "Prévision " + weather.collection_stage : "Prévision";
          const tiles = [
            ["Température", number(hour.temperature_2m, " °C", 1)],
            ["Ressenti", number(hour.apparent_temperature, " °C", 1)],
            ["Probabilité de pluie", number(hour.precipitation_probability, " %")],
            ["Précipitations", number(hour.precipitation ?? hour.rain, " mm", 1)],
            ["Vent moyen", number(hour.wind_speed_10m, " km/h", 1)],
            ["Rafales", number(hour.wind_gusts_10m, " km/h", 1)],
            ["Humidité", number(hour.relative_humidity_2m, " %")],
            ["Nébulosité", number(hour.cloud_cover, " %")]
          ];
          const localKickoff = hour.time_local ? new Date(hour.time_local) : null;
          const kickoffLabel = localKickoff && Number.isFinite(localKickoff.getTime())
            ? new Intl.DateTimeFormat("fr-FR", {dateStyle:"short",timeStyle:"short",timeZone:"Europe/Paris"}).format(localKickoff)
            : "Horaire local indisponible";
          const weatherUpdated = weather.updated_at_utc || weather.retrieved_at_utc || null;
          const weatherUpdatedDate = weatherUpdated ? new Date(weatherUpdated) : null;
          const weatherUpdatedLabel = weatherUpdatedDate && Number.isFinite(weatherUpdatedDate.getTime())
            ? new Intl.DateTimeFormat("fr-FR", {dateStyle:"short",timeStyle:"short",timeZone:"Europe/Paris"}).format(weatherUpdatedDate) + " (Paris)"
            : "Date de mise à jour inconnue";
          body.innerHTML = "<div class=\"match-weather-card\">" +
            "<div class=\"match-weather-heading\"><strong>" + escapeHtml(condition) + "</strong><span>" + escapeHtml(stage) + "</span></div>" +
            "<p class=\"match-weather-location\">" + escapeHtml(location) + "</p>" +
            "<div class=\"match-weather-grid\">" + tiles.map(([label,value]) => "<div class=\"match-weather-tile\"><small>" + escapeHtml(label) + "</small><strong>" + escapeHtml(value) + "</strong></div>").join("") + "</div>" +
            "<div class=\"match-weather-meta\"><span>Coup d’envoi : " + escapeHtml(kickoffLabel) + "</span><span>Collectée le " + escapeHtml(collectedLabel) + "</span></div>" +
            "<small class=\"match-weather-source\" title=\"Mise à jour : " + escapeHtml(weatherUpdatedLabel) + "\">Source : Open-Meteo · prévision indicative, susceptible d’évoluer</small>" +
            "</div>";
        });
      };
      const renderOdds = (body, match) => {
        body.innerHTML = '<p>Chargement des cotes Odds-API.io…</p>';
        oddsDataPromise.then(events => {
          if (selectedDetailMatch !== match || !body.isConnected) return;
          const event = events.find(item => String(item.pitchapi_match_id) === String(match.id || match.match_id));
          if (!event || !Array.isArray(event.markets) || !event.markets.length) {
            body.innerHTML = '<p><strong>Cotes indisponibles pour ce match.</strong><br>La collecte OddsAPI ne l’a pas encore associé à une rencontre PitchAPI.</p>';
            return;
          }
          const rows = event.markets.map(market => {
            const lines = (Array.isArray(market.odds) ? market.odds : []).map(line => {
              const parts = Object.entries(line || {}).filter(([,value]) => value !== null && value !== "");
              if (!parts.length) return "";
              return '<div class="match-odds-line">' + parts.map(([key,value]) => '<span><small>'+escapeHtml(key)+'</small> <strong>'+escapeHtml(value)+'</strong></span>').join("") + '</div>';
            }).filter(Boolean).join("");
            return '<section class="match-odds-market"><h4>'+escapeHtml(market.name)+'</h4>'+ (lines || '<p>Marché sans cote exploitable.</p>') +'</section>';
          }).join("");
          const updated = event.markets.map(market=>market.updatedAt).filter(Boolean).sort().pop();
          const updatedLabel = updated ? new Date(updated).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Paris"}) : "Non précisée";
          body.innerHTML = '<div class="match-odds-meta"><strong>'+escapeHtml(event.bookmaker || "Bookmaker")+'</strong><span>Odds-API.io</span><small>Mise à jour : '+escapeHtml(updatedLabel)+'</small></div>'+rows;
        });
      };
      const normalizeHistoryTeam = (value) => String(value || "")
        .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, " ").trim();
      let formChartInstance = null;
      let h2hChartInstance = null;
      const renderFormChart = (rows) => {
        const canvas = document.getElementById("historyFormChart");
        if (!canvas) return;
        const draw = (ChartConstructor) => {
          if (!canvas.isConnected) return;
          if (!ChartConstructor) {
            const wrapper=canvas.parentElement;
            if(wrapper) wrapper.innerHTML='<p class="history-form-chart-fallback">Graphique indisponible — les résultats détaillés restent consultables ci-dessus.</p>';
            return;
          }
          if (formChartInstance) formChartInstance.destroy();
          formChartInstance = new ChartConstructor(canvas, {
            type:"bar",
            data:{
              labels:rows.map(row=>row.name),
              datasets:[
                {label:"Victoires",data:rows.map(row=>row.V),backgroundColor:"#16A34A",borderRadius:3},
                {label:"Nuls",data:rows.map(row=>row.N),backgroundColor:"#EAB308",borderRadius:3},
                {label:"Défaites",data:rows.map(row=>row.D),backgroundColor:"#DC2626",borderRadius:3}
              ]
            },
            options:{
              indexAxis:"y",responsive:true,maintainAspectRatio:false,animation:false,
              plugins:{legend:{position:"bottom",labels:{usePointStyle:true,pointStyle:"circle",boxWidth:13,boxHeight:9,font:{size:9},padding:14}}},
              scales:{
                x:{stacked:true,beginAtZero:true,ticks:{precision:0,font:{size:9}},grid:{display:false}},
                y:{stacked:true,ticks:{font:{size:10}},grid:{display:false}}
              }
            }
          });
        };
        if (window.chartJsReady && typeof window.chartJsReady.then==="function") window.chartJsReady.then(draw);
        else draw(window.Chart);
      };
      const renderHistoryOverview = (body, match) => {
        body.innerHTML = '<p class="history-loading">Chargement de la forme récente et des confrontations…</p>';
        loadHistoryData().then(({ recentForm, headToHead }) => {
          if (selectedDetailMatch !== match || !body.isConnected || !detailPanel.querySelector('[data-detail-panel="overview"]')) return;
          const teams = recentForm?.teams || {};
          const pairs = headToHead?.pairs || {};
          const findTeam = (name) => {
            const key = normalizeHistoryTeam(name);
            if (teams[key]) return teams[key];
            return Object.values(teams).find(item => normalizeHistoryTeam(item?.name) === key) || null;
          };
          const targetCompetition = String(match.competition_slug || match.competition_id || match.provider_competition_id || "").trim().toLowerCase();
          const compactHistoryDate = (value) => {
            if (!value) return "Date inconnue";
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) :
              new Intl.DateTimeFormat("fr-FR", {day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(date);
          };
          const competitionLabel = (value) => String(value || "Compétition inconnue")
            .replace(/-/g, " ").replace(/\b\w/g, char => char.toUpperCase());
          const shortCompetition = (value) => getCompetitionDisplayCode(value)
            || competitionLabel(value).split(/\s+/).filter(Boolean).map(word => word[0]).join("").toUpperCase().slice(0,5);
          const getFormMatches = (team) => {
            const all = Array.isArray(team?.matches) ? team.matches.slice() : [];
            all.sort((a,b) => String(a.date || "").localeCompare(String(b.date || "")));
            if (!targetCompetition) {
              const recent = all.slice(-5);
              return { matches:recent, statsMatches:recent, note:"5 derniers matchs · compétition non identifiée" };
            }
            const league = all.filter(item => String(item?.competition_id || "").trim().toLowerCase() === targetCompetition).slice(-5);
            const firstLeagueMatchDate = league[0]?.date ? String(league[0].date) : "";
            const others = firstLeagueMatchDate
              ? all.filter(item => {
                  const competition = String(item?.competition_id || "").trim().toLowerCase();
                  const date = String(item?.date || "");
                  return competition && competition !== targetCompetition && date && date >= firstLeagueMatchDate;
                })
              : [];
            return {
              matches:league.concat(others).sort((a,b) => String(a.date || "").localeCompare(String(b.date || ""))),
              statsMatches:league,
              note:"5 derniers matchs du championnat en cours ; autres compétitions depuis le premier de ces matchs"
            };
          };
          const formChartStats = [];
      const formRow = (name) => {
            const team = findTeam(name);
            const selection = getFormMatches(team);
            const results = selection.matches;
            const statsMatches = Array.isArray(selection.statsMatches) ? selection.statsMatches : results;
            const stats = {V:0,N:0,D:0,gf:0,ga:0};
            statsMatches.forEach(item => {
              const result=String(item?.result || "").toUpperCase();
              if (Object.prototype.hasOwnProperty.call(stats,result)) stats[result]++;
              const score=String(item?.score || "").match(/^(\d+)\s*[-–:]\s*(\d+)$/);
              if(score){stats.gf+=Number(score[1]);stats.ga+=Number(score[2]);}
            });
            formChartStats.push({name,V:stats.V,N:stats.N,D:stats.D});
            const foreignCount = results.filter(item => {
              const competition=String(item?.competition_id || "").trim().toLowerCase();
              return Boolean(targetCompetition && competition && competition!==targetCompetition);
            }).length;
            const chips = results.map(item => {
              const result=String(item?.result || "").toUpperCase();
              const cls=result==="V"?"is-win":result==="N"?"is-draw":result==="D"?"is-loss":"is-unknown";
              const matchCompetition=String(item?.competition_id || "").trim().toLowerCase();
              const otherCompetition=Boolean(targetCompetition && matchCompetition && targetCompetition!==matchCompetition);
              const compLabel=competitionLabel(item?.competition_id);
              const tooltip=compactHistoryDate(item?.date)+" · "+compLabel+"\n"+name+" "+String(item?.score || "Score indisponible")+" "+String(item?.opponent || "Adversaire inconnu");
              return '<span class="history-form-item"><span class="history-form-chip '+cls+(otherCompetition?" is-other-competition":"")+'" data-tooltip="'+escapeHtml(tooltip)+'" tabindex="0" aria-label="'+escapeHtml((result||"Résultat inconnu")+" — "+tooltip)+'">'+escapeHtml(result||"—")+'</span>'+(otherCompetition?'<span class="history-form-other-icon" aria-hidden="true"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5"/><path d="M1.8 8h12.4M8 1.5c1.8 1.8 2.5 4 2.5 6.5S9.8 12.7 8 14.5C6.2 12.7 5.5 10.5 5.5 8S6.2 3.3 8 1.5z"/></svg></span>':'')+'</span>';
            }).join("");
            const validDates=results.map(item=>new Date(item?.date)).filter(date=>!Number.isNaN(date.getTime())).sort((a,b)=>a-b);
            const dateLabel=(date)=>new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(date);
            const periodLabel=validDates.length ? "Du "+dateLabel(validDates[0]) : "Période indisponible";
            return '<section class="history-team-form"><div class="history-team-heading"><strong>'+escapeHtml(name)+'</strong><span class="history-form-count">'+escapeHtml(periodLabel)+'</span></div>'+
              '<div class="history-form-results">'+(chips||'<span class="history-empty-inline">Aucun résultat terminé disponible.</span>')+'</div>'+
              '<div class="history-form-stats"><span><small>Buts marqués</small><b>'+stats.gf+'</b></span><span><small>Buts encaissés</small><b>'+stats.ga+'</b></span></div>'+
              '<small class="history-form-stats-note">Buts calculés uniquement sur les 5 derniers matchs du championnat en cours.</small>'+
              '</section>';
          };
          const homeKey=normalizeHistoryTeam(match.home_team);
          const awayKey=normalizeHistoryTeam(match.away_team);
          const pair=Object.values(pairs).find(item=>{
            const a=normalizeHistoryTeam(item?.team_a),b=normalizeHistoryTeam(item?.team_b);
            return (a===homeKey&&b===awayKey)||(a===awayKey&&b===homeKey);
          });
          const h2hMatches=Array.isArray(pair?.matches)?pair.matches.slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))):[];
          const h2hStats={home:0,draw:0,away:0};
          h2hMatches.forEach(item=>{
            const hs=Number(item.score_home),as=Number(item.score_away);
            if(!Number.isFinite(hs)||!Number.isFinite(as))return;
            if(hs===as)h2hStats.draw++;
            else if((hs>as&&normalizeHistoryTeam(item.home)===homeKey)||(as>hs&&normalizeHistoryTeam(item.away)===homeKey))h2hStats.home++;
            else h2hStats.away++;
          });
          const total=h2hMatches.length;
          const homePct=total?h2hStats.home/total*100:0;
          const drawPct=total?h2hStats.draw/total*100:0;
          const awayPct=total?h2hStats.away/total*100:0;
          const h2hRows=h2hMatches.map(item=>{
            const scoreHome=item.score_home??"—",scoreAway=item.score_away??"—";
            const hs=Number(item.score_home),as=Number(item.score_away);
            const valid=Number.isFinite(hs)&&Number.isFinite(as);
            const homeWon=valid&&hs!==as&&((hs>as&&normalizeHistoryTeam(item.home)===homeKey)||(as>hs&&normalizeHistoryTeam(item.away)===homeKey));
            const awayWon=valid&&hs!==as&&!homeWon;
            const outcomeClass=!valid?"unknown":hs===as?"draw":homeWon?"win":"loss";
            return '<div class="history-h2h-row"><span class="history-h2h-date">'+escapeHtml(compactHistoryDate(item.date))+'</span><span class="history-h2h-competition">'+escapeHtml(getCompetitionDisplayCode(item.competition_id, item.competition_name) || item.competition_name || competitionLabel(item.competition_id))+'</span>'+
              '<span class="history-h2h-home">'+escapeHtml(item.home||"—")+'</span><strong class="history-h2h-score '+outcomeClass+'">'+escapeHtml(scoreHome)+' – '+escapeHtml(scoreAway)+'</strong><span class="history-h2h-away">'+escapeHtml(item.away||"—")+'</span></div>';
          }).join("");
          body.innerHTML='<div class="history-overview-grid">'+
            '<section class="history-card history-form-card"><div class="history-card-heading"><span class="history-heading-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/><path d="M16 6h4v4"/></svg></span><div><h3>Forme récente</h3><p>Résultats récents des deux équipes</p></div></div>'+
            '<div class="history-form-teams">'+formRow(match.home_team)+formRow(match.away_team)+'</div></section>'+
            '<section class="history-card history-h2h-card"><div class="history-card-heading"><span class="history-heading-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><path d="M2.5 19c.5-3 2-4.5 4.5-4.5s4 1.5 4.5 4.5M12.5 19c.5-3 2-4.5 4.5-4.5s4 1.5 4.5 4.5"/><path d="M10 10h4"/></svg></span><div><h3>Confrontations directes (H2H)</h3><p>Toutes compétitions · '+total+' matchs archivés</p></div></div>'+
            (total?'<div class="history-h2h-layout"><div class="history-h2h-bars" role="img" aria-label="Répartition des résultats des confrontations directes">'+
              '<div class="history-h2h-bar-row"><div class="history-h2h-bar-label"><span class="history-h2h-dot home"></span><b>'+escapeHtml(match.home_team)+' · Victoires</b><strong>'+h2hStats.home+'</strong><small>'+Math.round(homePct)+' %</small></div><div class="history-h2h-track"><span class="home" style="width:'+homePct+'%"></span></div></div>'+
              '<div class="history-h2h-bar-row"><div class="history-h2h-bar-label"><span class="history-h2h-dot draw"></span><b>Nuls</b><strong>'+h2hStats.draw+'</strong><small>'+Math.round(drawPct)+' %</small></div><div class="history-h2h-track"><span class="draw" style="width:'+drawPct+'%"></span></div></div>'+
              '<div class="history-h2h-bar-row"><div class="history-h2h-bar-label"><span class="history-h2h-dot away"></span><b>'+escapeHtml(match.away_team)+' · Victoires</b><strong>'+h2hStats.away+'</strong><small>'+Math.round(awayPct)+' %</small></div><div class="history-h2h-track"><span class="away" style="width:'+awayPct+'%"></span></div></div>'+
              '</div><div class="history-h2h-list">'+h2hRows+'</div></div>':'<p class="history-empty">Aucune confrontation directe terminée trouvée dans les archives disponibles.</p>')+
            '</section></div>';
          renderFormChart(formChartStats);
        });
      };
      const renderMatchCompositions = (match) => {
        if (!detailPanel || !match) return;
        const target = detailPanel.querySelector('[data-detail-panel="compositions"]');
        if (!target) return;
        target.replaceChildren();

        const el = (tag, className, value) => {
          const node = document.createElement(tag);
          if (className) node.className = className;
          if (value != null) node.textContent = String(value);
          return node;
        };
        const formatDate = value => {
          if (!value) return "Date inconnue";
          const date = new Date(value);
          return Number.isFinite(date.getTime())
            ? new Intl.DateTimeFormat("fr-FR", {dateStyle:"short",timeStyle:"short",timeZone:"Europe/Paris"}).format(date) + " (Paris)"
            : "Date inconnue";
        };
        const matchId = String(match.match_id || match.provider_match_id || match.id || "");
        const teams = [
          {side:"home",name:match.home_team || "Équipe domicile"},
          {side:"away",name:match.away_team || "Équipe extérieure"}
        ];
        const records = compositionRecords === null ? [] : compositionRecords
          .filter(record => String(record.match_id || "") === matchId && record.provider === "PitchAPI")
          .sort((a,b) => {
            const priority = {"J-7":1,"J-2":2,"J-1":3,"J0":4};
            return (priority[b.snapshot]||0) - (priority[a.snapshot]||0)
              || Date.parse(b.collected_at_utc||0) - Date.parse(a.collected_at_utc||0);
          });
        const observation = chatgptAvailabilityRecords === null ? null
          : chatgptAvailabilityRecords.find(record => String(record.match_id || "") === matchId) || null;
        const lineupsOf = record => record?.lineups && typeof record.lineups === "object" ? record.lineups : {};
        const hasPlayers = record => ["home","away"].some(side => {
          const data=lineupsOf(record)[side] || {};
          return ["starters","subs"].some(key => Array.isArray(data[key]) && data[key].length);
        });
        const latest = records.find(hasPlayers) || records[0] || null;
        const latestLineups = lineupsOf(latest);
        const normalizePlayerName = value => String(value || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g," ").trim();
        const coverage = observation?.coverage || {};
        const currentFacts = Array.isArray(observation?.facts) ? observation.facts : [];
        const historicalFacts = (Array.isArray(observation?.previous_observations) ? observation.previous_observations : [])
          .flatMap(previous => (Array.isArray(previous?.facts) ? previous.facts : []).map(fact => ({
            ...fact,
            fact_checked_at_utc: fact.fact_checked_at_utc || previous.checked_at_utc
          })));
        const factMap = new Map();
        [...historicalFacts, ...currentFacts].forEach(fact => {
          const key = [fact.team_side, normalizePlayerName(fact.player_name)].join("|");
          if (!fact.player_name || !fact.team_side) return;
          const previous = factMap.get(key);
          const currentDate = Date.parse(fact.fact_checked_at_utc || observation?.checked_at_utc || 0);
          const previousDate = Date.parse(previous?.fact_checked_at_utc || observation?.checked_at_utc || 0);
          if (!previous || currentDate >= previousDate) factMap.set(key, fact);
        });
        const facts = [...factMap.values()];
        const factCount = facts.length;
        const factsCoverage = coverage;
        const hasBothStarters = latest && teams.every(t => {
          const data=latestLineups[t.side] || {};
          return Array.isArray(data.starters) && data.starters.length;
        });
        const isHistoricalXI = latest && teams.every(t => {
          const data=latestLineups[t.side] || {};
          return data.lineup_type==="lastStarting11" && data.confirmed!==true;
        });
        const compositionState = latest
          ? (isHistoricalXI ? "Derniers onze connus" : latest.status === "provided" && hasBothStarters
              ? "Compositions reçues" : hasPlayers(latest) ? "Compositions partielles" : "Aucun joueur communiqué")
          : compositionRecords === null ? "Données indisponibles" : "Aucun instantané";
        const updatedAt = latest?.collected_at_utc || compositionGeneratedAt;
        const summary = el("div","composition-overview");
        const state = el("div","composition-summary-item");
        state.append(el("span","composition-summary-label","Compositions"),el("strong","composition-pill "+(hasPlayers(latest)?"is-partial":"is-muted"),compositionState));
        const availability = el("div","composition-summary-item");
        availability.append(el("span","composition-summary-label","Disponibilités"),el("strong","composition-pill "+(factCount?"is-info":"is-muted"),factCount
          ? factCount+" information"+(factCount>1?"s":"")+" documentée"+(factCount>1?"s":"")
          : observation ? "Aucune information documentée" : "Non recherchées"));
        const updated = el("div","composition-summary-item");
        updated.append(el("span","composition-summary-label","Dernière actualisation"),el("strong","composition-summary-value",formatDate(updatedAt)));
        summary.append(state,availability,updated);
        target.append(summary);

        const tabs=el("div","composition-tabs");
        const compositionTab=el("button","composition-tab is-active","Compositions");
        const availabilityTab=el("button","composition-tab","Disponibilités");
        compositionTab.type=availabilityTab.type="button";
        compositionTab.setAttribute("aria-pressed","true");
        availabilityTab.setAttribute("aria-pressed","false");
        tabs.append(compositionTab,availabilityTab);
        const compositionsPanel=el("div","composition-tab-panel");
        compositionsPanel.dataset.compositionView="lineups";
        const availabilityPanel=el("div","composition-tab-panel");
        availabilityPanel.dataset.compositionView="availability";
        availabilityPanel.hidden=true;
        const setTab = active => {
          const showLineups=active==="lineups";
          compositionsPanel.hidden=!showLineups;
          availabilityPanel.hidden=showLineups;
          compositionTab.classList.toggle("is-active",showLineups);
          availabilityTab.classList.toggle("is-active",!showLineups);
          compositionTab.setAttribute("aria-pressed",String(showLineups));
          availabilityTab.setAttribute("aria-pressed",String(!showLineups));
        };
        compositionTab.addEventListener("click",()=>setTab("lineups"));
        availabilityTab.addEventListener("click",()=>setTab("availability"));
        target.append(tabs,compositionsPanel,availabilityPanel);

        const unavailableBySide = new Map(teams.map(team => [team.side,new Set(facts
          .filter(fact => fact.team_side===team.side && fact.status==="unavailable")
          .map(fact => normalizePlayerName(fact.player_name))
          .filter(Boolean))]));
        const playerList = (parent,title,players,side,lineupType) => {
          const details=el("details","composition-player-group");
          details.open=title==="Titulaires" || title==="Dernier onze connu";
          const displayTitle = title==="Titulaires" && lineupType==="lastStarting11" ? "Dernier onze connu" : title;
          const summaryNode=el("summary","composition-player-group-heading",displayTitle+" ("+(Array.isArray(players)?players.length:0)+")");
          details.append(summaryNode);
          if (!Array.isArray(players) || !players.length) {
            details.append(el("p","composition-empty","Aucun joueur communiqué par PitchAPI."));
          } else {
            const list=el("ul","composition-player-list");
            players.forEach(player=>{
              const person=player?.player && typeof player.player==="object" ? player.player : (player||{});
              const name=person.name || person.player_name || "Joueur sans nom";
              const meta=[person.number?"#"+person.number:"",person.position||"",person.role||person.type||""].filter(Boolean).join(" · ");
              const item=el("li","composition-player");
              const identity=el("span","composition-player-identity");
              identity.append(el("strong","",name));
              if(unavailableBySide.get(side)?.has(normalizePlayerName(name))) {
                const availabilityFact=facts.find(fact=>fact.team_side===side&&fact.status==="unavailable"&&normalizePlayerName(fact.player_name)===normalizePlayerName(name));
                const availabilityDate=availabilityFact?.published_at_utc ? " · source du "+availabilityFact.published_at_utc : "";
                const availabilityReason=availabilityFact?.details ? " : "+availabilityFact.details : "";
                const availabilityBadge=el("span","composition-player-unavailable","Indisponible · ChatGPT");
                availabilityBadge.title="Signalé indisponible par ChatGPT"+availabilityDate+availabilityReason+". PitchAPI peut encore afficher ce joueur dans un ancien onze.";
                identity.append(availabilityBadge);
                item.classList.add("has-availability-conflict");
              }
              item.append(identity);
              if(meta)item.append(el("span","composition-player-meta",meta));
              list.append(item);
            });
            details.append(list);
          }
          parent.append(details);
        };
        if (compositionRecords===null) compositionsPanel.append(el("p","composition-empty","Les données PitchAPI sont temporairement indisponibles."));
        else if (!latest) compositionsPanel.append(el("p","composition-empty","Aucun instantané PitchAPI pour ce match. L'absence de données ne signifie pas qu'un joueur est absent."));
        else {
          const cards=el("div","composition-team-grid");
          teams.forEach(team=>{
            const data=latestLineups[team.side] || {};
            const card=el("section","composition-team-card");
            const header=el("header","composition-team-heading");
            const isLastKnown = data.lineup_type==="lastStarting11" && data.confirmed!==true;
            const hasStarters = Array.isArray(data.starters)&&data.starters.length;
            header.append(el("h4","",team.name),el("span","composition-pill "+(hasStarters?(isLastKnown?"is-muted":"is-partial"):"is-muted"),hasStarters?(isLastKnown?"Indicatif":"Partielle"):"En attente"));
            const formation=el("p","composition-formation","Formation : "+(data.formation||"Non communiquée"));
            card.append(header,formation);
            if(isLastKnown) card.append(el("p","composition-source-note","PitchAPI fournit le dernier onze connu, pas une composition officielle confirmée."));
            playerList(card,"Titulaires",data.starters,team.side,data.lineup_type);
            playerList(card,"Remplaçants",data.subs,team.side,data.lineup_type);
            card.append(el("p","composition-source-note","Source : PitchAPI · instantané "+(latest.snapshot||"inconnu")+" · "+formatDate(latest.collected_at_utc||compositionGeneratedAt)));
            cards.append(card);
          });
          compositionsPanel.append(cards);
          if(records.length>1){
            const history=el("details","composition-history");
            history.append(el("summary","","Chronologie des instantanés ("+records.length+")"));
            records.forEach(record=>{
              const row=el("div","composition-history-row");
              const status=record.status==="provided"?"Joueurs reçus":record.status==="metadata_only"?"Métadonnées uniquement":record.status==="collection_error"?"Erreur de collecte":"Non communiqué";
              row.append(el("strong","",record.snapshot||"Instantané"),el("span","",status),el("small","",formatDate(record.collected_at_utc||compositionGeneratedAt)));
              history.append(row);
            });
            compositionsPanel.append(history);
          }
        }

        const coverageLabel = value => ({
          checked_no_issue:"Recherche effectuée — aucun problème signalé",
          issues_found:"Informations trouvées",
          partial:"Recherche partielle",
          not_checked:"Non vérifié"
        })[value] || "Non vérifié";
        const categoryLabel = value => ({injury:"Blessure",suspension:"Suspension",coach_decision:"Décision de l'entraîneur",doubtful:"Incertain",return:"Retour",other:"Autre"})[value] || value || "Information";
        const statusLabel = value => ({unavailable:"Indisponible",doubtful:"Incertain",available:"Disponible",unknown:"Statut inconnu"})[value] || value || "Statut inconnu";
        const confidenceLabel = value => ({confirmed:"Confirmé",probable:"Probable",uncertain:"Incertain"})[value] || value || "";
        if(chatgptAvailabilityRecords===null) availabilityPanel.append(el("p","composition-empty","Données ChatGPT temporairement indisponibles."));
        else if(!observation) availabilityPanel.append(el("p","composition-empty","Aucune recherche ChatGPT importée pour ce match. Les informations ne sont pas considérées comme vérifiées."));
        else {
          availabilityPanel.append(el("h3","composition-availability-heading","Informations documentées"));
          const grid=el("div","composition-team-grid");
          teams.forEach(team=>{
            const card=el("section","composition-team-card");
            card.append(el("h4","composition-team-heading-title",team.name));
            const coverageStatus=factsCoverage[team.side];
            card.append(el("p","composition-coverage",coverageLabel(coverageStatus)));
            const teamFacts=facts.filter(fact=>fact.team_side===team.side);
            if(!teamFacts.length) card.append(el("p","composition-empty","Aucun joueur signalé dans les informations importées. Cela ne prouve pas l'absence d'indisponibilité."));
            else {
              const list=el("ul","composition-availability-list");
              teamFacts.forEach(fact=>{
                const item=el("li","composition-availability-item");
                const top=el("div","composition-availability-top");
                top.append(el("strong","",fact.player_name||"Joueur non identifié"),el("span","composition-status-chip status-"+(fact.confidence||fact.status||"unknown"),statusLabel(fact.status)));
                item.append(top,el("p","composition-availability-meta",categoryLabel(fact.category)+" · "+confidenceLabel(fact.confidence)+(fact.fact_checked_at_utc || fact.published_at_utc || observation.checked_at_utc ? " · signalé le "+formatDate(fact.fact_checked_at_utc || fact.published_at_utc || observation.checked_at_utc) : "")));
                if(fact.details)item.append(el("p","composition-availability-details",fact.details));
                if(typeof fact.source_url==="string" && /^https?:\/\//i.test(fact.source_url)){
                  const link=el("a","composition-source-link",fact.source_title||"Consulter la source");
                  link.href=fact.source_url;link.target="_blank";link.rel="noopener noreferrer";item.append(link);
                }
                list.append(item);
              });
              card.append(list);
            }
            grid.append(card);
          });
          availabilityPanel.append(grid);
          (Array.isArray(observation.sources)?observation.sources:[]).forEach(source=>{
            if(typeof source?.url!=="string" || !/^https?:\/\//i.test(source.url))return;
            const link=el("a","composition-source-link",source.title||"Consulter la source");
            link.href=source.url;link.target="_blank";link.rel="noopener noreferrer";availabilityPanel.append(link);
          });
        }
      };

      const renderDetailAccordions = () => {
        if (!detailPanel || !selectedDetailMatch) return;
        const overview = detailPanel.querySelector('[data-detail-panel="overview"]');
        const experiment = detailPanel.querySelector('[data-detail-panel="experimentation"]');
        const experimentOver25 = detailPanel.querySelector('[data-detail-panel="experimentation-over25"]');
        const experimentBtts = detailPanel.querySelector('[data-detail-panel="experimentation-btts"]');
        const odds = detailPanel.querySelector('[data-detail-panel="odds"]');
        const weather = detailPanel.querySelector('[data-detail-panel="weather"]');
        const teamStats = detailPanel.querySelector('[data-detail-panel="team-stats"]');
        const shots = detailPanel.querySelector('[data-detail-panel="shots"]');
        renderMatchCompositions(selectedDetailMatch);
        if (overview) renderHistoryOverview(overview, selectedDetailMatch);
        if (experiment) experiment.replaceChildren();
        if (experimentOver25) experimentOver25.replaceChildren();
        if (experimentBtts) experimentBtts.replaceChildren();
        if (odds) renderOdds(odds, selectedDetailMatch);
        if (weather) renderWeather(weather, selectedDetailMatch);
        const analytics = matchAnalyticsIndex.get(String(selectedDetailMatch.competition_slug || ""));
        const renderOver15Experiment = () => {
          if (!experiment) return;
          if (!analytics) {
            experiment.innerHTML = '<p class="match-detail-empty">Données de matchs historiques indisponibles pour calculer le taux +1,5 buts.</p>';
            return;
          }
          const sides = [
            {id:String(selectedDetailMatch.home_team_id||""),name:selectedDetailMatch.home_team,side:"home"},
            {id:String(selectedDetailMatch.away_team_id||""),name:selectedDetailMatch.away_team,side:"away"}
          ];
          const teamStats = sides.map(team => {
            const entry = analytics.teams.get(team.id);
            // On retient les 10 derniers matchs terminés avec un score exploitable,
            // dans la même compétition (index analytics), la même saison et avant le match analysé.
            const recent = (entry?.recent_match_ids||[])
              .map(id=>analytics.matchesById.get(String(id))).filter(Boolean)
              .filter(item=>String(item.season||"")===String(selectedDetailMatch.season||""))
              .filter(item=>Date.parse(item.kickoff_utc||"")<Date.parse(selectedDetailMatch.kickoff_utc||""))
              .filter(item=>{
                const hg=Number(item.home_score), ag=Number(item.away_score);
                return Number.isInteger(hg)&&Number.isInteger(ag)&&hg>=0&&ag>=0;
              })
              .sort((a,b)=>String(b.kickoff_utc||"").localeCompare(String(a.kickoff_utc||"")))
              .slice(0,10);
            const over = recent.filter(item=>Number(item.home_score)+Number(item.away_score)>=2).length;
            const count = recent.length;
            const pct = count ? Math.round(over/count*100) : null;
            return {name:team.name,over,validCount:count,requestedCount:count,pct};
          });
          const cards = teamStats.map((team,index) =>
            '<section class="over15-team-card">'
              +'<div class="over15-team-heading"><strong>'+escapeHtml(team.name)+'</strong><span>'+(team.pct===null?'—':team.pct+' %')+'</span></div>'
              +'<div class="over15-progress" role="img" aria-label="'+escapeHtml(team.name)+': '+(team.pct===null?'données insuffisantes':team.pct+' %')+'"><span style="width:'+(team.pct===null?0:team.pct)+'%"></span></div>'
              +'<p>'+(team.validCount?team.over+' / '+team.validCount+' matchs avec au moins 2 buts':'Aucun score exploitable')
              +'</p></section>'
          );
          const sufficient = teamStats.every(team=>team.validCount>=2 && team.pct!==null);
          const both = teamStats.every(team=>team.pct!==null);
          let tier = null;
          if (tier === null && sufficient && both) {
            const [homePct,awayPct]=teamStats.map(team=>team.pct);
            if (homePct>=80 && awayPct>=80) tier=1;
            else if (homePct>=70 && awayPct>=70) tier=2;
            else if (homePct>=60 || awayPct>=60) tier=3;
            else tier=4;
          }
          const v1Html = (() => {
            const v1Teams = teamStats.map((team,index) => ({
              ...team,
              sideLabel: index===0 ? "Équipe domicile" : "Équipe extérieure",
              accepted: team.pct!==null && team.pct>=70
            }));
            const teamCards = v1Teams.map(team =>
              '<section class="over15-v1-team '+(team.accepted?'is-yes':'is-no')+'">'
                +'<div class="over15-v1-team-label">'+team.sideLabel+'</div>'
                +'<div class="over15-v1-team-result"><span class="over15-v1-chip">'+(team.pct===null?'INDISPONIBLE':team.accepted?'OUI':'NON')+'</span></div>'
                +'<small>'+(team.pct===null?'Critère indisponible':team.accepted?'Seuil atteint':'Seuil non atteint')+'</small>'
              +'</section>'
            ).join("");
            const v1Enough = v1Teams.every(team=>team.validCount>=2 && team.pct!==null);
            const v1Passed = v1Enough && v1Teams.every(team=>team.pct>=70);
            const v1Label = v1Enough ? (v1Passed ? 'OUI' : 'NON') : 'INDISPONIBLE';
            return '<section class="over15-v1-panel"><header><strong style="color:'+(v1Label==='OUI'?'#15803d':v1Label==='NON'?'#dc2626':'#64748b')+'">Moteur V1 · '+v1Label+'</strong><span>Fréquence +1,5 ≥ 70 % par équipe</span></header></section>';
          })();
          const v2Html = (() => {
            const v2Teams = teamStats.map((team,index) => ({
              ...team,
              sideLabel: index===0 ? "Équipe domicile" : "Équipe extérieure",
              accepted: team.pct!==null && team.pct>=80
            }));
            const enough = v2Teams.every(team=>team.validCount>=2 && team.pct!==null);
            const passed = enough && v2Teams.every(team=>team.pct>=80);
            const teamCards = v2Teams.map(team =>
              '<section class="over15-v1-team '+(team.accepted?'is-yes':'is-no')+'">'
                +'<div class="over15-v1-team-label">'+team.sideLabel+'</div>'
                +'<div class="over15-v1-team-result"><span class="over15-v1-chip">'+(team.pct===null?'INDISPONIBLE':team.accepted?'OUI':'NON')+'</span></div>'
                +'<small>'+(team.pct===null?'Critère indisponible':team.accepted?'Seuil atteint':'Seuil non atteint')+'</small>'
              +'</section>'
            ).join("");
            const v2Label = enough ? (passed ? 'OUI' : 'NON') : 'INDISPONIBLE';
            return '<section class="over15-v1-panel"><header><strong style="color:'+(v2Label==='OUI'?'#15803d':v2Label==='NON'?'#dc2626':'#64748b')+'">Moteur V2 · '+v2Label+'</strong><span>Fréquence +1,5 ≥ 80 % par équipe</span></header></section>';
          })();
          const v3Html = (() => {
            const homeId = String(selectedDetailMatch.home_team_id||"");
            const awayId = String(selectedDetailMatch.away_team_id||"");
            const cutoff = Date.parse(selectedDetailMatch.kickoff_utc||"");
            const MIN_MATCHES = 2;
            const SAMPLE_SIZE = 5;
            const validScore = item => {
              const hg=Number(item.home_score), ag=Number(item.away_score);
              return Number.isInteger(hg)&&Number.isInteger(ag)&&hg>=0&&ag>=0;
            };
            const priorMatches = teamId => {
              const entry=analytics.teams.get(teamId);
              return (entry?.recent_match_ids||[]).map(id=>analytics.matchesById.get(String(id))).filter(Boolean)
                .filter(item=>String(item.season||"")===String(selectedDetailMatch.season||""))
                .filter(item=>Date.parse(item.kickoff_utc||"")<cutoff)
                .filter(validScore)
                .sort((a,b)=>String(b.kickoff_utc||"").localeCompare(String(a.kickoff_utc||"")));
            };
            const frequency = teamId => {
              const recent=priorMatches(teamId).slice(0,SAMPLE_SIZE);
              if(recent.length<MIN_MATCHES)return {pct:null,n:recent.length,over:0};
              const over=recent.filter(item=>Number(item.home_score)+Number(item.away_score)>=2).length;
              return {pct:over/recent.length*100,n:recent.length,over};
            };
            const venueMetrics = (teamId, venue) => {
              const recent=priorMatches(teamId).filter(item=>venue==="home"
                ? String(item.home_team_id||"")===teamId
                : String(item.away_team_id||"")===teamId).slice(0,SAMPLE_SIZE);
              if(recent.length<MIN_MATCHES)return {gf:null,ga:null,n:recent.length};
              const gf=recent.reduce((sum,item)=>sum+(venue==="home"?Number(item.home_score):Number(item.away_score)),0)/recent.length;
              const ga=recent.reduce((sum,item)=>sum+(venue==="home"?Number(item.away_score):Number(item.home_score)),0)/recent.length;
              return {gf,ga,n:recent.length};
            };
            const homeFreq=frequency(homeId), awayFreq=frequency(awayId);
            const homeVenue=venueMetrics(homeId,"home"), awayVenue=venueMetrics(awayId,"away");
            const available=homeFreq.pct!==null&&awayFreq.pct!==null&&homeVenue.gf!==null&&homeVenue.ga!==null&&awayVenue.gf!==null&&awayVenue.ga!==null;
            const passed=available&&homeFreq.pct>=80&&awayFreq.pct>=80&&homeVenue.gf>=1.5&&homeVenue.ga>=1.0&&awayVenue.gf>=1.0&&awayVenue.ga>=1.5;
            const label=available?(passed?"OUI":"NON"):"INDISPONIBLE";
            const color=label==="OUI"?"#15803d":label==="NON"?"#dc2626":"#64748b";
            const sampleText="Échantillons : +1,5 "+homeFreq.n+"/5 (dom.) et "+awayFreq.n+"/5 (ext.) ; stats de lieu "+homeVenue.n+"/5 et "+awayVenue.n+"/5 (min. 2 matchs).";
            return '<section class="over15-v1-panel"><header><strong style="color:'+color+'">Moteur V3 · '+label+'</strong><span>+1,5 ≥ 80 % · jusqu’à 5 matchs (minimum 2)</span></header><div class="over15-v1-body"><small>Critères : domicile marqué ≥ 1,5 et encaissé ≥ 1,0 ; extérieur marqué ≥ 1,0 et encaissé ≥ 1,5. '+sampleText+' Données insuffisantes si un échantillon contient moins de 2 matchs.</small></div></section>';
          })();;
          const tierLabels = {1:"Très favorable",2:"Favorable",3:"Mitigé",4:"Défavorable"};
          const tierColors = {1:"success",2:"positive",3:"warning",4:"danger"};
          const tierHtml = tier===null
            ? '<div class="over15-prediction over15-tier-unavailable"><span class="over15-prediction-kicker">Pronostic expérimental</span><strong>Données insuffisantes</strong><small>2 matchs valides minimum par équipe requis.</small></div>'
            : '<div class="over15-prediction over15-tier-'+tier+'"><span class="over15-prediction-kicker">Pronostic expérimental</span><strong>Niveau '+tier+' · '+tierLabels[tier]+'</strong><small>Classement descriptif basé sur les fréquences historiques, pas une probabilité calibrée.</small></div>';
          const sampleCounts = [...new Set(teamStats.map(team=>team.validCount))];
          const sampleDescription = sampleCounts.length===1
            ? (sampleCounts[0]
              ? "Part des matchs terminés avec au moins 2 buts parmi les "+sampleCounts[0]+" derniers matchs disponibles, dans la même compétition et la même saison."
              : "Aucun match terminé avec un score exploitable n’est disponible dans la même compétition et la même saison.")
            : "Part des matchs terminés avec au moins 2 buts parmi les derniers matchs disponibles, dans la même compétition et la même saison ("+teamStats.map(team=>team.validCount+" pour "+team.name).join(", ")+").";
          experiment.innerHTML = '<section class="over15-experiment"><div class="over15-experiment-intro"><div><h4>Fréquence historique du +1,5 buts</h4><p class="over15-experiment-note">'+escapeHtml(sampleDescription)+'</p></div><span class="over15-sample-tag">10 matchs max.</span></div><div class="over15-team-grid">'+cards.join("")+'</div>'+v1Html+v2Html+v3Html+tierHtml+'<p class="over15-experiment-caveat">Indicateur descriptif du passé. Il ne constitue ni une probabilité de match ni une recommandation de pari. Les matchs sans score valide sont exclus.</p></section>';
        };
        renderOver15Experiment();
        const renderOver25Experiment = () => {
          if (!experimentOver25) return;
          if (!analytics) {
            experimentOver25.innerHTML = '<p class="match-detail-empty">Données de matchs historiques indisponibles pour calculer le taux +2,5 buts.</p>';
            return;
          }
          const sides = [
            {id:String(selectedDetailMatch.home_team_id||""),name:selectedDetailMatch.home_team,side:"home"},
            {id:String(selectedDetailMatch.away_team_id||""),name:selectedDetailMatch.away_team,side:"away"}
          ];
          const teamStats = sides.map(team => {
            const entry = analytics.teams.get(team.id);
            // Même périmètre que le +1,5 : 10 derniers matchs terminés,
            // même compétition et saison, antérieurs au coup d'envoi analysé.
            const recent = (entry?.recent_match_ids||[])
              .map(id=>analytics.matchesById.get(String(id))).filter(Boolean)
              .filter(item=>String(item.season||"")===String(selectedDetailMatch.season||""))
              .filter(item=>Date.parse(item.kickoff_utc||"")<Date.parse(selectedDetailMatch.kickoff_utc||""))
              .filter(item=>{
                const hg=Number(item.home_score), ag=Number(item.away_score);
                return Number.isInteger(hg)&&Number.isInteger(ag)&&hg>=0&&ag>=0;
              })
              .sort((a,b)=>String(b.kickoff_utc||"").localeCompare(String(a.kickoff_utc||"")))
              .slice(0,10);
            const over = recent.filter(item=>Number(item.home_score)+Number(item.away_score)>=3).length;
            const count = recent.length;
            const pct = count ? Math.round(over/count*100) : null;
            return {name:team.name,over,validCount:count,pct};
          });
          const cards = teamStats.map(team =>
            '<section class="over15-team-card">'
              +'<div class="over15-team-heading"><strong>'+escapeHtml(team.name)+'</strong><span>'+(team.pct===null?'—':team.pct+' %')+'</span></div>'
              +'<div class="over15-progress" role="img" aria-label="'+escapeHtml(team.name)+': '+(team.pct===null?'données insuffisantes':team.pct+' %')+'"><span style="width:'+(team.pct===null?0:team.pct)+'%"></span></div>'
              +'<p>'+(team.validCount?team.over+' / '+team.validCount+' matchs avec au moins 3 buts':'Aucun score exploitable')
              +'</p></section>'
          );
          const sufficient = teamStats.every(team=>team.validCount>=2 && team.pct!==null);
          let tier = null;
          if (sufficient) {
            const [homePct,awayPct]=teamStats.map(team=>team.pct);
            if (homePct>=80 && awayPct>=80) tier=1;
            else if (homePct>=70 && awayPct>=70) tier=2;
            else if (homePct>=60 || awayPct>=60) tier=3;
            else tier=4;
          }
          const v1Html = (() => {
            const v1Teams = teamStats.map((team,index) => ({
              ...team,
              sideLabel: index===0 ? "Équipe domicile" : "Équipe extérieure",
              accepted: team.pct!==null && team.pct>=70
            }));
            const teamCards = v1Teams.map(team =>
              '<section class="over15-v1-team '+(team.accepted?'is-yes':'is-no')+'">'
                +'<div class="over15-v1-team-label">'+team.sideLabel+'</div>'
                +'<div class="over15-v1-team-result"><span class="over15-v1-chip">'+(team.pct===null?'INDISPONIBLE':team.accepted?'OUI':'NON')+'</span></div>'
                +'<small>'+(team.pct===null?'Critère indisponible':team.accepted?'Seuil atteint':'Seuil non atteint')+'</small>'
              +'</section>'
            ).join("");
            const v1Enough = v1Teams.every(team=>team.validCount>=2 && team.pct!==null);
            const v1Passed = v1Enough && v1Teams.every(team=>team.pct>=70);
            const v1Label = v1Enough ? (v1Passed ? 'OUI' : 'NON') : 'INDISPONIBLE';
            return '<section class="over15-v1-panel"><header><strong style="color:'+(v1Label==='OUI'?'#15803d':v1Label==='NON'?'#dc2626':'#64748b')+'">Moteur V1 · '+v1Label+'</strong><span>Fréquence +2,5 ≥ 70 % par équipe</span></header></section>';
          })();
          const v2Html = (() => {
            const v2Teams = teamStats.map((team,index) => ({
              ...team,
              sideLabel: index===0 ? "Équipe domicile" : "Équipe extérieure",
              accepted: team.pct!==null && team.pct>=80
            }));
            const enough = v2Teams.every(team=>team.validCount>=2 && team.pct!==null);
            const passed = enough && v2Teams.every(team=>team.pct>=80);
            const teamCards = v2Teams.map(team =>
              '<section class="over15-v1-team '+(team.accepted?'is-yes':'is-no')+'">'
                +'<div class="over15-v1-team-label">'+team.sideLabel+'</div>'
                +'<div class="over15-v1-team-result"><span class="over15-v1-chip">'+(team.pct===null?'INDISPONIBLE':team.accepted?'OUI':'NON')+'</span></div>'
                +'<small>'+(team.pct===null?'Critère indisponible':team.accepted?'Seuil atteint':'Seuil non atteint')+'</small>'
              +'</section>'
            ).join("");
            const v2Label = enough ? (passed ? 'OUI' : 'NON') : 'INDISPONIBLE';
            return '<section class="over15-v1-panel"><header><strong style="color:'+(v2Label==='OUI'?'#15803d':v2Label==='NON'?'#dc2626':'#64748b')+'">Moteur V2 · '+v2Label+'</strong><span>Fréquence +2,5 ≥ 80 % par équipe</span></header></section>';
          })();
          const tierLabels = {1:"Très favorable",2:"Favorable",3:"Mitigé",4:"Défavorable"};
          const tierHtml = tier===null
            ? '<div class="over15-prediction over15-tier-unavailable"><span class="over15-prediction-kicker">Pronostic expérimental</span><strong>Données insuffisantes</strong><small>2 matchs valides minimum par équipe requis.</small></div>'
            : '<div class="over15-prediction over15-tier-'+tier+'"><span class="over15-prediction-kicker">Pronostic expérimental</span><strong>Niveau '+tier+' · '+tierLabels[tier]+'</strong><small>Classement descriptif basé sur les fréquences historiques, pas une probabilité calibrée.</small></div>';
          const sampleCounts = [...new Set(teamStats.map(team=>team.validCount))];
          const sampleDescription = sampleCounts.length===1
            ? (sampleCounts[0]
              ? "Part des matchs terminés avec au moins 3 buts parmi les "+sampleCounts[0]+" derniers matchs disponibles, dans la même compétition et la même saison."
              : "Aucun match terminé avec un score exploitable n’est disponible dans la même compétition et la même saison.")
            : "Part des matchs terminés avec au moins 3 buts parmi les derniers matchs disponibles, dans la même compétition et la même saison ("+teamStats.map(team=>team.validCount+" pour "+team.name).join(", ")+").";
          experimentOver25.innerHTML = '<section class="over15-experiment"><div class="over15-experiment-intro"><div><h4>Fréquence historique du +2,5 buts</h4><p class="over15-experiment-note">'+escapeHtml(sampleDescription)+'</p></div><span class="over15-sample-tag">10 matchs max.</span></div><div class="over15-team-grid">'+cards.join("")+'</div>'+v1Html+v2Html+tierHtml+'<p class="over15-experiment-caveat">Indicateur descriptif du passé. Il ne constitue ni une probabilité de match ni une recommandation de pari. Les matchs sans score valide sont exclus.</p></section>';
        };
        renderOver25Experiment();
        const renderBttsExperiment = () => {
          if (!experimentBtts) return;
          if (!analytics) {
            experimentBtts.innerHTML = '<p class="match-detail-empty">Données de matchs historiques indisponibles pour calculer le taux BTTS.</p>';
            return;
          }
          const sides = [
            {id:String(selectedDetailMatch.home_team_id||""),name:selectedDetailMatch.home_team},
            {id:String(selectedDetailMatch.away_team_id||""),name:selectedDetailMatch.away_team}
          ];
          const teamStats = sides.map(team => {
            const entry = analytics.teams.get(team.id);
            // Même périmètre que les autres expérimentations : 10 derniers matchs
            // terminés, même compétition et saison, avant le coup d'envoi analysé.
            const recent = (entry?.recent_match_ids||[])
              .map(id=>analytics.matchesById.get(String(id))).filter(Boolean)
              .filter(item=>String(item.season||"")===String(selectedDetailMatch.season||""))
              .filter(item=>Date.parse(item.kickoff_utc||"")<Date.parse(selectedDetailMatch.kickoff_utc||""))
              .filter(item=>{
                const hg=Number(item.home_score), ag=Number(item.away_score);
                return Number.isInteger(hg)&&Number.isInteger(ag)&&hg>=0&&ag>=0;
              })
              .sort((a,b)=>String(b.kickoff_utc||"").localeCompare(String(a.kickoff_utc||"")))
              .slice(0,10);
            const scoredAtLeastOne = recent.filter(item => (String(item.home_team_id)===team.id ? Number(item.home_score) : Number(item.away_score)) >= 1).length;
            const count = recent.length;
            const pct = count ? Math.round(scoredAtLeastOne/count*100) : null;
            return {name:team.name,scoredAtLeastOne,validCount:count,pct};
          });
          const cards = teamStats.map(team =>
            '<section class="over15-team-card">'
              +'<div class="over15-team-heading"><strong>'+escapeHtml(team.name)+'</strong><span>'+(team.pct===null?'—':team.pct+' %')+'</span></div>'
              +'<div class="over15-progress" role="img" aria-label="'+escapeHtml(team.name)+': '+(team.pct===null?'données insuffisantes':team.pct+' %')+'"><span style="width:'+(team.pct===null?0:team.pct)+'%"></span></div>'
              +'<p>'+(team.validCount?team.scoredAtLeastOne+' / '+team.validCount+' matchs où l’équipe a marqué au moins 1 but':'Aucun score exploitable')
              +'</p></section>'
          );
          const sufficient = teamStats.every(team=>team.validCount>=2 && team.pct!==null);
          let tier = null;
          if (sufficient) {
            const [homePct,awayPct]=teamStats.map(team=>team.pct);
            if (homePct>=80 && awayPct>=80) tier=1;
            else if (homePct>=70 && awayPct>=70) tier=2;
            else if (homePct>=60 || awayPct>=60) tier=3;
            else tier=4;
          }
          const v1Html = (() => {
            const v1Teams = teamStats.map((team,index) => ({
              ...team,
              sideLabel: index===0 ? "Équipe domicile" : "Équipe extérieure",
              accepted: team.pct!==null && team.pct>=70
            }));
            const teamCards = v1Teams.map(team =>
              '<section class="over15-v1-team '+(team.accepted?'is-yes':'is-no')+'">'
                +'<div class="over15-v1-team-label">'+team.sideLabel+'</div>'
                +'<div class="over15-v1-team-result"><span class="over15-v1-chip">'+(team.pct===null?'INDISPONIBLE':team.accepted?'OUI':'NON')+'</span></div>'
                +'<small>'+(team.pct===null?'Critère indisponible':team.accepted?'Seuil atteint':'Seuil non atteint')+'</small>'
              +'</section>'
            ).join("");
            const enoughV1 = v1Teams.every(team=>team.validCount>=2 && team.pct!==null);
            const passedV1 = enoughV1 && v1Teams.every(team=>team.pct>=70);
            const labelV1 = enoughV1 ? (passedV1?'OUI':'NON') : 'INDISPONIBLE';
            return '<section class="over15-v1-panel"><header><strong style="color:'+(labelV1==='OUI'?'#15803d':labelV1==='NON'?'#dc2626':'#64748b')+'">Moteur V1 · '+labelV1+'</strong><span>Équipe marque ≥ 70 %</span></header></section>';
          })();
          const v2Html = (() => {
            const v2Teams = teamStats.map((team,index) => ({
              ...team,
              sideLabel: index===0 ? "Équipe domicile" : "Équipe extérieure",
              accepted: team.pct!==null && team.pct>=80
            }));
            const enoughV2 = v2Teams.every(team=>team.validCount>=2 && team.pct!==null);
            const passedV2 = enoughV2 && v2Teams.every(team=>team.pct>=80);
            const teamCards = v2Teams.map(team =>
              '<section class="over15-v1-team '+(team.accepted?'is-yes':'is-no')+'">'
                +'<div class="over15-v1-team-label">'+team.sideLabel+'</div>'
                +'<div class="over15-v1-team-result"><span class="over15-v1-chip">'+(team.pct===null?'INDISPONIBLE':team.accepted?'OUI':'NON')+'</span></div>'
                +'<small>'+(team.pct===null?'Critère indisponible':team.accepted?'Seuil atteint':'Seuil non atteint')+'</small>'
              +'</section>'
            ).join("");
            const labelV2 = enoughV2 ? (passedV2?'OUI':'NON') : 'INDISPONIBLE';
            return '<section class="over15-v1-panel"><header><strong style="color:'+(labelV2==='OUI'?'#15803d':labelV2==='NON'?'#dc2626':'#64748b')+'">Moteur V2 · '+labelV2+'</strong><span>Équipe marque ≥ 80 %</span></header></section>';
          })();
          const tierLabels = {1:"Très favorable",2:"Favorable",3:"Mitigé",4:"Défavorable"};
          const tierHtml = tier===null
            ? '<div class="over15-prediction over15-tier-unavailable"><span class="over15-prediction-kicker">Pronostic expérimental</span><strong>Données insuffisantes</strong><small>2 matchs valides minimum par équipe requis.</small></div>'
            : '<div class="over15-prediction over15-tier-'+tier+'"><span class="over15-prediction-kicker">Pronostic expérimental</span><strong>Niveau '+tier+' · '+tierLabels[tier]+'</strong><small>Classement descriptif basé sur les fréquences historiques, pas une probabilité calibrée.</small></div>';
          const sampleCounts = [...new Set(teamStats.map(team=>team.validCount))];
          const sampleDescription = sampleCounts.length===1
            ? (sampleCounts[0]
              ? "Part des matchs où l’équipe a marqué au moins 1 but parmi les "+sampleCounts[0]+" derniers matchs disponibles, dans la même compétition et la même saison."
              : "Aucun match terminé avec un score exploitable n’est disponible dans la même compétition et la même saison.")
            : "Part des matchs où chaque équipe a marqué au moins 1 but parmi les derniers matchs disponibles, dans la même compétition et la même saison ("+teamStats.map(team=>team.validCount+" pour "+team.name).join(", ")+").";
          experimentBtts.innerHTML = '<section class="over15-experiment"><div class="over15-experiment-intro"><div><h4>Fréquence historique de buts marqués</h4><p class="over15-experiment-note">'+escapeHtml(sampleDescription)+'</p></div><span class="over15-sample-tag">10 matchs max.</span></div><div class="over15-team-grid">'+cards.join("")+'</div>'+v1Html+v2Html+tierHtml+'<p class="over15-experiment-caveat">Indicateur descriptif du passé. Il ne constitue ni une probabilité de match ni une recommandation de pari. Les matchs sans score valide sont exclus. Le pourcentage mesure les matchs où l’équipe a marqué au moins un but. Ce n’est pas la fréquence du BTTS.</p></section>';
        };
        renderBttsExperiment();
        const renderRecentTeamStats = () => {
          if (!analytics) {
            if (teamStats) teamStats.innerHTML = '<p class="match-detail-empty">Aucune collecte de statistiques détaillées disponible pour cette compétition.</p>';
            return "";
          }
          const sides = [
            { id: String(selectedDetailMatch.home_team_id || ""), name: selectedDetailMatch.home_team, side: "home" },
            { id: String(selectedDetailMatch.away_team_id || ""), name: selectedDetailMatch.away_team, side: "away" }
          ];
          const chartPayloads = [];
          const quickSummaries = [];
          const comparisonPeriods = [];
          const cards = sides.map((team, teamIndex) => {
            const entry = analytics.teams.get(team.id);
            const recent = (entry?.recent_match_ids || []).map((id) => analytics.matchesById.get(String(id))).filter(Boolean)
              .filter(item => String(item.season || "") === String(selectedDetailMatch.season || ""))
              .filter(item => Date.parse(item.kickoff_utc || "") < Date.parse(selectedDetailMatch.kickoff_utc || ""))
              .sort((a,b) => String(a.kickoff_utc || "").localeCompare(String(b.kickoff_utc || ""))).slice(-10);
            if (!recent.length) return '<section class="match-analytics-team"><h4>'+escapeHtml(team.name)+'</h4><p>Aucun match récent exploitable dans cette compétition et cette saison.</p></section>';
            const rows = [];
            const labels = [], xgValues = [], xgaValues = [];
            const metricByMatch = [];
            const goalForByMatch = [], goalAgainstByMatch = [];
            recent.forEach((item, index) => {
              const side = String(item.home_team_id) === team.id ? "home" : "away";
              const opponentSide = side === "home" ? "away" : "home";
              const all = (item.team_stats?.periods || []).find((period) => period.period === "All") || item.team_stats?.periods?.[0];
              const metrics = (all?.groups || []).flatMap((group) => (group.items || []).map((stat) => ({
                label: stat.title || stat.key || group.group_name, key: stat.key || "", value: stat[side]
              }))).filter((stat) => stat.value !== undefined && stat.value !== null && stat.value !== "");
              const currentMetrics = new Map();
              metrics.forEach((stat) => {
                const key = String(stat.key+" "+stat.label).toLowerCase();
                if (/expected goals|\bxg\b/.test(key)) {
                  const value = Number(stat.value);
                  if (Number.isFinite(value)) xgValues[index] = value;
                }
                const normalized = key.replace(/[^a-z]/g,"");
                const aliases = [
                  ["shotsontarget", "Tirs cadrés"], ["totalshots", "Tirs"],
                  ["shots", "Tirs"], ["corners", "Corners"], ["possession", "Possession (%)"]
                ];
                const match = aliases.find(([needle]) => normalized.includes(needle));
                if (match && Number.isFinite(Number(stat.value))) currentMetrics.set(match[1], Number(stat.value));
              });
              metricByMatch.push(currentMetrics);
              const shots = (item.shots?.periods || []).flatMap((period) => period.shots || []);
              const ownShots = shots.filter((shot) => String(shot.team_id || "") === team.id);
              const opponentShots = shots.filter((shot) => String(shot.team_id || "") !== team.id);
              const opponentKnown = opponentShots.filter((shot) => shot.expected_goals != null && Number.isFinite(Number(shot.expected_goals)));
              if (opponentShots.length && opponentKnown.length) {
                xgaValues[index] = opponentKnown.reduce((sum, shot) => sum + Number(shot.expected_goals), 0);
              }
              const gf = item[side+"_score"], ga = item[opponentSide+"_score"];
              goalForByMatch.push(gf != null && Number.isFinite(Number(gf)) ? Number(gf) : null);
              goalAgainstByMatch.push(ga != null && Number.isFinite(Number(ga)) ? Number(ga) : null);
              const score = gf == null || ga == null ? "—" : gf+" – "+ga;
              const selected = metrics.filter((stat) => /expected goals|\bxg\b/i.test(stat.label)).slice(0,1).map((stat) => ({...stat,label:"xG"}));
              if (opponentShots.length && opponentKnown.length) selected.push({label: opponentKnown.length < opponentShots.length ? "xG Adverse (partiel)" : "xG Adverse", value: opponentKnown.reduce((sum,shot)=>sum+Number(shot.expected_goals),0).toFixed(2)});
              const result = gf == null || ga == null ? "" : Number(gf)>Number(ga) ? "V" : Number(gf)===Number(ga) ? "N" : "D";
              const homePosition = Number.isInteger(Number(item.home_position_before)) && Number(item.home_position_before)>0 ? Number(item.home_position_before) : null;
              const awayPosition = Number.isInteger(Number(item.away_position_before)) && Number(item.away_position_before)>0 ? Number(item.away_position_before) : null;
              const teamPosition = side === "home" ? homePosition : awayPosition;
              const opponentPosition = side === "home" ? awayPosition : homePosition;
              const positionLabel = 'Classement avant match : <b>'+escapeHtml(team.name)+' #'+(teamPosition || "—")+'</b> · <b>'+escapeHtml(item.home_team_id === team.id ? item.away_team : item.home_team)+' #'+(opponentPosition || "—")+'</b>';
              const matchDate = item.kickoff_utc ? new Date(item.kickoff_utc).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Europe/Paris"}) : "Date indisponible";
              labels.push("M"+(index+1));
              rows.unshift('<article class="match-analytics-recent"><div class="match-analytics-recent-topline"><small>'+escapeHtml(matchDate)+'</small><strong>'+escapeHtml(item.home_team)+' '+escapeHtml(score)+' '+escapeHtml(item.away_team)+(result ? '<span class="match-analytics-result '+(result==="V"?"is-win":result==="N"?"is-draw":"is-loss")+'">'+result+'</span>' : '')+'</strong></div><div class="match-analytics-position">'+positionLabel+'</div><div class="match-analytics-metrics">'+(selected.length ? selected.map((stat) => '<span><small>'+escapeHtml(stat.label)+'</small><b>'+escapeHtml(stat.value)+'</b></span>').join("") : '<small>Indicateurs xG indisponibles.</small>')+'</div></article>');
            });
            const average = (values, limit) => {
              const selected = values.slice(-limit).filter(value => value !== null && value !== undefined && Number.isFinite(Number(value)));
              return { value: selected.length ? selected.reduce((sum,value)=>sum+Number(value),0)/selected.length : null, count:selected.length };
            };
            const formatAverage = (result, digits=2, suffix="") => result.value === null ? "—" : result.value.toLocaleString("fr-FR",{minimumFractionDigits:digits,maximumFractionDigits:digits})+suffix;
            const metricDefinitions = [
              ["Tirs / match", metricByMatch.map(item=>item.get("Tirs") ?? null), "stats"],
              ["Tirs cadrés / match", metricByMatch.map(item=>item.get("Tirs cadrés") ?? null), "stats"],
              ["Possession (%)", metricByMatch.map(item=>item.get("Possession (%)") ?? null), "possession"],
              ["Corners / match", metricByMatch.map(item=>item.get("Corners") ?? null), "stats"]
            ];
            const periodCell = (values, limit, kind) => {
              const result = average(values,limit);
              const actualMatches = Math.min(limit,recent.length);
              const suffix = kind === "possession" ? " %" : "";
              return '<td><strong>'+formatAverage(result,kind==="possession"?1:2,suffix)+'</strong><small>'+result.count+'/'+actualMatches+' dispo.</small></td>';
            };
            const firstPeriodCount = Math.min(10,recent.length);
            const secondPeriodCount = Math.min(5,recent.length);
            const periodRows = metricDefinitions.map(([label,values,kind]) =>
              '<tr><th scope="row">'+label+'</th>'+periodCell(values,10,kind)+periodCell(values,5,kind)+'</tr>'
            ).join("");
            const periodTable = '<section class="match-analytics-extra"><h5>Statistiques complémentaires · '+firstPeriodCount+' derniers matchs</h5><div class="match-analytics-period-wrap"><table class="match-analytics-period-table"><thead><tr><th>Indicateur</th><th>'+firstPeriodCount+' matchs</th><th>'+secondPeriodCount+' matchs</th></tr></thead><tbody>'+periodRows+'</tbody></table></div></section>';
            // Diagnostic comparatif : 5 derniers matchs contre les 5 précédents.
            // Le JSON ne contient que les 10 derniers matchs détaillés, pas toute la saison.
            const previousFive = recent.slice(0, Math.max(0, recent.length - 5));
            const latestFive = recent.slice(-5);
            comparisonPeriods.push({name:team.name,previous:previousFive.length,latest:latestFive.length});
            const meanOf = (values) => {
              const valid = values.filter(value => value !== null && value !== undefined && Number.isFinite(Number(value))).map(Number);
              return valid.length ? {value:valid.reduce((sum,value)=>sum+value,0)/valid.length,count:valid.length} : {value:null,count:0};
            };
            const pointsFor = (match) => {
              const side = String(match.home_team_id) === team.id ? "home" : "away";
              const gf = match[side+"_score"], ga = match[(side==="home"?"away":"home")+"_score"];
              if (gf == null || ga == null || !Number.isFinite(Number(gf)) || !Number.isFinite(Number(ga))) return null;
              return Number(gf)>Number(ga) ? 3 : Number(gf)===Number(ga) ? 1 : 0;
            };
            const periodMetrics = (period) => {
              const indexes = period.map(match => recent.indexOf(match));
              const take = (values) => meanOf(indexes.map(index => values[index] ?? null));
              return {
                goals:take(goalForByMatch), conceded:take(goalAgainstByMatch),
                points:meanOf(period.map(pointsFor)),
                xg:take(xgValues), xga:take(xgaValues),
                shots:take(metricByMatch.map(item=>item.get("Tirs") ?? null))
              };
            };
            const before = periodMetrics(previousFive);
            const latest = periodMetrics(latestFive);
            const fmt = (value,digits=2) => value == null ? "—" : value.toLocaleString("fr-FR",{minimumFractionDigits:digits,maximumFractionDigits:digits});
            const delta = (current,reference) => current.value == null || reference.value == null ? null : current.value-reference.value;
            const resultDelta = delta(latest.points,before.points);
            const goalDelta = delta(latest.goals,before.goals);
            const concededDelta = delta(latest.conceded,before.conceded);
            const xgDelta = delta(latest.xg,before.xg);
            const xgaDelta = delta(latest.xga,before.xga);
            const enoughMatches = previousFive.length >= 3 && latestFive.length >= 3 && latest.points.count >= 3 && before.points.count >= 3;
            const resultsBetter = resultDelta !== null && resultDelta >= 0.45 && (goalDelta === null || goalDelta >= 0.25) && (concededDelta === null || concededDelta <= 0.15);
            const resultsWorse = resultDelta !== null && resultDelta <= -0.45 && (goalDelta === null || goalDelta <= -0.25 || concededDelta >= 0.25);
            const underlyingAvailable = latest.xg.count >= 3 && before.xg.count >= 3;
            const underlyingBetter = underlyingAvailable && xgDelta !== null && xgDelta >= 0.2 && (xgaDelta === null || xgaDelta <= 0.15);
            const underlyingWorse = underlyingAvailable && xgDelta !== null && xgDelta <= -0.2;
            let formLabel = "Performance proche de la référence";
            let formTone = "neutral";
            let formExplanation = "Les écarts entre les deux périodes ne sont pas assez nets pour signaler une anomalie.";
            if (!enoughMatches) {
              formLabel = "Données insuffisantes";
              formTone = "neutral";
              formExplanation = "Il faut au moins 3 matchs exploitables dans chacune des deux périodes pour établir une comparaison.";
            } else if (resultsBetter && underlyingAvailable && !underlyingBetter) {
              formLabel = "Surperformance possiblement fragile";
              formTone = "warning";
              formExplanation = "Les résultats progressent davantage que les xG disponibles. Une efficacité exceptionnelle peut contribuer à la série.";
            } else if (resultsBetter && (!underlyingAvailable || underlyingBetter)) {
              formLabel = "Surperformance";
              formTone = "positive";
              formExplanation = underlyingBetter ? "Les résultats progressent et les occasions (xG) vont dans le même sens." : "Les résultats progressent. Les xG sont trop incomplets pour confirmer la qualité de cette hausse.";
            } else if (resultsWorse && underlyingBetter) {
              formLabel = "Sous-performance potentiellement passagère";
              formTone = "info";
              formExplanation = "Les résultats reculent alors que les xG restent mieux orientés. Un retour vers le niveau antérieur est possible, sans être garanti.";
            } else if (resultsWorse && underlyingWorse) {
              formLabel = "Sous-performance confirmée";
              formTone = "negative";
              formExplanation = "Les résultats et les indicateurs xG disponibles se dégradent ensemble.";
            } else if (resultsWorse) {
              formLabel = "Sous-performance";
              formTone = "negative";
              formExplanation = "Les résultats sont en retrait. Les données sous-jacentes ne permettent pas encore d'en identifier clairement la cause.";
            } else if (underlyingWorse && goalDelta !== null && goalDelta <= -0.25) {
              formLabel = "Baisse des performances";
              formTone = "negative";
              formExplanation = "Les buts marqués et les xG reculent nettement, même si les points par match restent stables. La baisse offensive est à surveiller.";
            }

            const comparisonRows = [
              ["🏆","Points / match",before.points,latest.points,false],
              ["⚽","Buts marqués / match",before.goals,latest.goals,false],
              ["🛡","Buts encaissés / match",before.conceded,latest.conceded,true],
              ["◎","xG / match",before.xg,latest.xg,false]
            ];
            const compareTone = (oldMetric,newMetric,inverse=false) => {
              if(oldMetric.value==null || newMetric.value==null) return "neutral";
              const diff=(newMetric.value-oldMetric.value)*(inverse?-1:1);
              return Math.abs(diff)<0.001?"neutral":diff>0?"good":"bad";
            };
            const comparePct = (oldMetric,newMetric,inverse=false) => {
              if(oldMetric.value==null || newMetric.value==null || Math.abs(oldMetric.value)<0.001) return "—";
              const pct=(newMetric.value-oldMetric.value)/Math.abs(oldMetric.value)*100*(inverse?-1:1);
              return (pct>0?"+":"")+Math.round(pct)+" %";
            };
            const hasPreviousPeriod = previousFive.length > 0 && latestFive.length > 0;
            const tableRows = comparisonRows.map(([icon,label,oldMetric,newMetric,inverse]) => {
              if (!hasPreviousPeriod) {
                return '<tr><th><span class="match-form-row-icon">'+icon+'</span>'+label+'</th><td>'+fmt(newMetric.value)+'</td></tr>';
              }
              const tone=compareTone(oldMetric,newMetric,inverse);
              return '<tr><th><span class="match-form-row-icon">'+icon+'</span>'+label+'</th><td>'+fmt(oldMetric.value)+'</td><td>'+fmt(newMetric.value)+'</td><td><span class="match-form-change is-'+tone+'">'+comparePct(oldMetric,newMetric,inverse)+'</span></td></tr>';
            }).join("");
            const sparkline = (values,inverse=false) => {
              const nums=values.map(v=>v==null?null:Number(v));
              const valid=nums.filter(v=>v!==null&&Number.isFinite(v));
              if(valid.length<2) return '<span class="match-form-spark-empty">Données limitées</span>';
              const min=Math.min(...valid), max=Math.max(...valid), range=max-min||1;
              const pts=nums.map((v,i)=>v===null?null:(i/(Math.max(1,nums.length-1))*120).toFixed(1)+','+(27-(v-min)/range*22).toFixed(1)).filter(Boolean).join(' ');
              const oldAvg=meanOf(nums.slice(0,Math.max(0,nums.length-5)));
              const newAvg=meanOf(nums.slice(-5));
              const tone=compareTone(oldAvg,newAvg,inverse);
              return '<svg viewBox="0 0 120 32" aria-hidden="true"><polyline class="is-'+tone+'" points="'+pts+'" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            };
            const miniCards = [
              ["xG",xgValues,false],["Buts encaissés",goalAgainstByMatch,false],
              ["Tirs",metricByMatch.map(m=>m.get("Tirs") ?? null),false],
              ["Buts marqués",goalForByMatch,false]
            ].map(([label,values,inverse]) => {
              const oldAvg=meanOf(values.slice(0,Math.max(0,values.length-5)));
              const newAvg=meanOf(values.slice(-5));
              return '<div class="match-form-mini-card"><small>'+label+'</small><b>'+fmt(oldAvg.value)+' <i>→</i> '+fmt(newAvg.value)+'</b>'+sparkline(values,inverse)+'</div>';
            }).join("");
            const mainTone = formTone==="positive"?"positive":formTone==="negative"?"negative":(formTone==="warning"||formTone==="info")?"warning":"neutral";
            const mainDelta = before.points.value==null||latest.points.value==null||Math.abs(before.points.value)<0.001 ? "—" : ((latest.points.value-before.points.value)/Math.abs(before.points.value)*100);
            const mainDeltaText = mainDelta==="—"?"—":(mainDelta>0?"+":"")+Math.round(mainDelta)+" %";
            const quickStatus = mainTone==="positive"?"En forme":mainTone==="negative"?"En baisse":mainTone==="warning"?"À surveiller":enoughMatches?"Stable":"Données limitées";
            const quickMetrics = [
              ["Points",before.points,latest.points,false],
              ["xG",before.xg,latest.xg,false],
              ["Buts marqués",before.goals,latest.goals,false],
              ["Buts encaissés",before.conceded,latest.conceded,false]
            ];
            const quickMetricHtml = quickMetrics.map(([label,oldMetric,newMetric,inverse]) => {
              const tone=compareTone(oldMetric,newMetric,inverse);
              const pct=comparePct(oldMetric,newMetric,inverse);
              const arrow=pct==="—"?"→":pct.startsWith("-")?"↘":pct.startsWith("+")?"↗":"→";
              return '<span class="match-form-quick-metric is-'+tone+'"><b>'+arrow+' '+pct+'</b><small>'+label+'</small></span>';
            }).join("");
            if (hasPreviousPeriod) quickSummaries.push('<article class="match-form-quick-team"><div class="match-form-quick-team-identity"><strong>'+escapeHtml(team.name)+'</strong><span class="match-form-quick-status is-'+mainTone+'">'+quickStatus+'</span></div><div class="match-form-quick-metrics">'+quickMetricHtml+'</div></article>');
            const trendHeader = hasPreviousPeriod
              ? '<div class="match-form-hero"><div><h5>'+escapeHtml(formLabel)+'</h5><p>'+escapeHtml(formExplanation)+'</p></div><div class="match-form-main-delta"><strong>'+(mainDeltaText==="—"?"→":mainDeltaText.startsWith("-")?"↘":"↗")+' '+mainDeltaText+'</strong><small>(pts/match)</small></div></div>'
              : '';
            const trendTableHead = hasPreviousPeriod
              ? '<tr><th>Indicateur</th><th>Période précédente<br>('+previousFive.length+' matchs)</th><th>'+latestFive.length+' derniers matchs</th><th>Écart</th></tr>'
              : '<tr><th>Indicateur</th><th>'+latestFive.length+' derniers matchs</th></tr>';
            const trendMiniCards = hasPreviousPeriod ? '<div class="match-form-mini-grid">'+miniCards+'</div>' : '';
            const trendNote = hasPreviousPeriod
              ? 'Comparaison calculée sur '+previousFive.length+' match(s) précédents et '+latestFive.length+' match(s) récents réellement disponibles. Chaque moyenne utilise uniquement les matchs de sa période ; les indicateurs manquants restent exclus.'
              : 'Aucune période précédente disponible. Les valeurs affichées portent sur '+latestFive.length+' match(s) récent(s) réellement disponibles.';
            const trendCard = '<section class="match-form-diagnostic is-'+mainTone+'"><div class="match-form-table-wrap"><table class="match-form-table"><thead>'+trendTableHead+'</thead><tbody>'+tableRows+'</tbody></table></div>'+trendMiniCards+'<p class="match-form-caveat">'+trendNote+'</p></section>';
            const chartId = "match-team-chart-"+teamIndex;
            chartPayloads.push({id:chartId,labels,xg:xgValues,xga:xgaValues});
            const statsAvailable = recent.filter(item=>item.stats_status==="available").length;
            const shotsAvailable = recent.filter(item=>item.shots_status==="available").length;
            const coverageDenominator = Math.min(10, Math.max(recent.length, Number(entry?.season_matches_count) || 0));
            return '<section class="match-analytics-team"><header class="match-analytics-team-heading"><div class="match-analytics-team-header-main"><h4>'+escapeHtml(team.name)+'</h4><span>'+recent.length+(recent.length===10?' / 10':'')+' matchs</span></div>'+trendHeader+'</header>'+trendCard+'<div class="match-analytics-chart-title">Évolution xG / xG Adverse · 10 derniers matchs</div><div class="match-analytics-chart"><canvas id="'+chartId+'" aria-label="Évolution xG et xG Adverse de '+escapeHtml(team.name)+' sur les '+recent.length+' matchs disponibles (maximum 10)"></canvas></div><details class="match-analytics-recent-accordion"><summary class="match-analytics-recent-list-title">10 derniers matchs ('+recent.length+' disponibles)</summary><div class="match-analytics-recent-list">'+rows.join("")+'</div></details><p class="match-analytics-team-coverage">Stats disponibles : '+statsAvailable+'/'+coverageDenominator+' · tirs/xG adverse disponibles : '+shotsAvailable+'/'+coverageDenominator+'</p></section>';
          });
          const periodDescription = comparisonPeriods.map(period=>escapeHtml(period.name)+' : '+period.previous+' précédent(s) / '+period.latest+' récent(s)').join(' ; ');
          const html = '<aside class="match-form-quick-read"><div>'+quickSummaries.join("")+'</div></aside><div class="match-analytics-grid">'+cards.join("")+'</div><p class="match-analytics-note">Matchs terminés de la saison en cours et de la même compétition, antérieurs au coup d’envoi. Périodes comparées — '+periodDescription+'. Chaque moyenne utilise uniquement les matchs disponibles. xG adverse peut être partiel.</p>';
          if (teamStats) {
            teamStats.innerHTML = html;
            const drawCharts = (ChartConstructor) => {
              if (!ChartConstructor || !teamStats.isConnected) return;
              chartPayloads.forEach(payload => {
                const canvas = teamStats.querySelector("#"+payload.id);
                if (!canvas) return;
                const existing = ChartConstructor.getChart?.(canvas);
                if (existing) existing.destroy();
                new ChartConstructor(canvas,{
                  type:"line",
                  data:{labels:payload.labels,datasets:[
                    {label:"xG",data:payload.xg,borderColor:"#F97316",backgroundColor:"#F97316",borderWidth:2.4,tension:.3,spanGaps:false,pointRadius:3},
                    {label:"xG Adverse",data:payload.xga,borderColor:"#7C3AED",backgroundColor:"#7C3AED",borderWidth:2.4,tension:.3,spanGaps:false,pointRadius:3}
                  ]},
                  options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:"index",intersect:false},
                    plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:7,font:{size:9}}}},
                    scales:{y:{beginAtZero:true,ticks:{font:{size:8}},grid:{color:"#edf2f7"}},x:{ticks:{font:{size:8}},grid:{display:false}}}}
                });
              });
            };
            if (window.chartJsReady && typeof window.chartJsReady.then==="function") window.chartJsReady.then(drawCharts);
            else drawCharts(window.Chart);
          }
          return html;
        };
        const renderRecentShots = () => {
          if (!analytics) return '<p class="match-detail-empty">Aucune collecte de tirs détaillés disponible pour cette compétition.</p>';
          const sides = [
            { id: String(selectedDetailMatch.home_team_id || ""), name: selectedDetailMatch.home_team },
            { id: String(selectedDetailMatch.away_team_id || ""), name: selectedDetailMatch.away_team }
          ];
          const teamSections = sides.map((team) => {
            const entry = analytics.teams.get(team.id);
            const recent = (entry?.recent_match_ids || []).map((id) => analytics.matchesById.get(String(id))).filter(Boolean)
              .sort((a,b) => String(b.kickoff_utc || "").localeCompare(String(a.kickoff_utc || "")));
            if (!recent.length) return '<section class="match-analytics-team"><h4>'+escapeHtml(team.name)+'</h4><p>Aucun ancien match exploitable dans cette compétition et cette saison.</p></section>';
            const recentFive = recent.slice(0, 5);
            const goalTimeLabels = ["0–15", "16–30", "31–45", "45+ arrêts", "46–60", "61–75", "76–90", "90+ arrêts"];
            const goalTimeCounts = Array(goalTimeLabels.length).fill(0);
            let matchesWithGoalEvents = 0;
            const matchesHtml = recentFive.map((match) => {
              const allShots = (match.shots?.periods || []).flatMap((period) => period.shots || []);
              if (match.shots_status === "available") matchesWithGoalEvents++;
              const goals = allShots
                .filter((shot) => String(shot.team_id || "") === team.id && shot.event_type === "Goal")
                .sort((a,b) => Number(a.minute || 0)-Number(b.minute || 0) || Number(a.minute_added || 0)-Number(b.minute_added || 0));
              goals.forEach((shot) => {
                const minute = Number(shot.minute || 0);
                const added = Number(shot.minute_added || 0);
                const bucket = minute <= 15 ? 0 : minute <= 30 ? 1 : minute <= 45 ? (added > 0 ? 3 : 2) : minute <= 60 ? 4 : minute <= 75 ? 5 : minute < 90 ? 6 : (added > 0 ? 7 : 6);
                if (Number.isFinite(minute) && minute > 0) goalTimeCounts[bucket]++;
              });
              const score = match.home_score == null || match.away_score == null ? "—" : match.home_score+" – "+match.away_score;
              const summary = '<strong>'+escapeHtml(match.home_team)+' '+escapeHtml(score)+' '+escapeHtml(match.away_team)+'</strong>';
              if (match.shots_status !== "available") {
                return '<div class="match-analytics-recent">'+summary+'<p>Données de buts détaillés indisponibles pour cette rencontre.</p></div>';
              }
              const allStats = (match.team_stats?.periods || []).find((period) => period.period === "All") || match.team_stats?.periods?.[0];
              const side = String(match.home_team_id) === team.id ? "home" : "away";
              const shotMetrics = (allStats?.groups || []).flatMap((group) => (group.items || []).map((stat) => ({
                label: stat.title || stat.key || group.group_name, value: stat[side]
              }))).filter((stat) => stat.value !== undefined && stat.value !== null && stat.value !== "");
              const wantedShots = shotMetrics.filter((stat) => /total shots|shots on target|shots inside box|shots outside box/i.test(stat.label));
              const metricLabels = {
                "total shots":"Tirs totaux", "shots on target":"Tirs cadrés*",
                "shots inside box":"Tirs dans la surface", "shots outside box":"Tirs hors surface"
              };
              const summaryMetrics = wantedShots.map((stat) => {
                const key = stat.label.toLowerCase().replace(/[^a-z ]/g, "").trim();
                return '<span><small>'+escapeHtml(metricLabels[key] || stat.label)+'</small><b>'+escapeHtml(stat.value)+'</b></span>';
              }).join("");
              const goalsHtml = goals.length
                ? '<ul class="match-goals-list">'+goals.map((shot) => {
                    const minute = shot.minute_added ? shot.minute+'+'+shot.minute_added : (shot.minute ?? "—");
                    return '<li><span class="match-goal-minute">'+escapeHtml(minute)+'\'</span><strong>'+escapeHtml(shot.player?.name || "Buteur non identifié")+'</strong></li>';
                  }).join("")+'</ul>'
                : '<p>Aucun but enregistré pour cette équipe dans cette rencontre.</p>';
              return '<article class="match-analytics-recent match-shots-match">'+summary+
                '<div class="match-analytics-metrics">'+(summaryMetrics || '<small>Statistiques de tirs indisponibles.</small>')+'</div>'+
                '<div class="match-goals"><h5>Buteurs</h5>'+goalsHtml+'</div></article>';
            }).join("");
            const chartId = "match-shots-goal-time-"+(team.id || "team");
            const chartHtml = '<div class="match-shots-goal-time"><h5>Buts marqués selon le temps de jeu</h5><div class="match-shots-goal-time-chart"><canvas id="'+chartId+'" aria-label="Répartition des buts de '+escapeHtml(team.name)+' selon la minute"></canvas></div><small>'+matchesWithGoalEvents+' matchs avec événements de buts disponibles · maximum 5 derniers matchs</small></div>';
            const drawGoalTimeChart = (ChartConstructor) => {
              const canvas = shots?.querySelector("#"+chartId);
              if (!ChartConstructor || !canvas || !canvas.isConnected) return;
              const existing = ChartConstructor.getChart?.(canvas);
              if (existing) existing.destroy();
              new ChartConstructor(canvas, {
                type:"bar",
                data:{labels:goalTimeLabels,datasets:[{label:"Buts marqués",data:goalTimeCounts,backgroundColor:"#2585ed",borderRadius:5,maxBarThickness:34}]},
                options:{responsive:true,maintainAspectRatio:false,animation:false,
                  plugins:{legend:{display:false},tooltip:{callbacks:{label:(context)=>" "+context.raw+" but(s)"}}},
                  scales:{y:{beginAtZero:true,ticks:{precision:0,stepSize:1},grid:{color:"#edf2f7"}},x:{grid:{display:false},ticks:{font:{size:10}}}}},
                plugins:[{id:"match-time-markers",
                  beforeDatasetsDraw(chart){
                    const x=chart.scales.x, area=chart.chartArea, ctx=chart.ctx;
                    if(!x || !area) return;
                    const step=Math.abs(x.getPixelForValue(1)-x.getPixelForValue(0));
                    if(!step) return;
                    const bands=[3,7];
                    ctx.save();
                    bands.forEach((index)=>{
                      const center=x.getPixelForValue(index);
                      const left=center-step/2;
                      ctx.fillStyle="rgba(217,119,6,.13)";
                      ctx.fillRect(left,area.top,step,area.bottom-area.top);
                      ctx.strokeStyle="rgba(180,83,9,.55)";
                      ctx.lineWidth=1;
                      ctx.setLineDash([3,3]);
                      ctx.strokeRect(left,area.top,step,area.bottom-area.top);
                    });
                    ctx.restore();
                  },
                  afterDraw(chart){
                    const x=chart.scales.x, area=chart.chartArea, ctx=chart.ctx;
                    if(!x || !area) return;
                    const marker=(x.getPixelForValue(3)+x.getPixelForValue(4))/2;
                    ctx.save();ctx.strokeStyle="#d97706";ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
                    ctx.beginPath();ctx.moveTo(marker,area.top);ctx.lineTo(marker,area.bottom);ctx.stroke();
                    ctx.setLineDash([]);ctx.fillStyle="#b45309";ctx.font="bold 9px sans-serif";
                    ctx.textAlign="center";ctx.fillText("MI-TEMPS",marker,area.top+10);ctx.restore();
                  }
                }]
              });
            };
            if (window.chartJsReady && typeof window.chartJsReady.then==="function") window.chartJsReady.then(drawGoalTimeChart);
            else Promise.resolve().then(() => drawGoalTimeChart(window.Chart));
            return '<section class="match-analytics-team match-shots-team"><header class="match-analytics-team-heading match-analytics-team-heading-clean"><h4>'+escapeHtml(team.name)+'</h4><span>'+recentFive.length+' matchs analysés</span></header>'+chartHtml+matchesHtml+'</section>';
          }).join("");
          return '<div class="match-analytics-grid">'+teamSections+'</div><p class="match-analytics-note">Buteurs et minutes issus des événements de buts disponibles. Les tentatives de tirs individuelles ne sont plus affichées. *PitchAPI peut classer comme cadré un tir finalement bloqué ; ce compteur suit sa définition.</p>';
        };
                if (teamStats) {
          renderRecentTeamStats();
        }
        if (shots) shots.innerHTML = renderRecentShots();
      };
      const selectMatch = (card, match) => {
        selectedMatchKey = card.dataset.matchKey || "";
        selectedDetailMatch = match;
        list.querySelectorAll(".upcoming-match-card").forEach((item) => {
          const active = item === card;
          item.classList.toggle("is-selected", active);
          item.setAttribute("aria-pressed", String(active));
        });
        if (!detailPanel) return;
        const mobileLayout = window.matchMedia("(max-width: 760px)").matches;
        if (mobileLayout) {
          // La fiche est un élément frère immédiat de la carte sélectionnée,
          // dans la liste : elle ne peut donc pas se retrouver après tous les matchs.
          list.insertBefore(detailPanel, card.nextSibling);
          detailPanel.classList.add("match-detail-inline-mobile");
        } else {
          detailPanel.classList.remove("match-detail-inline-mobile");
          const workspace = detailPanel.closest(".workspace");
          const matchesSection = document.querySelector(".matches-list-section");
          if (workspace && matchesSection) workspace.insertBefore(detailPanel, matchesSection.nextSibling);
        }
        const kickoff = new Date(match.kickoff_utc);
        const dateLabel = Number.isFinite(kickoff.getTime())
          ? new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric",timeZone:"Europe/Paris"}).format(kickoff)
            + " · " + new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"}).format(kickoff)
          : "Date indisponible";
        const phase = getEstimatedPhase(match, standingsIndex) || match.round || "";
        const competition = match.competition || "Compétition inconnue";
        const competitionDisplayName = ({
          "uefa-champions-league":"Ligue des champions",
          "uefa-europa-league":"Ligue Europa"
        })[String(match.competition_slug || "").trim().toLowerCase()] || competition;
        const competitionCode = getCompetitionDisplayCode(match.competition_slug, competition) || competition;
        const countryFlag = getCompetitionCountryFlag(match);
        const standings = standingsIndex.get(String(match.competition_slug || ""));
        const seasonMatches = !standings?.season || !match.season || standings.season === match.season;
        const homePosition = seasonMatches ? standings?.teams.get(String(match.home_team_id || ""))?.position : null;
        const awayPosition = seasonMatches ? standings?.teams.get(String(match.away_team_id || ""))?.position : null;
        const homeLogo = safeLogoUrl(match.provider_record?.home_team?.image_url);
        const awayLogo = safeLogoUrl(match.provider_record?.away_team?.image_url);
        const escape = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
        const predictionKey = String(match.match_id || match.provider_match_id || match.id || "");
        const expectedGoals = goalPredictionsIndex.get(predictionKey)?.expected_goals;
        const hasExpectedGoals = expectedGoals?.status === "estimated"
          && Number.isFinite(Number(expectedGoals.lambda_home))
          && Number.isFinite(Number(expectedGoals.lambda_away));
        const formatLambda = (value) => Number(value).toFixed(2);
        const xgHome = hasExpectedGoals ? formatLambda(expectedGoals.lambda_home) : "Indisponible";
        const xgAway = hasExpectedGoals ? formatLambda(expectedGoals.lambda_away) : "Indisponible";
        const xgTotal = hasExpectedGoals ? formatLambda(expectedGoals.total_expected_goals) : "Indisponible";
        const xgNote = hasExpectedGoals
          ? "Modèle statistique non calibré · échantillon : " + Number(expectedGoals.samples?.home || 0)
            + " matchs domicile / " + Number(expectedGoals.samples?.away || 0) + " matchs extérieur."
          : "Estimation indisponible : historique pré-match ou moyenne de compétition insuffisants.";
        detailPanel.innerHTML = `
          <div class="match-detail-content">
            <div class="match-detail-top">
              <div class="match-detail-competition">${countryFlagHtml(countryFlag, "competition-country-flag")}<span title="${escape(competition)}">${escape(competitionDisplayName)}</span>${phase ? '<span class="match-detail-phase">'+escape(phase)+'</span>':""}</div>
              <div class="match-detail-date"><span>${escape(dateLabel)}</span><span class="match-detail-clock" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7v5l3.5 2"></path></svg></span></div>
            </div>
            <div class="match-detail-teams">
              <div class="match-detail-team">${homeLogo ? '<img src="'+escape(homeLogo)+'" alt="Logo '+escape(match.home_team)+'">':""}<strong>${escape(match.home_team)}</strong><small class="match-team-position">${homePosition ? "# "+homePosition:"Classement indisponible"}</small></div>
              <div class="match-detail-vs">VS</div>
              <div class="match-detail-team">${awayLogo ? '<img src="'+escape(awayLogo)+'" alt="Logo '+escape(match.away_team)+'">':""}<strong>${escape(match.away_team)}</strong><small class="match-team-position">${awayPosition ? "# "+awayPosition:"Classement indisponible"}</small></div>
            </div>
            <div class="match-detail-xg">
              <span class="match-detail-xg-label">Buts attendus estimés (λ)</span>
              <span class="match-detail-xg-note">Indisponible pour le moment</span>
            </div>
            <div class="match-detail-accordions" aria-label="Données détaillées du match">
              <details class="match-detail-accordion" name="match-detail">
                <summary><span class="match-detail-accordion-icon">${detailTabs[0].icon}</span><span>Vue d'ensemble</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="overview">Chargement des données…</div>
              </details>
              <details class="match-detail-accordion" name="match-detail">
                <summary><span class="match-detail-accordion-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M9 3h6M10 3v6l-5.2 9a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7.2 15h9.6M9 12h6"/></svg></span><span>Expérimentation · +1,5 buts</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="experimentation"></div>
              </details>
              <details class="match-detail-accordion" name="match-detail">
                <summary><span class="match-detail-accordion-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M9 3h6M10 3v6l-5.2 9a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7.2 15h9.6M9 12h6"/></svg></span><span>Expérimentation · +2,5 buts</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="experimentation-over25"></div>
              </details>
              <details class="match-detail-accordion" name="match-detail">
                <summary><span class="match-detail-accordion-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M9 3h6M10 3v6l-5.2 9a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7.2 15h9.6M9 12h6"/></svg></span><span>Expérimentation · BTTS</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="experimentation-btts"></div>
              </details>
              <details class="match-detail-accordion" name="match-detail">
                <summary><span class="match-detail-accordion-icon">📊</span><span>Statistiques équipes</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="team-stats">Chargement des statistiques…</div>
              </details>
              <details class="match-detail-accordion" name="match-detail">
                <summary class="match-detail-accordion-summary-shots"><span class="match-detail-accordion-icon">🎯</span><span>Tirs</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="shots">Chargement des tirs…</div>
              </details>
              <details class="match-detail-accordion" name="match-detail">
                <summary><span class="match-detail-accordion-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="8" cy="8" r="3"/><path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M13.5 17.5h6a3 3 0 0 0 .2-6 4.5 4.5 0 0 0-8.6-1.1"/></svg></span><span>Météo</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="weather">Chargement de la météo…</div>
              </details>
              <details class="match-detail-accordion" name="match-detail">
                <summary><span class="match-detail-accordion-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M12 3v18M3 12h18M12 9a3 3 0 0 0 0 6 3 3 0 0 0 0-6Z"/><circle cx="6.5" cy="7" r=".8"/><circle cx="17.5" cy="17" r=".8"/></svg></span><span>Composition d'équipe</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="compositions">Chargement des données de composition…</div>
              </details>
              <details class="match-detail-accordion" name="match-detail">
                <summary><span class="match-detail-accordion-icon">${detailTabs[1].icon}</span><span>Cotes</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="odds">Chargement des données…</div>
              </details>
            </div>
          </div>`;
        const detailAccordions = detailPanel.querySelectorAll(".match-detail-accordion");
        detailAccordions.forEach((accordion) => {
          accordion.addEventListener("toggle", () => {
            if (!accordion.open) return;
            detailAccordions.forEach((otherAccordion) => {
              if (otherAccordion !== accordion) otherAccordion.open = false;
            });
          });
        });
        renderDetailAccordions();
      };
      const renderFilteredMatches = () => {
        const today = parisDateKey(NOW);
        const [startOffset, endOffset] = dateFilterRanges[activeDateFilter] || [0, 1];
        const firstDate = shiftDateKey(today, startOffset);
        const lastDate = shiftDateKey(today, endOffset);
        const query = (teamSearch?.value || "").trim().toLocaleLowerCase("fr");
        const filtered = upcoming.filter(({ match, kickoff }) => {
          const matchDate = parisDateKey(kickoff);
          const dateMatches = matchDate >= firstDate && matchDate <= lastDate;
          const teamMatches = !query || [match.home_team, match.away_team]
            .some((team) => String(team).toLocaleLowerCase("fr").includes(query));
          const competitionMatches = !activeCompetition || String(match.competition_slug || "") === activeCompetition;
          return dateMatches && teamMatches && competitionMatches;
        });

        if (detailPanel && detailPanel.parentElement === list) {
          detailPanel.classList.remove("match-detail-inline-mobile");
          const workspace = detailPanel.closest(".workspace");
          const matchesSection = document.querySelector(".matches-list-section");
          if (workspace && matchesSection) workspace.insertBefore(detailPanel, matchesSection.nextSibling);
        }
        list.replaceChildren();
        if (countNode) countNode.textContent = filtered.length + (filtered.length === 1 ? " match" : " matchs");
        filtered.forEach(({ match }) => {
          const card = renderMatch(match, standingsIndex);
          if (card) {
            const article = card.querySelector(".upcoming-match-card");
            article.addEventListener("click", () => selectMatch(article, match));
            article.addEventListener("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectMatch(article, match);
              }
            });
            list.appendChild(card);
            if (article.dataset.matchKey === selectedMatchKey) selectMatch(article, match);
          }
        });
        const dayHeading = document.getElementById("matchDayHeading");
        if (dayHeading) dayHeading.querySelector(".match-day-count span").textContent = list.childElementCount + " matchs";
        if (!list.children.length) {
          const empty = document.createElement("p");
          empty.className = "match-filter-count";
          empty.textContent = upcoming.length
            ? "Aucun match ne correspond à ces filtres."
            : "Aucun match futur disponible dans les données publiées.";
          list.appendChild(empty);
        }
      };

      dateButtons.forEach((button) => {
        button.addEventListener("click", () => {
          activeDateFilter = button.dataset.dateFilter;
          dateButtons.forEach((item) => {
            const active = item === button;
            item.classList.toggle("is-active", active);
            item.setAttribute("aria-pressed", String(active));
          });
          renderFilteredMatches();
        });
      });
      teamSearch?.addEventListener("input", renderFilteredMatches);
      competitionFilter?.addEventListener("change", () => {
        activeCompetition = competitionFilter.value;
        renderFilteredMatches();
      });
      renderFilteredMatches();
    })
    .catch((error) => {
      console.error("Chargement des matchs futurs impossible :", error);
      list.textContent = "Les matchs futurs sont temporairement indisponibles.";
    });
})();
