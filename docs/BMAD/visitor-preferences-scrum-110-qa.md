# SCRUM-110 — Revue qualité et recette transverse des préférences visiteur

Date de cadrage : 2026-11-16. Epic : [SCRUM-102](https://lmn24.atlassian.net/browse/SCRUM-102).
Statut : **développée, qualification d'exécution à confirmer**. Ce document ne prétend pas à des résultats de tests non observés.

## Périmètre audité

- SCRUM-103 : stockage local v1, validation Zod, migrations, brouillon transactionnel, erreurs de stockage, changements entre onglets.
- SCRUM-104 / 105 : header public, ouverture volontaire, modale et focus, 8 traductions, Annuler/Enregistrer/réinitialisation individuelle/globale, date facultative.
- SCRUM-106 : clair, sombre, système, pré-affichage et Bootstrap/data-bs-theme, pas de changement sans sauvegarde.
- SCRUM-107 : pays ISO et géocodage mondial Open-Meteo, validation et timeout de la route, désambiguïsation de ville, saisie clavier.
- SCRUM-108 : continent favori temporaire, déduplication géographique des villes administrées, API météo externe et fallback, 8 langues.
- SCRUM-109 : calcul local du signe, 12 cartes publiques, SEO identique, aucun signe dérivé dans localStorage.

## Corrections SCRUM-110 sur main

1. L'autocomplete `VisitorCitySearch` accepte désormais Flèche bas/haut, Entrée et Échap (qui ferme les suggestions sans fermer la modale), expose l'option active via `aria-activedescendant`, et garde les résultats indépendants des brouillons.
2. Cibles tactiles de réinitialisation et du thème adaptées à au moins 44 px dans la modale.
3. `apps/frontend/playwright.config.ts` démarre un véritable serveur Next.js en mode recette ; nouvelle suite `e2e/visitor-preferences-qa.pw.ts`.
4. Le workflow `.github/workflows/ci.yml` déclenche un job Chromium **desktop et mobile**, après les vérifications TypeScript/Lint/Unit/Build, en enregistrant les traces en cas d'échec.
5. Documentation publique et matrice de vérification actualisées.

## Matrice d'acceptation

| Famille | Scénarios automatisés / preuve attendue | Résultat vérifié |
| --- | --- | --- |
| 8 langues | En-tête, dialog, badge horoscope (suite SCRUM-110) | Tests écrits ; exécution à confirmer |
| Mobile 320 px | Ouverture clavier, autocomplete, absence de débordement | Tests écrits ; exécution à confirmer |
| Clavier et focus | Ouverture Entrée, options Flèches/Entrée, fermeture Échap, restitution focus | Tests écrits ; exécution à confirmer |
| LocalStorage interdit | Site accessible ; sauvegarde refusée avec message, sans faux succès | Tests écrits ; exécution à confirmer |
| Multi-onglets | Le conflit empêche d'écraser silencieusement un brouillon actif | Tests écrits ; exécution à confirmer |
| Réinitialisation | Préserve cookies et autres clés locales, efface seulement les préférences | Tests écrits ; exécution à confirmer |
| Données incorrectes | Schéma futur/invalide ignoré sans régression de navigation | Tests écrits ; exécution à confirmer |
| Confidentialité naissance | Aucune date complète dans URL ou corps réseau observé par navigateur | Tests écrits ; exécution à confirmer |
| SSR/SEO | 12 liens horoscope, canonical, 8 hreflang, thème et préférences côté client | Tests écrits ; exécution à confirmer |
| Thème sombre | Contraste texte/carte >= 4,5 dans le test automatisé | Tests écrits ; exécution à confirmer |
| Météo favorite | Ville existante/externe, non-doublon, continent manuel, erreur météo | Tests écrits dans SCRUM-108 ; exécution à confirmer |
| API de géocodage | Pays, quotas remontés, validations et privacy | Tests écrits dans SCRUM-107 ; exécution à confirmer |
| Base PostgreSQL | Aucun ajout/migration ou écriture liée aux préférences | Revue du code ; test réel DB non exécuté |
| Performance | Lighthouse/Web Vitals, absence de flash significatif, budget performance | Contrôle manuel et mesures à effectuer |
| Fournisseur | Licence et quotas Open-Meteo Geocoding et Forecast applicables à LMN24 | **Bloquant : vérification externe non autorisée à ce stade** |
| Protection anti-abus | Limitation serveur indépendante du debounce client, sur plusieurs instances | **À qualifier** |
| CSP production | Autorisation sécurisée du script de thème en tête de document | **À qualifier sur le déploiement** |

## Procédure de qualification finale

1. Sur le dernier SHA de `main`, vérifier les jobs `Quality checks`, `Visitor preferences browser acceptance (SCRUM-110)`, et les autres jobs CI existants.
2. Vérifier les artefacts Playwright sur échec et corriger jusqu'au vert **sur un même SHA**. Les tests ne doivent pas simplement être ajoutés ; ils doivent s'exécuter.
3. Réaliser la revue navigateur manuelle des huit langues en clair/sombre (mobile 320 px et desktop), contrastes, ordre de tabulation, responsive et états d'erreur.
4. Vérifier la conformité des contrats Open-Meteo et du traitement des requêtes, l'attribution et le rate-limit infrastructural. Une recherche web publique nécessite un accord distinct de l'utilisateur.
5. Mettre à jour Jira, les documents BMAD et ce rapport avec les URL des runs GitHub, le SHA exact, les résultats et les risques résiduels. **Ne pas déclarer Epic SCRUM-102 terminée avant ces preuves.**

## Références de vérification

- [Actions GitHub](https://github.com/JeanLamora75/lmn24/actions)
- [Code et scripts de recette](https://github.com/JeanLamora75/lmn24/tree/main/apps/frontend/e2e)
- [Architecture Winston](https://github.com/JeanLamora75/lmn24/blob/main/docs/BMAD/visitor-preferences-winston-architecture.md)
- [Étude UX Sally](https://github.com/JeanLamora75/lmn24/blob/main/docs/BMAD/visitor-preferences-sally-ux.md)
