/**
 * Affiche tous les matchs futurs depuis le fichier public agrégé par le moteur V2.
 * Les dates sources sont UTC ; l'affichage est converti en heure de Paris.
 */
(() => {
  const DATA_URL = "./data/matches_future.json";
  const STANDINGS_URL = "./data/standings.json";

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
    const competitionElement = setText(card, "competition", competitionName || competitionCode);
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
      const shortWeekdayFormatter = new Intl.DateTimeFormat("fr-FR", {
        weekday: "short", timeZone: "Europe/Paris"
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
            title.textContent = key === "days-4-6"
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
        { id:"overview", label:"Vue d'ensemble", icon:"▥" },
        { id:"stats", label:"Statistiques", icon:"↗" },
        { id:"analysis", label:"Analyse", icon:"▤" },
        { id:"odds", label:"Cotes", icon:"♧" }
      ];
      const renderDetailTab = (activeTab) => {
        if (!detailPanel) return;
        detailPanel.querySelectorAll("[data-detail-tab]").forEach((button) => {
          const active = button.dataset.detailTab === activeTab;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-selected", String(active));
        });
        const body = detailPanel.querySelector(".match-detail-body");
        if (!body) return;
        const messages = {
          overview:"Les données complémentaires de cette rencontre ne sont pas encore disponibles.",
          stats:"Statistiques détaillées : données indisponibles pour le moment.",
          analysis:"Analyse prédictive : données indisponibles pour le moment.",
          odds:"Cotes des bookmakers : données indisponibles pour le moment."
        };
        body.textContent = messages[activeTab] || messages.overview;
      };
      const selectMatch = (card, match) => {
        selectedMatchKey = card.dataset.matchKey || "";
        list.querySelectorAll(".upcoming-match-card").forEach((item) => {
          const active = item === card;
          item.classList.toggle("is-selected", active);
          item.setAttribute("aria-pressed", String(active));
        });
        if (!detailPanel) return;
        const kickoff = new Date(match.kickoff_utc);
        const dateLabel = Number.isFinite(kickoff.getTime())
          ? new Intl.DateTimeFormat("fr-FR",{weekday:"short",day:"2-digit",month:"short",year:"numeric",timeZone:"Europe/Paris"}).format(kickoff)
            + " · " + new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"}).format(kickoff)
          : "Date indisponible";
        const phase = getEstimatedPhase(match, standingsIndex) || match.round || "";
        const competition = match.competition || "Compétition inconnue";
        const standings = standingsIndex.get(String(match.competition_slug || ""));
        const seasonMatches = !standings?.season || !match.season || standings.season === match.season;
        const homePosition = seasonMatches ? standings?.teams.get(String(match.home_team_id || ""))?.position : null;
        const awayPosition = seasonMatches ? standings?.teams.get(String(match.away_team_id || ""))?.position : null;
        const homeLogo = safeLogoUrl(match.provider_record?.home_team?.image_url);
        const awayLogo = safeLogoUrl(match.provider_record?.away_team?.image_url);
        const escape = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
        detailPanel.innerHTML = `
          <div class="match-detail-content">
            <div class="match-detail-top">
              <div class="match-detail-competition"><span aria-hidden="true">🏆</span><span>${escape(competition)}</span>${phase ? "<span>· "+escape(phase)+"</span>":""}</div>
              <div class="match-detail-date">${escape(dateLabel)}</div>
            </div>
            <div class="match-detail-teams">
              <div class="match-detail-team">${homeLogo ? '<img src="'+escape(homeLogo)+'" alt="Logo '+escape(match.home_team)+'">':""}<strong>${escape(match.home_team)}</strong><small>${homePosition ? homePosition+"e":"Classement indisponible"}</small></div>
              <div class="match-detail-vs">VS</div>
              <div class="match-detail-team">${awayLogo ? '<img src="'+escape(awayLogo)+'" alt="Logo '+escape(match.away_team)+'">':""}<strong>${escape(match.away_team)}</strong><small>${awayPosition ? awayPosition+"e":"Classement indisponible"}</small></div>
            </div>
            <div class="match-detail-xg">
              <span class="match-detail-xg-label">Buts attendus</span>
              <span class="match-detail-xg-value">${escape(match.home_team)} <strong>Indisponible</strong></span>
              <span aria-hidden="true">–</span>
              <span class="match-detail-xg-value">${escape(match.away_team)} <strong>Indisponible</strong></span>
              <span class="match-detail-xg-value">Total <strong>Indisponible</strong></span>
            </div>
            <div class="match-detail-tabs" role="tablist" aria-label="Données du match">
              ${detailTabs.map(tab=>'<button type="button" class="match-detail-tab'+(tab.id==="overview"?" is-active":"")+'" role="tab" aria-selected="'+(tab.id==="overview"?"true":"false")+'" data-detail-tab="'+tab.id+'"><span aria-hidden="true">'+tab.icon+'</span><span>'+tab.label+'</span></button>').join("")}
            </div>
            <div class="match-detail-body" role="tabpanel">Les données complémentaires de cette rencontre ne sont pas encore disponibles.</div>
          </div>`;
        renderDetailTab("overview");
      };
      detailPanel?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-detail-tab]");
        if (button) renderDetailTab(button.dataset.detailTab);
      });

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
          const competitionMatches = !activeCompetition || String(match.competition_slug || "") === activeCompetition;
          return dateMatches && teamMatches && competitionMatches;
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
