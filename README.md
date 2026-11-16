# PronoFoot AI — interface

Interface web publique du projet Football Prediction Lab. Elle présente les matchs à venir, les détails d'une rencontre et les classements.

## Pages

- `index.html` — matchs à venir et fiche détaillée.
- `classements.html` — classements.
- `composition.html` — historique des instantanés de compositions PitchAPI J-7/J-2/J-1.

## Données consommées

Les fichiers JSON sont publiés dans `data/` par le moteur V2 ou synchronisés depuis celui-ci :

- `matches_future.json` — calendrier futur.
- `standings.json` — classements.
- `season-goals.json` — statistiques descriptives par équipe, compétition et saison.
- `goal-predictions.json` — estimations pré-match des buts attendus (λ).
- `recent-form.json`, `head-to-head.json` — forme et confrontations historiques.
- `odds_latest.json` — dernier relevé des cotes Unibet ; peut légitimement contenir zéro événement.
- `site-status.json` — fraîcheur, couverture et état des collectes.
- `compositions.json` — instantanés PitchAPI, listes de titulaires/remplaçants lorsqu'elles sont fournies et statuts explicites des données indisponibles.\n- `espn-pitchapi-historical.json` — rapprochement historique ESPN / PitchAPI, scores, statistiques d'équipe et informations de rosters détectées.

## Fiche match

La fiche est rendue par `scripts/display/matches.js`. Elle présente les buts attendus disponibles et des panneaux repliables, dont Composition d'équipe avec les instantanés PitchAPI J-7/J-2/J-1 associés au match. Le panneau Statistiques équipes affiche aussi les valeurs historiques ESPN disponibles pour les cinq derniers matchs contrôlés de la compétition, avec l'état de concordance des scores. Les statistiques ESPN sont des données de diagnostic issues de l'API publique ESPN non officielle : elles ne sont pas encore harmonisées avec PitchAPI et ne sont pas utilisées par le modèle prédictif. Les statistiques de saison sont descriptives et ne doivent pas être présentées comme des probabilités prédictives. Les cotes ne sont affichées que lorsqu'elles sont réellement présentes dans le JSON.

## État des sources

L'indicateur de statut résume l'état technique et la fraîcheur des collectes. Un statut global « OK » ne garantit ni la présence de cotes pour chaque match ni l'exhaustivité des données. Consulter le détail du statut pour distinguer collecte réussie, absence de fixtures et couverture partielle.

## Développement

- Les changements de l'interface sont publiés sur `main`.
- Les données sont générées par le dépôt moteur privé `SamSEILLER/PronoFoot-AI-V2`.
- Le workflow central du moteur publie les JSON nécessaires à l'interface (calendrier, classements, forme, confrontations, analyses, cotes, météo, compositions, rapport ESPN et statut) vers ce dépôt.
- Les tests du moteur ne remplacent pas un contrôle navigateur de l'interface.

