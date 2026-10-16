# SCRUM-79 — Recette MVP Météo mondiale LMN24

> **Périmètre : uniquement manuel + tests automatisés de régression.**
> L'automatisation météo (SCRUM-80) est différée et sera traitée
> conjointement avec les collectes Articles, Vidéos et Horoscopes.
> Ne pas activer de CRON dans cette recette.

## 1. Prérequis

- Branch `main` à jour ; `pnpm dev` lance le frontend (3000), NestJS (3001)
  et le parser (3002), PostgreSQL fonctionne.
- Migrations et seeds météo SCRUM-69 installés ; seeds de rétention
  SCRUM-78 déjà rejoués. Faire une **sauvegarde PostgreSQL** avant toute purge.
- Compte administrateur actif ; accès sortant vers `api.open-meteo.com`
  pour tester la vraie collecte manuelle.
- **Test de la géolocalisation IP réelle uniquement sur un proxy Cloudflare
  correctement verrouillé** ; en local, comportement attendu : repli Europe.

## 2. Vérification de la base et de l'API

Depuis PowerShell à la racine du dépôt :

```powershell
git switch main
git pull --ff-only origin main
pnpm dev
```

Dans un autre terminal :

```powershell
Invoke-RestMethod "http://localhost:3001/weather?continent=EU" |
  ConvertTo-Json -Depth 6
```

Jeux de données initiaux attendus **si aucune ville n'a été modifiée** :

| Continent | EU | AS | AF | NA | SA | OC | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Villes actives | 15 | 15 | 12 | 12 | 6 | 6 | 66 |

Contrôles : le champ `items` ne contient que les villes actives du continent,
triées par `displayOrder`; `current` est `null` avant la première collecte ;
`freshness` vaut `UNAVAILABLE`, `FRESH` ou `STALE` selon `observedAt`.
Aucun identifiant interne administrateur, secret de parser, IP ou
historique de log ne figure dans l'API publique.

```powershell
# 400 attendu pour un continent ou paramètre inattendu
try {
  Invoke-RestMethod "http://localhost:3001/weather?continent=XX"
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Testez aussi `http://localhost:3000/api/public/weather?continent=EU`.
Seules des réponses validées du backend sont mises en cache 30 secondes ;
une erreur serveur ou de format produit une réponse `503` sans informations
internes. Le navigateur ne doit pas appeler Open-Meteo directement.

## 3. Collecte et supervision — parcours fonctionnel

1. Aller sur `http://localhost:3000/admin/weather-cities` ;
   contrôler les 66 villes initiales, les filtres, une désactivation /
   réactivation non destructive et l'ordre des villes.
2. Aller sur `http://localhost:3000/admin/weather-parser` ;
   choisir **Europe** et lancer manuellement une collecte.
   Attendre un statut final (`SUCCESS`, `PARTIAL` ou `ERROR`).
   Vérifier les 15 villes traitées si toutes sont actives, les compteurs
   cohérents et le détail des éventuelles erreurs.
3. Pendant une collecte encore `RUNNING`, tester qu'un second lancement
   est refusé (`409`) sans créer de nouvelle exécution.
4. Depuis `/admin/parser-monitoring`, afficher « Météo » ;
   vérifier le même lancement, ses compteurs par **ville**, les durées,
   alertes et dates. Recharger la page : l'historique doit être conservé.
5. Relire l'API publique : les villes ayant été collectées disposent
   désormais d'un relevé ; les villes sans résultat restent visibles.
6. Simuler un fournisseur indisponible uniquement sur un environnement
   de test / sans réseau sortant : les données déjà stockées ne sont pas
   supprimées et un nouvel historique d'erreur est créé.

## 4. Rubrique publique et responsivité

Ouvrir `http://localhost:3000/fr/weather` et vérifier :

- Sélecteur 6 continents, ordre des cartes ; **3 colonnes sur écran large,
  2 sur tablette, 1 sur mobile** ; pas de débordement horizontal ;
- drapeau, ville, température en °C, icône Meteocons liée au code WMO
  et au drapeau `isDay`, description météo textuelle, ressenti,
  humidité, vent et date réelle de l'observation ;
- horloge **locale** pour Paris, Tokyo, New York et Sydney ;
  avance d'une minute sans recharger, fuseaux et heure d'été corrects ;
  l'horloge n'est **pas** un indicateur de rafraîchissement météo ;
- données périmées signalées, `UNAVAILABLE` sans donnée ;
  appel API en échec → état d'erreur et bouton « Réessayer » ;
- traductions `fr,en,de,es,pt,it,ru,nl`, navigation et header
  dans chaque langue, libellés complets sans débordement ;
- copyright MIT des Meteocons conservé en dépôt,
  attribution Open-Meteo visible ;
- choix manuel de continent conservé au rechargement et au changement
  de langue ; bouton « Revenir à la détection automatique » ;
  **en local**, cette action revient sur Europe.
  La détection Cloudflare doit rester **désactivée** sans proxy fiable.

## 5. Purge, configuration et sécurité

Avec une **base de test sauvegardée**, utiliser les écrans
`/admin/retention` et `/admin/data-purge` :

- `weatherCurrentRetentionDays` = 7 et `weatherRunRetentionDays` = 14
  par défaut (configurable, chacun indépendant) ;
- prévisualisation chiffrée puis confirmation ; en mode « all »,
  saisie exacte du nom de table et case d'acceptation ;
- `weather_city` **ne doit jamais être proposé ni accepté par API** ;
- les lignes `weather_run` de statut `RUNNING` ne sont jamais purgées ;
  les purges météo sont refusées si un parser météo tourne ;
- après vidage de `weather_current`, les villes restent publiques
  mais leurs relevés sont indisponibles jusqu'au prochain import.

Vérifier que les routes de déclenchement et de purge refusent l'accès
à un visiteur anonyme ou à un compte non ADMIN. Vérifier que les
requêtes POST de purge provenant d'un autre site sont bloquées
et qu'un jeton de prévisualisation expiré ou réutilisé est refusé.

## 6. Tests techniques et charges ciblées

Les tests exécutés à chaque PR vérifient, **sans fournisseur réel** :

- **66 villes** distribuées sur six continents, fuseaux horaires IANA,
  requête publique avec et sans observation, inactives filtrées ;
- collecte simulée 66 villes en **9 lots** de
  `8+8+8+8+8+8+8+8+2`, échec isolé dans le dernier lot,
  compteurs `65 réussies / 1 erreur` ;
- écriture SQL monotone (observation ancienne n'écrase pas la récente),
  statuts RUNNING/PARTIAL, nettoyage météo sans perdre le référentiel ;
- route Next.js : entrée continent invalidée → 400,
  backend indisponible ou réponse invalide → 503 non caché,
  taille bornée et aucune transmission des cookies privés.

Exécution automatisée :

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Le test `database/tests/scrum_79_weather_end_to_end_smoke.sql` est
exécuté par **GitHub Actions contre un PostgreSQL éphémère**, après
migration et seed ; il se termine par `ROLLBACK`.
Ce test d'intégration SQL et les mocks unitaires **ne remplacent pas**
une recette réelle Open-Meteo, ni des tests visuels manuels ou de charge
sur le futur hébergement OVH.

## 7. Conditions de clôture

- La CI doit être verte pour l'ensemble des packages.
- Les points de recette manuelle doivent être exécutés sur la base locale.
- Noter dans Jira : anomalies, captures éventuelles, latences réellement
  observées et décision de validation ou de correction.
- **Aucune planification automatique de collecte ou de purge n'est
  ajoutée ni activée à cette étape.**
