# PronoFoot AI — Football Prediction Lab

Interface web publique du projet **PronoFoot AI**. Ce dépôt contient la partie front-end destinée à présenter les matchs, l'historique et les classements.

## Pages

- **Matchs à venir** — page d'accueil de l'interface.
- **Historique** — accès à l'historique des rencontres.
- **Classement** — accès aux classements.

## État des sources de données

La page d'accueil affiche un indicateur compact de l'état des sources :

- **Sources : OK** — les données sont signalées comme opérationnelles.
- **Sources : Vigilance** — une couverture partielle, une anomalie ou des données à contrôler sont signalées.
- **Sources : Erreur** — le statut global est en erreur ou le fichier de statut est inaccessible.

Cliquer sur l'indicateur ouvre le détail des collectes PitchAPI (historique des matchs) et Odds-API.io (cotes).

Le front-end lit le fichier `data/site-status.json`. Celui-ci est publié depuis le dépôt moteur privé **PronoFoot-AI-V2** par le workflow de publication dédié. La génération du statut à partir des données locales ne déclenche pas une nouvelle collecte auprès des fournisseurs.

> L'indicateur décrit l'état technique et la couverture des sources. Il ne constitue pas une garantie d'exhaustivité des données ni une recommandation de pari.

## Structure principale

- `index.html` — accueil et indicateur d'état des sources.
- `history.html` — page historique.
- `classements.html` — page des classements.
- `assets/` — logos et icônes de navigation.
- `data/site-status.json` — dernier état publié des sources de données.

## Mise à jour

Les modifications de l'interface sont publiées sur la branche `main`. Le fichier `data/site-status.json` est mis à jour automatiquement par le workflow de publication du dépôt moteur lorsqu'il s'exécute avec succès.
