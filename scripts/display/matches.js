/**
 * Affiche les prochains matchs depuis le fichier public agrégé par le moteur V2.
 * Les dates sources sont UTC ; l'affichage est converti en heure de Paris.
 */
(() => {
  const DATA_URL = "./data/matches_future.json";
  const list = document.getElementById("upcomingMatchesList");
  const template = document.getElementById("upcomingMatchTemplate");
  if (!list || !template) return;

  const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris"
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

  const renderMatch = (match) => {
    const kickoff = new Date(match.kickoff_utc);
    if (!match.home_team || !match.away_team || !Number.isFinite(kickoff.getTime())) return null;

    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".upcoming-match-card");
    const time = setText(card, "kickoff", dateFormatter.format(kickoff));
    if (time) time.dateTime = kickoff.toISOString();

    setText(card, "competition", match.competition || "");
    const round = setText(card, "round", match.round ? " · " + match.round : "");
    if (round && !match.round) round.hidden = true;

    setText(card, "home-name", match.home_team);
    setText(card, "away-name", match.away_team);
    setLogo(card, "home-logo", match.provider_record?.home_team?.image_url, match.home_team);
    setLogo(card, "away-logo", match.provider_record?.away_team?.image_url, match.away_team);
    return fragment;
  };

  fetch(DATA_URL + "?v=" + Date.now(), { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then((matches) => {
      if (!Array.isArray(matches)) throw new Error("Format de données inattendu");
      const upcoming = matches
        .filter((match) => match && match.match_category === "future" && match.status !== "cancelled")
        .filter((match) => match.home_team && match.away_team && match.kickoff_utc)
        .sort((a, b) => Date.parse(a.kickoff_utc) - Date.parse(b.kickoff_utc));

      list.replaceChildren();
      const nextMatches = upcoming.slice(0, 40);
      nextMatches.forEach((match) => {
        const card = renderMatch(match);
        if (card) list.appendChild(card);
      });

      if (!list.children.length) {
        list.textContent = "Aucun match futur disponible dans les données publiées.";
      }
    })
    .catch((error) => {
      console.error("Chargement des matchs futurs impossible :", error);
      list.textContent = "Les matchs futurs sont temporairement indisponibles.";
    });
})();
