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

### 3.1. Recette de production OVH — sécurité et collecte (retour du 17/10/2026)

Cette recette complémentaire a été ajoutée après deux incidents distincts rencontrés sur OVH :

1. **HTTP 403 « Origine non autorisée »** lors du lancement du parser par l'administration ; corrigé par [PR #57](https://github.com/JeanLamora75/lmn24/pull/57) en prenant en compte une origine publique explicitement autorisée derrière le reverse proxy, sans supprimer le contrôle anti-CSRF.
2. **HTTP 503 et connection timeout** pour les lots Open-Meteo ; corrigés par [PR #58](https://github.com/JeanLamora75/lmn24/pull/58), qui allonge les délais, borne les tentatives, respecte `Retry-After` et améliore les diagnostics.

**Prérequis de l'environnement de production** : les correctifs sont déployés et `WEATHER_ADMIN_PUBLIC_ORIGIN=https://www.lmn24.com` est présent dans le `.env` **non versionné** du VPS. Ne jamais copier le fichier `.env` ni les cookies de session dans une preuve de recette.

#### Contrôle des origines et de l'authentification (sans lancer la collecte)

Depuis un terminal, exécuter le POST **sans cookie** ci-dessous : le code attendu est **401** (contrôle d'origine validé, session absente), et **pas 403**.

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST https://www.lmn24.com/api/admin/parser/weather-runs \
  -H "Origin: https://www.lmn24.com" \
  -H "Sec-Fetch-Site: same-origin" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Une origine étrangère doit au contraire produire **403**, toujours sans cookie :

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST https://www.lmn24.com/api/admin/parser/weather-runs \
  -H "Origin: https://site-tiers.example" \
  -H "Sec-Fetch-Site: cross-site" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Ces tests **ne peuvent pas lancer la collecte** sans session valide. Ensuite, dans l'administration, vérifier avec un compte ADMIN que le lancement manuel sur un continent démarre et que les compteurs et l'historique se mettent à jour.

#### Contrôle réel d'Open-Meteo

- Depuis le VPS, comparer **ponctuellement** un appel `curl -4` pour une ville et un lot de huit villes ; vérifier la réponse HTTP et les paramètres exacts de l'URL utilisée. Un appel isolé **200** ne prouve pas que toutes les collectes fonctionneront.
- Pour lever un doute lié au client HTTP, tester la même URL avec `node --dns-result-order=ipv4first` et `fetch` ; vérifier les journaux `journalctl -u lmn24-parser -n 150 --no-pager`.
- Si la collecte échoue : distinguer une erreur du **fournisseur** (`Open-Meteo HTTP 503`), un **timeout réseau**, et une erreur **503 de l'API publique LMN24** (contexte distinct).
- Ne pas répéter les requêtes en boucle pour tester les quotas ; ne pas forcer une collecte en parallèle d'un traitement déjà actif.
- Confirmer qu'un lot en échec conserve les derniers relevés valides et que la rubrique affiche correctement les données périmées ou indisponibles.

**Résultat historique :** après déploiement des PR #57 et #58, le fonctionnement du parser Météo sur OVH a été **confirmé par l'utilisateur**. Ce retour valide le sous-parcours concerné, **pas l'intégralité** des contrôles de cette recette (66 villes, six continents, huit langues, responsive, purge et performance). Voir [SCRUM-71](https://lmn24.atlassian.net/browse/SCRUM-71), [SCRUM-72](https://lmn24.atlassian.net/browse/SCRUM-72) et [SCRUM-79](https://lmn24.atlassian.net/browse/SCRUM-79). Procédures détaillées : [DEPLOY_OVH_MANUAL.md](DEPLOY_OVH_MANUAL.md).

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
  taille bornée et aucune transmission des cookies privés ;
- contrôle d'origine côté administration : origine publique configurée acceptée derrière le reverse proxy, origine tierce ou en-têtes suspects rejetés ;
- client Open-Meteo : **15 secondes par tentative, trois tentatives maximum**, attente progressive **1,5 s puis 4 s**, prise en compte bornée de `Retry-After`, distinction des HTTP 503, timeouts, HTTP 400 et 429 ; non-régression sur les relevés précédents.

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
- Les points de recette manuelle doivent être exécutés sur la base locale ; les contrôles réseau et de reverse proxy doivent également être vérifiés sur l'hébergement réel.
- Le lancement et la collecte sur OVH ont été confirmés après les PR #57/#58 ; **ne pas en déduire que tous les critères de SCRUM-79 sont automatiquement validés**.
- Noter dans Jira : anomalies, captures éventuelles, latences réellement
  observées et décision de validation ou de correction.
- **Aucune planification automatique de collecte ou de purge n'est
  ajoutée ni activée à cette étape.**
