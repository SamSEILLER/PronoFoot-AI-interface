/**
 * Affiche tous les matchs futurs depuis le fichier public agrégé par le moteur V2.
 * Les dates sources sont UTC ; l'affichage est converti en heure de Paris.
 */
(() => {
  const DATA_URL = "./data/matches_future.json";
  const NOW = Date.now();
  const STANDINGS_URL = "./data/standings.json";
  const SEASON_GOALS_URL = "./data/season-goals.json";
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

  const buildSeasonGoalsIndex = (data) => {
    const index = new Map();
    (Array.isArray(data?.competitions) ? data.competitions : []).forEach((competition) => {
      const teams = new Map();
      (Array.isArray(competition.teams) ? competition.teams : []).forEach((team) => {
        if (team?.team_id) teams.set(String(team.team_id), team);
      });
      index.set(String(competition.id), {
        season: String(competition.season || ""),
        matchesCounted: Number(competition.matches_counted || 0),
        teams
      });
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
    fetch(SEASON_GOALS_URL + "?v=" + Date.now(), { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
      .catch((error) => { console.warn("Statistiques de buts par saison indisponibles.", error); return null; }),
    fetch(GOAL_PREDICTIONS_URL + "?v=" + Date.now(), { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
      .catch((error) => { console.warn("Estimations de buts attendus indisponibles.", error); return null; }),
    fetch("./data/match-analytics.json?v=" + Date.now(), { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
      .catch((error) => { console.warn("Statistiques détaillées et tirs récents indisponibles.", error); return null; })
  ])
    .then(([matches, standings, seasonGoals, goalPredictions, matchAnalytics]) => {
      const matchRecords = matches;
      if (!Array.isArray(matchRecords)) throw new Error("Format de données inattendu");

      const standingsIndex = buildStandingsIndex(standings);
      const seasonGoalsIndex = buildSeasonGoalsIndex(seasonGoals);
      const goalPredictionsIndex = buildGoalPredictionsIndex(goalPredictions);
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
        { id:"analysis", label:"Analyse & IA", icon:"<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 3.5 13.8 9l5.7 1.8-5.7 1.8-1.8 5.7-1.8-5.7-5.7-1.8L10.2 9 12 3.5Z'/><path d='m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z'/></svg>" },
        { id:"odds", label:"Cotes", icon:"<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M3.5 6.5h17v13h-17z'/><path d='M3.5 10h17M7 3.5v3M17 3.5v3M7.5 14h3M13.5 14h3M7.5 17h3'/></svg>" }
      ];
      let selectedDetailMatch = null;
      let oddsEvents = null;
      const oddsDataPromise = fetch("./data/odds_latest.json?v=" + Date.now(), { cache:"no-store" })
        .then(response => { if (!response.ok) throw new Error("HTTP " + response.status); return response.json(); })
        .then(payload => { oddsEvents = Array.isArray(payload?.events) ? payload.events : []; return oddsEvents; })
        .catch(error => { console.warn("Cotes OddsAPI indisponibles :", error); oddsEvents = []; return oddsEvents; });
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
      const renderSeasonGoalAnalysis = (body, match) => {
        body.innerHTML = '<p class="analysis-loading">Chargement des statistiques de buts de la saison…</p>';
        const competitionSlug = String(match.competition_slug || "");
        const competition = seasonGoalsIndex.get(competitionSlug);
        const season = String(match.season || "");
        if (!competition || !season || competition.season !== season) {
          body.innerHTML = '<section class="season-goals-empty"><strong>Statistiques indisponibles</strong><p>Aucune donnée validée pour cette compétition et cette saison. Aucune autre compétition ni saison ne sera utilisée en remplacement.</p></section>';
          return;
        }
        const marketLabels = [
          ["over_0_5", "Over 0.5 — Buts du match"],
          ["over_1_5", "Over 1.5 — Buts du match"],
          ["over_2_5", "Over 2.5 — Buts du match"],
          ["over_3_5", "Over 3.5 — Buts du match"],
          ["under_2_5", "Under 2.5 — Buts du match"],
          ["under_3_5", "Under 3.5 — Buts du match"]
        ];
        const renderTeam = (name, teamId, side) => {
          const team = competition.teams.get(String(teamId || ""));
          if (!team || !Number.isInteger(Number(team.played)) || Number(team.played) < 1) {
            return '<section class="season-goals-team"><div class="season-goals-team-heading"><h4>'+escapeHtml(name)+'</h4><span>Données insuffisantes</span></div><p class="season-goals-team-empty">Données insuffisantes pour cette équipe dans la saison sélectionnée.</p></section>';
          }
          const played = Number(team.played);
          const formatAverage = (total) => Number.isFinite(Number(total))
            ? (Number(total) / played).toLocaleString("fr-FR", { minimumFractionDigits:2, maximumFractionDigits:2 })
            : "—";
          const averageStats = '<div class="season-goals-averages">'
            + '<div class="season-goals-average"><strong>'+formatAverage(team.goals_for)+'</strong><span>Buts marqués / match</span></div>'
            + '<div class="season-goals-average"><strong>'+formatAverage(team.goals_against)+'</strong><span>Buts encaissés / match</span></div>'
            + '</div>';
          const venue = side === "home" ? "home" : "away";
          const venueLabel = side === "home" ? "À domicile" : "À l'extérieur";
          const venuePlayed = Number(team[venue + "_played"]);
          const venueStatsValid = Number.isInteger(venuePlayed) && venuePlayed > 0
            && Number.isFinite(Number(team[venue + "_goals_for"]))
            && Number.isFinite(Number(team[venue + "_goals_against"]));
          const venueStats = venueStatsValid
            ? '<div class="season-goals-venue"><div class="season-goals-venue-heading">'+venueLabel+' · '+venuePlayed+' matchs</div>'
              + '<div class="season-goals-averages">'
              + '<div class="season-goals-average"><strong>'+(Number(team[venue + "_goals_for"]) / venuePlayed).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+'</strong><span>Buts marqués / match</span></div>'
              + '<div class="season-goals-average"><strong>'+(Number(team[venue + "_goals_against"]) / venuePlayed).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+'</strong><span>Buts encaissés / match</span></div>'
              + '</div></div>'
            : '<div class="season-goals-venue"><div class="season-goals-venue-heading">'+venueLabel+'</div><p class="season-goals-team-empty">Échantillon insuffisant : aucune moyenne exploitable sur ce lieu.</p></div>';
          const teamScoringStats = [
            ["scored_0_count", name + " : matchs sans but marqué"],
            ["scored_2plus_count", name + " : matchs avec 2 buts ou plus"]
          ].map(([key, label]) => {
            const count = team[key];
            const valid = Number.isInteger(count) && count >= 0 && count <= played;
            const percentage = valid ? (count * 100 / played).toLocaleString("fr-FR", { maximumFractionDigits:2 }) + " %" : "—";
            const detail = valid ? count + " / " + played + " matchs" : "Non disponible";
            return '<div class="season-goals-row"><span>'+label+'</span><strong>'+percentage+'</strong><small>'+detail+'</small></div>';
          }).join("");
          const distributionKeys = ["over_0_5", "over_1_5", "over_2_5"];
          const distributionMetrics = distributionKeys.map(key => team.markets?.[key]);
          const distributionCounts = distributionMetrics.map(metric => Number(metric?.count));
          const distributionValid = distributionMetrics.every((metric, index) =>
            metric && Number.isInteger(Number(metric.count))
            && Number(metric.count) >= 0
            && Number(metric.played) === played
          ) && distributionCounts[0] <= played
            && distributionCounts[0] >= distributionCounts[1]
            && distributionCounts[1] >= distributionCounts[2];
          const distributionValues = distributionValid
            ? [played - distributionCounts[0], distributionCounts[0] - distributionCounts[1],
              distributionCounts[1] - distributionCounts[2], distributionCounts[2]]
            : null;
          const distributionLabels = ["0 but", "1 but", "2 buts", "3 buts et +"];
          const distributionColors = ["#16a34a", "#2585ed", "#eab308", "#ef4444"];
          const distributionHtml = distributionValid
            ? '<div class="season-goals-distribution">'
              + '<div class="season-goals-distribution-chart"><canvas id="seasonGoalsDistribution-'+side+'" role="img" aria-label="Répartition des buts totaux dans les matchs de '+escapeHtml(name)+'"></canvas>'
              + '<div class="season-goals-distribution-center"><strong>'+played+'</strong><span>matchs</span></div></div>'
              + '<div class="season-goals-distribution-legend">'+distributionValues.map((count,index) =>
                '<div class="season-goals-distribution-item"><i style="background:'+distributionColors[index]+'"></i><span>'+distributionLabels[index]+'</span><strong>'+count+' / '+played+'</strong></div>'
              ).join("")+'</div></div>'
            : '<p class="season-goals-distribution-empty">Répartition indisponible : compteurs historiques incomplets ou incohérents.</p>';
          const rows = marketLabels.map(([key, label]) => {
            let metric = team.markets?.[key];
            if (key === "under_3_5") {
              const over35 = team.markets?.over_3_5;
              const overCount = Number(over35?.count);
              const overPlayed = Number(over35?.played);
              metric = over35
                && Number.isInteger(overCount)
                && overCount >= 0
                && overCount <= played
                && overPlayed === played
                ? {
                    count: played - overCount,
                    played,
                    percentage: (played - overCount) * 100 / played
                  }
                : null;
            }
            if (!metric || Number(metric.played) !== played
              || !Number.isInteger(Number(metric.count))
              || Number(metric.count) < 0
              || Number(metric.count) > played
              || !Number.isFinite(Number(metric.percentage))) {
              return '<div class="season-goals-row"><span>'+label+'</span><strong>—</strong><small>Non disponible</small></div>';
            }
            return '<div class="season-goals-row"><span>'+label+'</span><strong>'+Number(metric.percentage).toLocaleString("fr-FR",{maximumFractionDigits:2})+' %</strong><small>'+Number(metric.count)+' / '+Number(metric.played)+' matchs</small></div>';
          }).join("");
          return '<section class="season-goals-team"><div class="season-goals-team-heading"><h4>'+escapeHtml(name)+'</h4><span>'+Number(team.played)+' matchs joués</span></div>'+averageStats+venueStats+'<div class="season-goals-distribution-heading">Répartition des buts totaux par match</div>'+distributionHtml+teamScoringStats+rows+'</section>';
        };
        body.innerHTML = '<div class="season-goals-analysis"><div class="season-goals-meta"><strong>'+escapeHtml(competition.name)+'</strong><span>Saison '+escapeHtml(season)+' · '+competition.matchesCounted+' matchs retenus</span></div><div class="season-goals-grid">'+renderTeam(match.home_team,match.home_team_id,'home')+renderTeam(match.away_team,match.away_team_id,'away')+'</div><p class="season-goals-footnote">Répartition fondée sur le nombre total de buts inscrits par les deux équipes dans chaque rencontre. Fréquences calculées uniquement sur les matchs terminés de la même compétition et de la même saison ; elles ne constituent pas des probabilités prédictives.</p></div>';
        const drawSeasonGoalCharts = (ChartConstructor) => {
          if (!ChartConstructor || !body.isConnected) return;
          body.querySelectorAll(".season-goals-distribution-chart canvas").forEach(canvas => {
            if (!canvas.isConnected) return;
            const team = competition.teams.get(String(canvas.id.endsWith("-home") ? match.home_team_id : match.away_team_id));
            if (!team) return;
            const played = Number(team.played);
            const metrics = ["over_0_5", "over_1_5", "over_2_5"].map(key => team.markets?.[key]);
            if (!metrics.every(metric => metric && Number.isInteger(Number(metric.count)) && Number(metric.played) === played)) return;
            const over = metrics.map(metric => Number(metric.count));
            if (over[0] > played || over[0] < over[1] || over[1] < over[2]) return;
            const buckets = [played-over[0], over[0]-over[1], over[1]-over[2], over[2]];
            const existing = ChartConstructor.getChart?.(canvas);
            if (existing) existing.destroy();
            new ChartConstructor(canvas, {
              type:"doughnut",
              data:{labels:["0 but","1 but","2 buts","3 buts et +"],datasets:[{
                data:buckets,
                backgroundColor:["#16a34a","#2585ed","#eab308","#ef4444"],
                borderColor:"#ffffff",borderWidth:3,spacing:2,hoverOffset:3
              }]},
              options:{responsive:true,maintainAspectRatio:false,cutout:"66%",rotation:-90,animation:false,
                plugins:{legend:{display:false},tooltip:{enabled:true,callbacks:{
                  label:(context)=>" "+context.label+" : "+context.raw+" / "+played+" ("+Math.round(context.raw/played*100)+" %)"
                }}}
              }
            });
          });
        };
        if (window.chartJsReady && typeof window.chartJsReady.then==="function") window.chartJsReady.then(drawSeasonGoalCharts);
        else drawSeasonGoalCharts(window.Chart);
      };

      const renderDetailAccordions = () => {
        if (!detailPanel || !selectedDetailMatch) return;
        const overview = detailPanel.querySelector('[data-detail-panel="overview"]');
        const analysis = detailPanel.querySelector('[data-detail-panel="analysis"]');
        const odds = detailPanel.querySelector('[data-detail-panel="odds"]');
        const teamStats = detailPanel.querySelector('[data-detail-panel="team-stats"]');
        const shots = detailPanel.querySelector('[data-detail-panel="shots"]');
        const matchContext = detailPanel.querySelector('[data-detail-panel="match-context"]');
        if (matchContext && window.PronoFootMatchContext) window.PronoFootMatchContext.renderInto(matchContext, selectedDetailMatch);
        if (overview) renderHistoryOverview(overview, selectedDetailMatch);
        if (analysis) renderSeasonGoalAnalysis(analysis, selectedDetailMatch);
        if (odds) renderOdds(odds, selectedDetailMatch);
        const analytics = matchAnalyticsIndex.get(String(selectedDetailMatch.competition_slug || ""));
        const renderRecentTeamStats = () => {
          if (!analytics) return '<p class="match-detail-empty">Aucune collecte de statistiques détaillées disponible pour cette compétition.</p>';
          const sides = [
            { id: String(selectedDetailMatch.home_team_id || ""), name: selectedDetailMatch.home_team, side: "home" },
            { id: String(selectedDetailMatch.away_team_id || ""), name: selectedDetailMatch.away_team, side: "away" }
          ];
          const chartPayloads = [];
          const cards = sides.map((team, teamIndex) => {
            const entry = analytics.teams.get(team.id);
            const recent = (entry?.recent_match_ids || []).map((id) => analytics.matchesById.get(String(id))).filter(Boolean)
              .sort((a,b) => String(a.kickoff_utc || "").localeCompare(String(b.kickoff_utc || ""))).slice(-5);
            if (!recent.length) return '<section class="match-analytics-team"><h4>'+escapeHtml(team.name)+'</h4><p>Aucun match récent exploitable dans cette compétition et cette saison.</p></section>';
            const rows = [];
            const labels = [], xgValues = [], xgaValues = [], goalsFor = [], goalsAgainst = [];
            const aggregate = new Map();
            recent.forEach((item, index) => {
              const side = String(item.home_team_id) === team.id ? "home" : "away";
              const opponentSide = side === "home" ? "away" : "home";
              const all = (item.team_stats?.periods || []).find((period) => period.period === "All") || item.team_stats?.periods?.[0];
              const metrics = (all?.groups || []).flatMap((group) => (group.items || []).map((stat) => ({
                label: stat.title || stat.key || group.group_name, key: stat.key || "", value: stat[side]
              }))).filter((stat) => stat.value !== undefined && stat.value !== null && stat.value !== "");
              metrics.forEach((stat) => {
                const key = String(stat.key+" "+stat.label).toLowerCase();
                if (/expected goals|\bxg\b/.test(key)) {
                  const value = Number(stat.value);
                  if (Number.isFinite(value)) xgValues[index] = value;
                }
                const normalized = key.replace(/[^a-z]/g,"");
                const aliases = [
                  ["shotsontarget", "Tirs cadrés"], ["shots on target", "Tirs cadrés"],
                  ["totalshots", "Tirs"], ["shots", "Tirs"], ["corners", "Corners"],
                  ["possession", "Possession (%)"]
                ];
                const match = aliases.find(([needle]) => normalized.includes(needle.replace(/[^a-z]/g,"")));
                if (match && Number.isFinite(Number(stat.value))) {
                  const label = match[1];
                  if (!aggregate.has(label)) aggregate.set(label, []);
                  aggregate.get(label).push(Number(stat.value));
                }
              });
              const shots = (item.shots?.periods || []).flatMap((period) => period.shots || []);
              const ownShots = shots.filter((shot) => String(shot.team_id || "") === team.id);
              const opponentShots = shots.filter((shot) => String(shot.team_id || "") !== team.id);
              const ownKnown = ownShots.filter((shot) => shot.expected_goals != null && Number.isFinite(Number(shot.expected_goals)));
              const opponentKnown = opponentShots.filter((shot) => shot.expected_goals != null && Number.isFinite(Number(shot.expected_goals)));
              if (opponentShots.length && opponentKnown.length) xgaValues[index] = opponentKnown.reduce((sum, shot) => sum + Number(shot.expected_goals), 0);
              const gf = item[side+"_score"], ga = item[opponentSide+"_score"];
              if (gf != null && ga != null && Number.isFinite(Number(gf)) && Number.isFinite(Number(ga))) {
                goalsFor.push(Number(gf)); goalsAgainst.push(Number(ga));
              }
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
            const avg = (values) => values.length ? (values.reduce((a,b)=>a+b,0)/values.length).toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "—";
            const avgCards = '<div class="match-analytics-kpis"><div><strong>'+avg(goalsFor)+'</strong><span>Buts marqués / match</span></div><div><strong>'+avg(goalsAgainst)+'</strong><span>Buts encaissés / match</span></div></div>';
            const chartId = "match-team-chart-"+teamIndex;
            chartPayloads.push({id:chartId,labels,xg:xgValues,xga:xgaValues});
            const statDefinitions = [
              ["Tirs", '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m12 7 3 2-1 4h-4L9 9l3-2ZM3.5 9.5l5.5-.5m6 0 5.5.5M6 18l4-5m8 5-4-5"/></svg>', "par match"],
              ["Tirs cadrés", '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/></svg>', "par match"],
              ["Possession (%)", '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 3v9l6 3M16 3h5v5"/></svg>', "du temps"],
              ["Corners", '<svg viewBox="0 0 24 24"><path d="M5 21V3m0 1 13 3-5 4 5 4-13-3"/></svg>', "par match"]
            ];
            const statTiles = statDefinitions.filter(([label]) => aggregate.has(label)).map(([label,icon,unit]) => {
              const value = avg(aggregate.get(label));
              const displayValue = label === "Possession (%)" ? value+" %" : value;
              return '<div class="match-analytics-stat-tile"><span class="match-analytics-stat-icon" aria-hidden="true">'+icon+'</span><strong>'+escapeHtml(displayValue)+'</strong><span class="match-analytics-stat-label">'+escapeHtml(label)+'</span><small>'+escapeHtml(unit)+'</small></div>';
            }).join("");
            const statsOutside = statTiles ? '<div class="match-analytics-stat-grid match-analytics-stat-grid-outside">'+statTiles+'</div>' : '';
            return '<section class="match-analytics-team"><header class="match-analytics-team-heading"><h4>'+escapeHtml(team.name)+'</h4><span>'+recent.length+' matchs</span></header>'+avgCards+statsOutside+'<div class="match-analytics-chart-title">Évolution xG / xG Adverse</div><div class="match-analytics-chart"><canvas id="'+chartId+'" aria-label="Évolution xG et xG Adverse de '+escapeHtml(team.name)+'"></canvas></div><details class="match-analytics-recent-accordion"><summary class="match-analytics-recent-list-title">5 derniers matchs</summary><div class="match-analytics-recent-list">'+rows.join("")+'</div></details></section>';
          });
          const html = '<div class="match-analytics-grid">'+cards.join("")+'</div><p class="match-analytics-note">Cinq derniers matchs dans la même compétition et la même saison. Les moyennes utilisent uniquement les valeurs disponibles. Les occasions concédées sont calculées à partir des tirs adverses disponibles et peuvent être partielles ; les données absentes ne sont jamais remplacées par zéro.</p>';
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
                    {label:"  xG",data:payload.xg,borderColor:"#F97316",backgroundColor:"#F97316",borderWidth:2.8,tension:.3,spanGaps:false,pointRadius:4},
                    {label:"  xG Adverse",data:payload.xga,borderColor:"#7C3AED",backgroundColor:"#7C3AED",borderWidth:2.8,tension:.3,spanGaps:false,pointRadius:4}
                  ]},
                  options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:"index",intersect:false},
                    plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:7,font:{size:10}}}},
                    scales:{y:{beginAtZero:true,ticks:{font:{size:9}},grid:{color:"#edf2f7"}},x:{ticks:{font:{size:9}},grid:{display:false}}}}
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
                if (teamStats) renderRecentTeamStats();
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
                <summary><span class="match-detail-accordion-icon">📊</span><span>Statistiques équipes</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="team-stats">Chargement des statistiques…</div>
              </details>
              <details class="match-detail-accordion" name="match-detail">
                <summary class="match-detail-accordion-summary-shots"><span class="match-detail-accordion-icon">🎯</span><span>Tirs</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="shots">Chargement des tirs…</div>
              </details>
              <details class="match-detail-accordion" name="match-detail">
                <summary><span class="match-detail-accordion-icon">${detailTabs[1].icon}</span><span>Analyse &amp; IA</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="analysis">Chargement des données…</div>
              </details>
              <details class="match-detail-accordion" name="match-detail">
                <summary><span class="match-detail-accordion-icon">🩺</span><span>Effectifs &amp; absences</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
                <div class="match-detail-accordion-body" data-detail-panel="match-context">Chargement du contexte…</div>
              </details>
              <details class="match-detail-accordion" name="match-detail">
                <summary><span class="match-detail-accordion-icon">${detailTabs[2].icon}</span><span>Cotes</span><span class="match-detail-accordion-chevron" aria-hidden="true">⌄</span></summary>
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
