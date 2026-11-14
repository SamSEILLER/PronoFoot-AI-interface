# Match Context JSON — format 1.0

Ce fichier est importé manuellement dans l'interface PronoFoot-AI. Il complète les matchs PitchAPI ; il ne modifie ni le calendrier ni les statistiques historiques.

## Périmètre attendu

- Tous les matchs dont la date locale Europe/Paris se situe entre aujourd'hui (J) et J+6 inclus.
- Tous les championnats présents dans le calendrier publié, sans dépendre des filtres visuels de l'interface.
- Un enregistrement par match. Utiliser en priorité l'identifiant PitchAPI provider_match_id.
- Générer le fichier au moment de la recherche et indiquer l'heure réelle de vérification.
- Ne jamais transformer une absence de source en confirmation d'absence.

## Schéma JSON 1.0

    {
      "schema_version": "1.0",
      "source": "ChatGPT",
      "generated_at_utc": "2026-11-14T14:00:00Z",
      "period": {
        "from_utc": "2026-11-13T23:00:00Z",
        "to_utc": "2026-11-20T22:59:59Z",
        "timezone": "Europe/Paris",
        "days_included": 7
      },
      "matches": [
        {
          "provider_match_id": "IDENTIFIANT_PITCHAPI",
          "competition_slug": "fr-ligue-1",
          "kickoff_utc": "2026-11-15T19:45:00Z",
          "home_team": "Équipe domicile",
          "away_team": "Équipe extérieure",
          "verified_at_utc": "2026-11-14T13:55:00Z",
          "sources": [{"name":"Nom de la source","url":"https://example.org/article","published_at_utc":"2026-11-14T10:00:00Z"}],
          "home": {
            "injuries": [{"name":"Nom du joueur","position":"Défenseur","status":"confirmed","reason":"Motif rapporté par la source"}],
            "suspensions": [], "doubtful": [], "expected_lineup": [], "confirmed_lineup": []
          },
          "away": {
            "injuries": [], "suspensions": [], "doubtful": [], "expected_lineup": [], "confirmed_lineup": []
          }
        }
      ]
    }

## Règles de statut

- confirmed : information confirmée par une source fiable ou officielle.
- probable : information annoncée comme probable, pas encore officielle.
- uncertain : doute, rumeur ou informations contradictoires.
- unavailable : information explicitement indisponible ; ne signifie pas que le joueur est absent.

Chaque entrée joueur doit contenir name. position et reason sont facultatifs. Chaque match doit contenir verified_at_utc, sources, les objets home et away. Les listes acceptées dans chaque équipe sont injuries, suspensions, doubtful, expected_lineup et confirmed_lineup.

Les URLs des sources doivent être en HTTPS. Les dates doivent être des timestamps ISO-8601 valides. Les doublons sont refusés.

## Rattachement à un match

1. Correspondance exacte de provider_match_id avec l'identifiant PitchAPI du match.
2. À défaut : correspondance stricte de competition_slug, kickoff_utc, home_team et away_team (accents et casse neutralisés).
3. Aucun rapprochement approximatif par nom seul. Un match non reconnu n'est pas rattaché silencieusement.

## Stockage et confidentialité

L'import est conservé dans le stockage local du navigateur (localStorage), avec une limite de 2 Mo. Le fichier n'est pas envoyé à GitHub, à PitchAPI ou à un autre serveur. Le contexte n'est donc pas automatiquement partagé entre appareils ou navigateurs. Un nouvel import remplace le précédent.

L'interface affiche la date de vérification, les statuts et les sources. Les compositions probables ne sont jamais présentées comme officielles.