# SCRUM-119 — Amelia / Sally / Murat — Accueil responsive du Guide TV

**Date :** 2026-11-21. **Jira :** [SCRUM-119](https://lmn24.atlassian.net/browse/SCRUM-119).  
**Statut :** interface implémentée sur `main`, **embargo strict avant GO**. Maquette de référence : [SCRUM-127](./guide-tv-mondial-sally-scrum127-maquettes-v1.md) et [UX-01](./guide-tv-mondial-sally-ux01-accueil-responsive.md).

## Code livré

- `apps/frontend/src/app/[locale]/tv/page.tsx` : route internationale dans la coque publique LMN24. Contrôle serveur des **deux autorisations explicites** `TV_PUBLIC_ENABLED` et `TV_PUBLIC_RELEASE_APPROVED`, avec `notFound()` avant rendu, metadata `noindex` et sans entrée de menu/sitemap. Le middleware `proxy.ts` SCRUM-113 demeure la première barrière et protège aussi les préfixes non localisés.
- `apps/frontend/src/app/api/public/tv/[...path]/route.ts` : proxy serveur GET vers le NestJS interne, liste fermée des cinq ressources publiques, refus 404/no-store/noindex sans autorisation, pas de cookie utilisateur transmis, recherche/corps et longueur bornés, erreurs génériques. **Pas de route écriture**. Deuxième garde NestJS SCRUM-113 toujours actif, avant tout contrôleur.
- `components/tv/TvGuideHome.tsx` : recherche mondiale présentée comme avant-goût de SCRUM-121 (message explicite, aucun résultat fabriqué), sélection des pays, langue de diffusion (séparée de la locale UI), mode heure chaîne/visiteur (conversion d'affichage uniquement), date centrée J0..J+6 avec emplacement fixe de 44 px des flèches et retour NOW→TONIGHT, quatre onglets fixes et Ce soir initial ; requêtes annulées à la navigation, messages d'erreur et réessai, pagination, cartes actives même sans EPG.
- `components/tv/tv-guide-model.ts` : copies des **huit locales FR/EN/DE/ES/PT/IT/RU/NL**, préférence explicite issue du profil visiteur LMN24 si pays TV actif, puis pays de la locale, puis premier ISO2 actif ; **aucun enregistrement du fallback**. Calcul J0 en IANA pays et horodatage de l'affichage en IANA variante/visiteur, sans aucune interprétation géographique IP.
- `components/tv/tv-guide.module.css` : carte horizontale à identité/numéro à gauche, horaire+titre+catégorie/durée au centre, image/fallback neutre à droite, thème Bootstrap dark/light, grille 2 colonnes desktop et mono-colonne tablette/mobile, compact 320–390 px, focus visible et boutons tactiles >=44 px.
- `apps/backend/src/tv/tv-public.service.ts` : ajout des langues de diffusion dans chaque entrée de grille afin que le filtrage frontend reste vrai ; les programmes ne sont pas traduits automatiquement ni changés lors d'un choix de langue UI.

## Règles et limites honnêtes

1. En l'absence d'airing authentique, afficher `Programme non disponible` ; `Aucun programme débutant` **seulement** si l'API renvoie `NO_START_IN_WINDOW` sur attestation fiable (SCRUM-118 attend ce stockage). Aucune émission simulée et aucun faux lien de fiche émission.
2. Les détails chaîne/émission, leur navigation et la recherche mondiale dépendent de **SCRUM-120 et SCRUM-121** ; l'accueil ne pointe pas vers des pages inexistantes. Les actions non disponibles restent descriptives.
3. Logos et visuels ne s'affichent que si la réponse API fournit une URL HTTPS autorisée ; fallback neutre sinon. Les illustrations locales détaillées par catégorie restent un raffinement Sally à vérifier avant DoD strict AC04.
4. La liste des langues proposée est la liste supportée par l'interface ; le filtrage se fait sur les `broadcastLanguages` des chaînes, pas sur les traductions de textes.
5. En cas d'erreur HTTP, affichage d'un message honnête, avec dernière grille maintenue si son pays/date/onglet correspondent encore. Changer de pays annule l'ancien périmètre.

## Tests et preuves

- `tv-guide-model.test.ts` : ordre des quatre onglets, huit locales, fallback pays, calendrier J0..J+6, déplacement depuis NOW, langue de diffusion et simple formatage d'heure.
- Contrôles backend issus de SCRUM-118 : programmes publiés, droits source/pays, fenêtres UTC/DST et états `EPG_UNAVAILABLE`. Aucun mock frontend ne constitue une preuve d'accès public.
- CI générale : https://github.com/JeanLamora75/lmn24/actions/workflows/ci.yml ; n'affirmer le succès sur un SHA précis qu'après vérification du run terminé. **La recette visuelle Playwright 320/360/390/768/1440 px, navigation clavier/lecteurs d'écran et la validation des huit locales sur vrai rendu ne sont pas encore prouvées par les seuls tests unitaires**.

## DoD / non-clôture

**La story ne peut être déclarée clôturée avant :** recette responsive réelle en navigateur aux cinq résolutions, navigation clavier et lecteur d'écran ; raccordement des fiches SCRUM-120 et recherche SCRUM-121 ; finale de la provenance des assets/attestation de couverture (SCRUM-118), intégration sur copie fidèle homologuée (SCRUM-114), et **GO explicite distinct** pour la mise en ligne (SCRUM-125).

Le développement frontend est **livré derrière la porte de sécurité** : aucune activation, aucune migration, aucune exposition publique du Guide TV.
