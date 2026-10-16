# API publique Météo — SCRUM-73

Cette API NestJS expose les villes de LMN24 et leurs **derniers relevés** PostgreSQL.
Elle ne contacte **jamais Open-Meteo pendant les consultations**.

## Endpoint

`GET http://localhost:3001/weather?continent=EU`

- Public, accessible sans authentification, lecture seule.
- `continent` accepte `EU`, `AS`, `AF`, `NA`, `SA`, `OC`. Omission : `EU`. Valeur incorrecte ou autre paramètre : HTTP 400.
- Liste des villes actives seulement, tri `displayOrder ASC`, puis `slug ASC`.
- Mise en cache HTTP : `Cache-Control: public, max-age=30, stale-while-revalidate=30`. Le frontend doit toujours afficher l'horodatage du relevé et l'état de fraîcheur, car les données peuvent vieillir pendant la durée du cache.
- L'heure locale est à calculer dans le navigateur avec le champ IANA `timezone` et `Intl.DateTimeFormat`. La météo n'est pas recalculée à chaque visite.

### Format JSON de réponse

```json
{
  "continent": "EU",
  "generatedAt": "2026-10-16T12:00:00.000Z",
  "staleAfterMinutes": 180,
  "attribution": { "name": "Open-Meteo", "url": "https://open-meteo.com/" },
  "count": 1,
  "items": [{
    "slug": "paris",
    "name": "Paris",
    "countryIso2": "FR",
    "continentCode": "EU",
    "timezone": "Europe/Paris",
    "displayOrder": 1,
    "freshness": "FRESH",
    "current": {
      "temperatureC": 18.5,
      "apparentTemperatureC": 17.25,
      "humidityPct": 66,
      "windSpeedKmh": 12.3,
      "weatherCode": 2,
      "isDay": true,
      "observedAt": "2026-10-16T11:45:00.000Z",
      "fetchedAt": "2026-10-16T11:46:00.000Z",
      "provider": "OPEN_METEO"
    }
  }]
}
```

*Exemple fictif de données. Les réponses réelles dépendent de la collecte.*

Le statut `freshness` de chaque ville vaut :

- `FRESH` : `observedAt` n'est pas plus ancien que `weatherStaleAfterMinutes`.
- `STALE` : dernière observation conservée, mais trop ancienne (ou horodatage futur manifestement incohérent). Le frontend doit la signaler clairement, sans la présenter comme de la météo en direct.
- `UNAVAILABLE` : pas encore d'observation. Dans ce cas `current` vaut `null`. Le nom et le fuseau horaire de la ville restent disponibles.

Le seuil est lu dans le paramètre global `weatherStaleAfterMinutes` (valeur de repli : 180 min). Les dates sont en UTC/ISO 8601, les températures en °C et le vent en km/h. Le pays est exprimé en ISO2. Le backend n'envoie ni coordonnées GPS, ni données de compte administrateur, ni historique des logs du parser.

## Test rapide depuis PowerShell

```powershell
git switch main
git pull --ff-only origin main
pnpm dev
Invoke-RestMethod -Uri "http://localhost:3001/weather?continent=EU" |
  ConvertTo-Json -Depth 6
```

Si le seed de SCRUM-69 a été importé, la sélection Europe doit contenir 15 villes actives au départ. Avant le premier lancement manuel de SCRUM-72, leurs `current` peuvent être `null`, ce qui est normal.

## Périmètre

Cette Story ne fournit **pas encore** la page publique `/[locale]/weather` ni l'entrée de header : celles-ci relèvent de SCRUM-74. Les pictogrammes SVG, les horloges locales et la détection automatique du continent viennent avec SCRUM-75/76.

Aucune migration SQL supplémentaire n'est nécessaire pour SCRUM-73.
