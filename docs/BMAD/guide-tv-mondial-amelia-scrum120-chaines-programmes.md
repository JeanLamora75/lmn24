# LMN24 — SCRUM-120 — Amelia / Sally / Murat — Fiches chaînes, grilles et diffusions

**Date :** 21 novembre 2026. **Jira :** [SCRUM-120](https://lmn24.atlassian.net/browse/SCRUM-120).  
**État :** développement frontend/backend publié sur `main`, **pas de GO public**, story à valider par recette intégrée.

## Livrables sur main

- `apps/frontend/src/app/[locale]/tv/channels/[channelId]/page.tsx` : fiche chaîne internationale avec logo ou avatar de remplacement, numéro national, pays, langues de diffusion, choix de variante (uniquement si plusieurs), grille J0 à J+6, mode horaire chaîne/visiteur et lien direct officiel **uniquement si fourni et validé par le backend**. Pas de stream intégré. Route et métadonnées protégées par `tvPublicEnabled()` et `notFound()` avant toute requête backend.
- `apps/frontend/src/components/tv/TvChannelDetails.tsx` : timeline accessible de diffusions réelles `tv_schedule_current`, repli honnête des trous EPG, pagination 100 éléments, fetch annulé à chaque changement, erreur/réessai, pas de lien pour les lacunes. Sélection de variante explicite, repli déterministe sur la variante par défaut ou premier code stable, conservation de l'offset J+N lors du changement de variante. L'heure de la chaîne utilise IANA de sa variante ; le mode visiteur convertit les **mêmes instants UTC** et précise la date civile locale.
- `apps/frontend/src/app/[locale]/tv/airings/[airingId]/page.tsx` : fiche de la diffusion **identifiée par ID**, titre, chaîne/pays/numéro, début/fin avec offset IANA, durée UTC, catégorie, synopsis et illustration si licites ; saison/épisode seulement s'ils existent. URL de grille correspondant à la variante et au jour civil de l'émission. Toute fiche diffusion reste **noindex même après GO**. Une diffusion supprimée de la révision courante donne un état « n'est plus disponible » sans la remplacer par une autre émission.
- `apps/frontend/src/components/tv/tv-detail-model.ts` : contrats front, textes distincts en **8 langues FR/EN/DE/ES/PT/IT/RU/NL**, calcul de journées par IANA, formatage qui distingue les doubles horaires DST avec `timeZoneName: shortOffset`, durée UTC, lacunes explicites, contrôle HTTPS des liens externes. `tv-detail.module.css` : mise en page mobile/desktop, thèmes Bootstrap clair/sombre, focus clavier visible, contrôles 44 px, timeline verticale.
- `apps/frontend/src/components/tv/TvGuideHome.tsx` (SCRUM-119) : liens réels activés vers fiche chaîne depuis la carte et vers la diffusion exacte depuis le titre de programme, **aucun lien pour les états EPG indisponibles** ; une carte Chaînes ouvre toujours **J0 du pays/variante**, même si l'accueil est à J+N.
- `apps/backend/src/tv/tv-public.service.ts` : lecture de fiche émission enrichie avec ID de chaîne, nom, numéro, pays ISO2, fuseau du pays et de la variante. Requête limitée aux révisions courantes publiées et aux sources autorisées par territoire. Champs non représentés dans le schéma candidat (`season`, `episode`) explicitement `null` plutôt que fictifs.

## Embargo et sécurité

**SCRUM-113 inchangé** : refus 404/no-store/noindex dans `apps/frontend/src/proxy.ts`, garde supplémentaire dans chaque page Next, lecture backend NestJS également verrouillée et `/api/public/tv/*` bloqué sans **deux approbations de publication distinctes**. Aucune variable activée dans le dépôt, pas de menu ni sitemap TV, aucune écriture vers la base de production. Les liens internes existent uniquement derrière la gate ; ils ne constituent pas un GO.

**Droits de sources :** aucune URL live/official ni logo non vérifié n'est fabriqué. L'API candidate retourne actuellement `officialLiveUrl:null`, `logoUrl:null`, `season:null`, `episode:null` dans les cas sans provenance ; l'interface masque les boutons/champs correspondants. Aucun lien externe non HTTPS.

## Recette Murat

- `apps/frontend/src/components/tv/tv-detail-model.test.ts` : variante par défaut/préférée/repli, décalage J+N entre variantes, DST avec double 01:30 au passage d'heure, durée 60 min réelle, lacunes sans faux ID, URLs externes protégées, huit langues.
- Tests SCRUM-118 réutilisés : filtres pays actif, source autorisée, révisions `PUBLISHED`, embargo HTTP, dates hors J0..J+6, DST 23/25 h.
- Vérifier le dernier workflow du commit `main` sur [GitHub Actions](https://github.com/JeanLamora75/lmn24/actions/workflows/ci.yml) ; ne pas déclarer sa réussite avant le résultat réel.

## Critères encore non homologués

- AC02 : description éditoriale de chaîne, provenance des liens officiels et du logo ; actuellement données non exploitables dans le schéma candidat, donc **cachées**.
- AC05 : saison/épisode par émission, faute de champs/attestations fiables dans les données ; **non inventés**.
- AC06 : navigateur réel sur 320/360/390/768/1440 px, clavier/screenreader, variantes DST avec fixtures DB PostgreSQL et mesure de performance. Tests fonctionnels de l'écran et de ses dialogues à approfondir.
- SCRUM-114 / SCRUM-116 / SCRUM-118 : migration fidèle homologuée, licences/EPG réels, preuve de couverture EPG D04/D12. En l'absence de ces validations, ne pas clôturer ni ouvrir au public.
- Retour depuis une ancienne diffusion hors horizon J0…J+6 : la fiche chaîne revient au jour courant plutôt que d'inventer une date consultable.
- Validation finale des maquettes responsive par Sally, QA par Murat, puis **GO propriétaire indépendant (SCRUM-125)**.

**Conclusion :** implémentation livrée derrière embargo, tests unitaires créés, attente d'intégration et de validation visuelle/contractuelle avant clôture.
