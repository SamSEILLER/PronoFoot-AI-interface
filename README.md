# PronoFoot AI — interface

Interface web publique du projet Football Prediction Lab. Elle présente les matchs à venir, les détails d'une rencontre, l'historique et les classements.

## Pages

- `index.html` — matchs à venir et fiche détaillée.
- `history.html` — historique des rencontres.
- `classements.html` — classements.

## Données consommées

Les fichiers JSON sont publiés dans `data/` par le moteur V2 ou synchronisés depuis celui-ci :

- `matches_future.json` — calendrier futur.
- `standings.json` — classements.
- `season-goals.json` — statistiques descriptives par équipe, compétition et saison.
- `goal-predictions.json` — estimations pré-match des buts attendus (λ).
- `recent-form.json`, `head-to-head.json` — forme et confrontations historiques.
- `odds_latest.json` — dernier relevé des cotes Unibet ; peut légitimement contenir zéro événement.
- `site-status.json` — fraîcheur, couverture et état des collectes.

## Fiche match

La fiche est rendue par `scripts/display/matches.js`. Elle présente les buts attendus disponibles et trois panneaux repliables : Vue d'ensemble, Analyse & IA et Cotes. Les statistiques de saison sont descriptives et ne doivent pas être présentées comme des probabilités prédictives. Les cotes ne sont affichées que lorsqu'elles sont réellement présentes dans le JSON.

## État des sources

L'indicateur de statut résume l'état technique et la fraîcheur des collectes. Un statut global « OK » ne garantit ni la présence de cotes pour chaque match ni l'exhaustivité des données. Consulter le détail du statut pour distinguer collecte réussie, absence de fixtures et couverture partielle.

## Développement

- Les changements de l'interface sont publiés sur `main`.
- Les données sont générées par le dépôt moteur privé `SamSEILLER/PronoFoot-AI-V2`.
- Le workflow du moteur publie `site-status.json` vers ce dépôt.
- Les tests du moteur ne remplacent pas un contrôle navigateur de l'interface.

