/**
 * Affiche tous les matchs futurs depuis le fichier public agrégé par le moteur V2.
 * Les dates sources sont UTC ; l'affichage est converti en heure de Paris.
 */
(() => {
  const DATA_URL = "./data/matches_future.json";
  const STANDINGS_URL = "./data/standings.json";

  // Logos API-Football associés aux slugs réellement présents dans matches_future.json.
  const COMPETITION_LOGOS = Object.freeze({
    "be-first-division-a": "belgian-pro-league.svg",
    "de-bundesliga": "bundesliga.svg",
    "es-la-liga": "la-liga.svg",
    "fr-ligue-1": "ligue-1.svg",
    "fr-ligue-2": "ligue-2.svg",
    "gb-premier-league": "premier-league.svg",
    "it-serie-a": "serie-a.svg",
    "pt-primeira-liga": "primeira-liga.svg",
    "uefa-champions-league": "uefa-champions-league.svg",
    "uefa-europa-league": "uefa-europa-league.svg",
    "us-mls": "mls.svg"
  });
  const list = document.getElementById("upcomingMatchesList");
  const template = document.getElementById("upcomingMatchTemplate");
  if (!list || !template) return;

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

  const setCompetitionLogo = (root, slug, competitionName) => {
    const image = root.querySelector('[data-field="competition-logo"]');
    const fallback = root.querySelector('[data-field="competition-fallback"]');
    const file = COMPETITION_LOGOS[String(slug || "")];
    if (!image || !fallback || !file) return;
    image.alt = "Logo " + (competitionName || "de la compétition");
    image.addEventListener("load", () => {
      image.hidden = false;
      fallback.hidden = true;
    }, { once: true });
    image.addEventListener("error", () => {
      image.hidden = true;
      fallback.hidden = false;
      image.removeAttribute("src");
    }, { once: true });
    image.src = "./assets/competitions/" + file;
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

  let selectedMatchKey = "";

  const getEstimatedPhase = (match, standingsIndex) => {
    const competition = standingsIndex.get(String(match.competition_slug || ""));
    if (!competition || (competition.season && match.season && competition.season !== match.season)) return "";
    const homePlayed = competition.teams.get(String(match.home_team_id || ""))?.played;
    const awayPlayed = competition.teams.get(String(match.away_team_id || ""))?.played;
    if (!Number.isInteger(homePlayed) || !Number.isInteger(awayPlayed)) return "";
    return "Phase - J" + (Math.min(homePlayed, awayPlayed) + 1);
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

    setText(card, "competition", match.competition || "");
    setCompetitionLogo(card, match.competition_slug, match.competition);
    const phase = getEstimatedPhase(match, standingsIndex);
    const round = setText(card, "round", phase || match.round || "");
    if (round) round.hidden = !phase && !match.round;

    setText(card, "home-name", match.home_team);
    setText(card, "away-name", match.away_team);
    const competitionStandings = standingsIndex.get(String(match.competition_slug || ""));
    const seasonMatches = !competitionStandings?.season || !match.season || competitionStandings.season === match.season;
    const homePosition = seasonMatches ? competitionStandings?.teams.get(String(match.home_team_id || ""))?.position : null;
    const awayPosition = seasonMatches ? competitionStandings?.teams.get(String(match.away_team_id || ""))?.position : null;
    const formatPosition = (position) => position ? "# " + position : "";
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
      .catch((error) => { console.warn("Classements indisponibles : numéro de phase masqué.", error); return null; })
  ])
    .then(([matches, standings]) => {
      if (!Array.isArray(matches)) throw new Error("Format de données inattendu");

      const standingsIndex = buildStandingsIndex(standings);
      const now = Date.now();
      const upcoming = matches
        .filter((match) => match && match.match_category === "future" && match.status !== "cancelled")
        .filter((match) => match.home_team && match.away_team)
        .map((match) => ({ match, kickoff: Date.parse(match.kickoff_utc) }))
        .filter((entry) => Number.isFinite(entry.kickoff) && entry.kickoff > now)
        .sort((a, b) => a.kickoff - b.kickoff);

      const dateButtons = Array.from(document.querySelectorAll("[data-date-filter]"));
      const teamSearch = document.getElementById("matchTeamSearch");
      const countNode = document.getElementById("matchPeriodCount");
      let activeDateFilter = "today-tomorrow";
      const dateFilterRanges = {
        "today-tomorrow": [0, 1],
        "days-2-3": [2, 3],
        "days-4-6": [4, 6]
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
      const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
        day: "numeric", month: "short", timeZone: "Europe/Paris"
      });
      const updateFilterLabels = () => {
        const today = parisDateKey(Date.now());
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
            title.textContent = firstDay.charAt(0).toLocaleUpperCase("fr") + firstDay.slice(1)
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

      const selectMatch = (card, match) => {
        selectedMatchKey = card.dataset.matchKey || "";
        list.querySelectorAll(".upcoming-match-card").forEach((item) => {
          const active = item === card;
          item.classList.toggle("is-selected", active);
          item.setAttribute("aria-pressed", String(active));
        });
        const title = document.querySelector(".match-detail-empty h2");
        const description = document.querySelector(".match-detail-empty p");
        if (title) title.textContent = match.home_team + " – " + match.away_team;
        if (description) {
          const phase = getEstimatedPhase(match, standingsIndex) || match.round || "";
          description.textContent = [match.competition || "", phase].filter(Boolean).join(" · ") || "Match sélectionné";
        }
      };

      const renderFilteredMatches = () => {
        const today = parisDateKey(Date.now());
        const [startOffset, endOffset] = dateFilterRanges[activeDateFilter] || [0, 1];
        const firstDate = shiftDateKey(today, startOffset);
        const lastDate = shiftDateKey(today, endOffset);
        const query = (teamSearch?.value || "").trim().toLocaleLowerCase("fr");
        const filtered = upcoming.filter(({ match, kickoff }) => {
          const matchDate = parisDateKey(kickoff);
          const dateMatches = matchDate >= firstDate && matchDate <= lastDate;
          const teamMatches = !query || [match.home_team, match.away_team]
            .some((team) => String(team).toLocaleLowerCase("fr").includes(query));
          return dateMatches && teamMatches;
        });

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
      renderFilteredMatches();
    })
    .catch((error) => {
      console.error("Chargement des matchs futurs impossible :", error);
      list.textContent = "Les matchs futurs sont temporairement indisponibles.";
    });
})();
