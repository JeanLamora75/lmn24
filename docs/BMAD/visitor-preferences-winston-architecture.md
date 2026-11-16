# Winston — Architecture des préférences visiteur

# LMN24 — Préférences visiteur (cadrage approuvé 2026-11-16)

Statut : spécification validée métier, à développer. Source : cadrage Mary / étude Winston et Sally. Périmètre : site public, 8 locales (fr,en,de,es,pt,it,ru,nl). Le code existant n'est pas modifié par ce document.

## Décisions métier impératives
- Aucun compte, aucune écriture des préférences personnelles en PostgreSQL, table Setting, logs, analytics ou backend.
- Stockage local du navigateur uniquement (localStorage, JSON versionné) ; aucune sollicitation automatique lors de la première visite.
- Icône Paramètres dans le header public ouvrant la modale « Mes préférences ».
- Modifications en brouillon ; Enregistrer applique et persiste, Annuler / fermeture / Échap jettent le brouillon.
- Réinitialisation individuelle et globale ; individuelle soumise à Enregistrer, globale avec confirmation, sans toucher aux données étrangères aux préférences.
- Thème clair/sombre/automatique ; pays ISO, recherche mondiale de ville par pays, date de naissance complète facultative et signe occidental calculé localement.
- Langue de l'URL / cookie next-intl indépendante du pays ; filtre ponctuel de météo ou signe ne change jamais les préférences.
- Si aucune préférence : comportement existant du site. Ordre personnalisé des catégories réservé à une évolution ultérieure ; format de stockage extensible.
- Ville favorite : ouvrir la météo sur son continent. Sur CE continent uniquement, mettre sa carte en première position, surlignée (« Ma ville ») ; si ville déjà administrée, déplacer sa carte sans doublon ; sinon récupérer ponctuellement ses données par API météo. Navigation manuelle vers d'autres continents autorisée pendant la consultation. Au retour à la rubrique, re-sélectionner le continent favori. Ne jamais créer de WeatherCity pour une ville favorite.

## Références vérifiées sur main
- apps/frontend/src/components/public/PublicHeader.tsx ; PublicHeader.module.css
- apps/frontend/src/app/[locale]/layout.tsx
- apps/frontend/src/components/weather/PublicWeather.tsx ; weather-region-choice.ts ; weather-data.ts
- apps/frontend/src/app/[locale]/weather/page.tsx ; app/api/public/weather/route.ts
- apps/frontend/src/app/[locale]/horoscope/page.tsx ; horoscope/[sign]/page.tsx
- apps/frontend/src/i18n/routing.ts

## Conception cible
- Service typé central et Provider/hooks React dans le layout public, sans coupler les préférences aux pages administratives.
- Clé de stockage dédiée (proposition : lmn24.visitorPreferences), objet versionné avec migrations contrôlées, valeurs validées strictement à la lecture (Zod), nettoyage des données invalides sans bloquer le site.
- Contenu cible : version, theme ('light'|'dark'|'system'), countryIso2 (nullable), city (nullable : identifiant géocodeur, nom, région, code pays, code continent, lat/lon et fuseau si disponible), birthDate (nullable ISO YYYY-MM-DD). Ne pas stocker le signe dérivé ni envoyer la date à une API.
- Édition transactionnelle : copie en mémoire, validation, une seule écriture localStorage lors d'Enregistrer ; reset d'un champ modifie seulement le brouillon. Gestion des erreurs/quota/private mode avec message et comportement non persistant.
- Synchronisation entre onglets via événement storage, sans écraser un brouillon non enregistré sans avertissement.
- SSR/hydratation : rendu public générique et SEO stable ; ne pas lire localStorage côté serveur ; stratégie anticlinotement de thème évaluée (script client minimal / attribut data-bs-theme pré-hydratation). Respecter prefers-color-scheme et prefers-reduced-motion.
- Le header public est déjà un Client Component avec zone de choix de langue. Insérer l'icône paramètres près de cette zone en respectant le grid responsive et les tests existants.

## Recherche de ville et météo
- Géocodeur international à qualifier : pays filtrant, recherche asynchrone avec debounce, AbortController, protection contre erreurs/rate limit, résultats homonymes correctement identifiés, quotas/licence/confidentialité vérifiés. Fournisseur d'implémentation SCRUM-107 : Open-Meteo Geocoding API, via une route proxy Next.js ; qualification définitive des conditions d'utilisation, quotas et caractère gratuit/commercial à confirmer avant clôture/déploiement (aucune recherche web externe autorisée à ce stade).
- La ville mondiale n'est pas une entrée WeatherCity. Ne pas écrire de ville ou de résultat météo dans PostgreSQL pour les préférences individuelles.
- Chaîne de décision à l'ouverture /weather : ville favorite valide -> continent de la ville ; sinon comportement SSR existant (cookie lmn24_weather_continent, GeoIP de confiance, puis EU). Le cookie legacy ne doit pas supplanter la favorite. Un changement manuel reste temporaire pour la consultation.
- Vérifier si la favorite figure parmi les cartes du continent par identifiant fiable si disponible, sinon correspondance normalisée prudente (pays + nom + proximité). Jamais dédupliquer sur le seul nom ou coordonnées approximatives.
- Si ville présente : réordonner l'array pour placer la carte en tête et la marquer. Si absente : requête géolocalisée dédiée (lat/lon) vers Open-Meteo via proxy API public sécurisé, validation/schéma météo homogène, carte en tête réutilisant WeatherCard. Fallback aux cartes normales si échec, avec message non bloquant. Ne pas propager de date de naissance ou d'autres préférences dans la requête.
- Le proxy existant /api/public/weather n'accepte que continent : ajouter une route dédiée ou contrat versionné ; pas de contournement de la validation existante. Limites, cache court sans données utilisateur, protection contre abus, erreurs et timeout.
- Un géocodeur ne garantit pas à lui seul la disponibilité des données météo : distinguer recherches ville et données météo. Vérifier attribution et conditions Open-Meteo.

## Horoscope / thème / i18n
- Calcul local signe à partir du jour/mois avec validation des dates et cas limites ; sur la page /horoscope, mettre le signe favori en avant sans cacher les 11 autres ; URL /horoscope/[sign] inchangée et toujours consultable.
- Thème Bootstrap via data-bs-theme et variables/tokens ; audit indispensable des couleurs hardcodées CSS public (PublicHeader.module.css et globals.css) et contraste WCAG.
- Pays n'implique aucune modification automatique de langue ; conserver next-intl, les liens SEO/canonical/hreflang/SSR actuels.

## Tests et conditions de livraison
- Unitaires : version/migration/validation, mode brouillon, reset, priorités météo, correspondance ville, calcul signe, changement d'onglet, stockage indisponible.
- Intégration API : timeout/erreurs, 0 résultat, quotas, entrée malveillante, lat/lon extrêmes, absence d'écriture DB, doublons.
- Playwright desktop/mobile 8 locales : header, clavier/focus/Échap, thème sans flash notable, géocodage, ville existante/inexistante, continent temporaire, SEO/hydratation, confidentialité.
- Ne pas modifier les parcours d'administration du catalogue WeatherCity. Aucune migration Prisma liée au stockage de préférences.

## Décisions techniques encore ouvertes
Conditions d'utilisation et limites de l'API Open-Meteo Geocoding (fournisseur choisi provisoirement pour SCRUM-107), modalités API météo personnalisée et politique de cache/quotas, seuil de correspondance entre villes, contrôle visuel du thème initial. À trancher en implémentation avec tests et validation documentaire avant livraison.

## SCRUM-107 — Implémentation de la recherche de ville (2026-11-16)

- Endpoint public `GET /api/public/visitor-cities?country=FR&name=Paris&locale=fr`, validé strictement par Zod, sans entrée/sortie PostgreSQL. Le frontend ne transmet que pays ISO2, texte saisi volontairement et locale. Aucun profil, date de naissance, compte ou cookie n'est envoyé en paramètre de géocodage.
- Backend Next.js Route Handler : proxy vers `https://geocoding-api.open-meteo.com/v1/search` avec `name`, `countryCode`, `language`, `count=10`, `format=json`. Délai maximal 6 s, réponse sans cache, 400/429/502/503, pas de clé API dans le navigateur.
- Sortie filtrée/validée : `provider: open-meteo-geocoding`, `providerId`, `name`, `region`, `countryIso2`, `continent`, `latitude`, `longitude`, `timezone`. Pas de persistance des recherches serveur.
- Conversion pays-continent dans `src/lib/visitor-geocoding.ts` : Europe, Asie, Afrique, Amérique du Nord (Caraïbes/Amérique centrale), Amérique du Sud, Océanie ; estimation géographique particulière RU/TR/KZ selon les coordonnées ; les territoires non cartographiés sont omis pour éviter de stocker un continent faux.
- Autocomplete `VisitorCitySearch` : délai 350 ms, AbortController, protection anti-résultats obsolètes, message d'absence de résultat, erreur/429, sélection explicite. Le changement de pays nettoie la ville du brouillon.
- Les suggestions restent des données éphémères en mémoire React ; la ville choisie est stockée uniquement lorsque l'utilisateur clique Enregistrer. La météo personnalisée sera implémentée dans SCRUM-108.
- **Condition de qualification technique non encore levée** : vérifier officiellement les conditions de service Open-Meteo (usage du site LMN24, éventuelle activité commerciale, attribution, quotas, géocodage gratuit). Ne pas annoncer la conformité commerciale ou un quota garanti sans cette vérification.
- Protéger l'API proxy des usages abusifs en production par règles d'infrastructure/gateway (ratelimiting en amont à qualifier) ; la limitation UI/debounce et le relais 429 ne constituent pas seuls une protection serveur exhaustive.

## SCRUM-108 — Ville favorite dans la météo (2026-11-16)

- Le composant public `PublicWeather` utilise uniquement la ville sauvegardée dans le `VisitorPreferencesProvider` ; l'état brouillon n'a aucun effet. À chaque ouverture, la ville favorite prévaut sur le cookie météo legacy/GeoIP côté client ; les changements manuels de continent restent temporaires et ne modifient pas le cookie si une favorite existe.
- La météo habituelle par continent reste chargée par le backend/public proxy existant. La grille affiche la carte favorite en premier sur **son continent exclusivement**, avec un contour et un badge traduits dans les huit langues ; les autres continents restent inchangés.
- **Déduplication fiable** : le catalogue WeatherCity possède déjà `latitude`/`longitude` en base. Le service Nest `PublicWeatherService` les expose maintenant dans son DTO public, en lecture seule. La correspondance exige pays ISO, continent, nom normalisé, coordonnées distantes de 25 km maximum et match unique. En cas d'ambiguïté, ne jamais supprimer une carte existante par supposition : récupérer une carte personnalisée.
- Pour une ville extérieure au catalogue, `POST /api/public/visitor-weather` (route Next.js) reçoit seulement les coordonnées/identifiants géographiques de la ville. Validation stricte Zod, taille de corps bornée, timeout 6,5 s, gestion HTTP 429/503 ; Open-Meteo `/v1/forecast` avec variables actuelles et `timeformat=unixtime`. Le format est normalisé en DTO `WeatherCity` commun, sans création de ligne PostgreSQL, sans collecte de date de naissance, sans modification de l'API du catalogue.
- Les appels externes sont uniquement déclenchés si la ville favorite est sur le continent sélectionné et qu'aucune carte correspondante n'existe. Erreurs de récupération de ville favorite : les cartes de catalogue restent consultables, message discret et bouton Réessayer. Une navigation hors continent annule le chargement en cours.
- Le rendu SSR ne connaît pas localStorage : le continent favori s'applique après hydratation. Une première vue SSR d'un autre continent reste possible pendant la transition ; ne pas prétendre que la sélection est pré-rendue par serveur.
- Quotas, licences et autorisation commerciale d'Open-Meteo restent à vérifier officiellement avant qualification finale ; pas de recherche publique sans confirmation utilisateur. La route est bornée mais un *rate limit* infrastructural robuste multi-instance reste nécessaire avant exposition large.
- Tests ajoutés : correspondance et non-doublon, proxys météo validés et hors service, navigation continent / retour, affichage mobile et huit traductions de badge, compatibilité avec le contrat public backend. Le vert CI/Playwright reste à confirmer.

## SCRUM-109 — Personnalisation de l'horoscope (2026-11-16)

- `src/lib/visitor-zodiac.ts` calcule le signe occidental tropical conventionnel en mémoire à partir du mois et du jour de la date de naissance ISO validée (année utilisée seulement pour valider le calendrier, notamment les 29 février). La fonction ne contacte aucun service et ne persiste pas de signe dérivé.
- La grille des douze signes est isolée dans `src/components/horoscope/VisitorHoroscopeGrid.tsx`, un composant client hydraté au sein de la page serveur `app/[locale]/horoscope/page.tsx`. Au rendu serveur et sans préférence, les douze cartes restent neutres. Après hydratation, seule la carte correspondant à une date de naissance sauvegardée reçoit un badge et un contour accessibles en clair/sombre ; aucun signe n'est masqué.
- La page garde sa génération de métadonnées, ses URL de collection et ses données structurées. Aucun changement de l'URL `/horoscope/[sign]`, ni redirection vers le signe favori : les autres signes demeurent consultables sans modifier la préférence.
- La modale `VisitorPreferencesDialog` affiche désormais un aperçu traduit du signe à partir du **brouillon**, sans écrire la date ni le signe avant clic sur Enregistrer. Annuler, réinitialiser ou effacer la naissance met à jour l'affichage sans requête réseau.
- Internationalisation des labels « Mon signe » et des aperçus dans les huit langues FR/EN/DE/ES/PT/IT/RU/NL.
- Tests ajoutés : dates limites des 12 signes, dates invalides et bissextiles ; conservation des 12 cartes et changement de signe sans écriture ; suppression de la préférence, traductions, absence de transmission de la date dans les requêtes réseau.
- **Qualification restante** : exécuter Vitest, typecheck, ESLint et parcours Playwright sur un même commit puis confirmer une CI verte. L'illustration des signes repose sur les plages conventionnelles déjà affichées sur LMN24 ; pas sur une détermination astronomique personnalisée par heure/lieu de naissance.
