# LMN24 — Biorythmes dans la rubrique Horoscope
## Étude d'architecture BMAD — Winston
Date : 2026-11-16
Statut : cadrage validé pour rédaction de User Story ; aucun développement demandé dans cette étape.

## Décision fonctionnelle
- Ne pas ajouter de menu principal « Biorythmes ».
- Ajouter, sur l'index public `/{locale}/horoscope`, **au-dessus de la grille des douze signes**, un encart/lien explicite « Découvrez vos biorythmes », avec une courte description et une action accessible au clavier.
- Le lien ouvre `/{locale}/horoscope/biorythmes` (par exemple `/fr/horoscope/biorythmes`) dans la même navigation. Retour évident vers l'index Horoscope.
- Garder les douze cartes de signes, les URLs des horoscopes individuels, le comportement de la date de naissance sauvegardée et le SEO existant.
- Présenter les biorythmes comme un **divertissement**, jamais comme un outil de diagnostic, de prévention, de santé ou de prédiction fiable.

## Conception mathématique
Trois cycles sinusoïdaux traditionnels à tracer, en pourcentage [-100 ; +100] :
- physique : période 23 jours ;
- émotionnel : période 28 jours ;
- intellectuel : période 33 jours.

Pour chaque période `P`, calculer `B_P(t) = 100 × sin(2π × t / P)`, où `t` est la différence en **jours calendaires entiers** entre la date de naissance et la date consultée. Ne pas utiliser de durées en heures locales : calcul en jours UTC `Date.UTC(y,m-1,d)` pour résister aux changements d'heure et aux fuseaux. Les cycles sont des fonctions mathématiques conventionnelles, sans validité scientifique démontrée comme mesure des capacités ou de l'humeur.

Le graphique affiche par défaut une fenêtre de 31 points (J-15 à J+15) centrée sur la date du jour de consultation. Navigation de 15 jours vers le passé/futur ; affichage des trois valeurs au jour central ; activation/désactivation indépendante des courbes ; axes, légende et indication visible du jour ciblé. L'interactivité ne doit pas dépendre de la couleur seule ; proposer des libellés/textes accessibles.

## Vie privée et comportement des préférences
- Lire après hydratation `preferences.birthDate` à travers `VisitorPreferencesProvider` existant : **uniquement la valeur enregistrée**, jamais le brouillon non sauvegardé.
- Si la naissance est absente ou invalide, afficher un champ date facultatif sur la page et un état explicatif, sans erreur de rendu.
- Autoriser la saisie d'une **date temporaire** dans le module, sans écriture automatique en localStorage ou en base. La saisie temporaire ne modifie ni le thème, ni le pays, ni la ville, ni la date enregistrée dans les préférences. À la réouverture de la rubrique, retrouver la date enregistrée, ou un état vide si elle n'existe pas. Un éventuel enregistrement se fait exclusivement via « Mes préférences » et le bouton Enregistrer déjà prévu dans cette modale.
- La date de naissance ne doit apparaître dans aucun URL, cookie, appel serveur, événement analytique, log, ni propriété de SEO. Aucun stockage PostgreSQL, aucune migration, aucun fournisseur IA ni API externe. Le calcul est 100 % navigateur.
- Pour éviter des résultats inversés ou des dates incohérentes, valider ISO YYYY-MM-DD de manière stricte (calendrier réel, années bissextiles, pas de date future, règle des dates anciennes alignée sur `visitor-preferences.ts`).

## Intégration Next.js / SEO
- Index existant : `apps/frontend/src/app/[locale]/horoscope/page.tsx` ; ajouter l'encart traduit sans déplacer ni altérer `VisitorHoroscopeGrid`.
- Créer une route statique dédiée `apps/frontend/src/app/[locale]/horoscope/biorythmes/page.tsx` ; **une route statique a priorité sur** `[sign]` dans Next.js, mais le segment réservé doit être testé explicitement afin qu'il ne soit pas traité comme un signe inconnu et renvoyé en 404.
- Serveur : métadonnées descriptives non personnalisées avec canonical et hreflang pour les huit langues `fr,en,de,es,pt,it,ru,nl`. Page serveur stable avec visualisation client séparée ; ne pas rendre en SSR la date personnelle. Réutiliser les composants de navigation et styles publics existants.
- Composants proposés : `src/lib/biorhythms.ts` (fonctions pures), `src/components/horoscope/BiorhythmChart.tsx` (Client Component), traductions dédiées ou approche next-intl cohérente ; dimensions/contraste adaptés aux modes clair/sombre et au mobile.
- Ne pas introduire une librairie graphique si un SVG React accessible suffit ; pas de graphique externe ni de chargement réseau pour la génération.

## Critères techniques de livraison
1. Encart/lien au-dessus des douze signes, cliquable depuis les huit langues, clavier et tactile ; aucun nouveau sous-menu.
2. Route localisée dédiée, liens retour, canonical et hreflang corrects ; les douze signes et leurs URL restent inchangés.
3. Sans naissance sauvegardée : saisie temporaire non persistante ; avec naissance sauvegardée : préremplissage après hydratation ; changement temporaire non sauvegardé.
4. Trois courbes mathématiques exactes sur 31 jours, valeurs jour central, visibilité par courbe, déplacement de fenêtre ±15 jours, dates cohérentes en UTC.
5. Accessibilité (libellés, contrastes clair/sombre, clavier, description textuelle du graphique, responsive 320 px, prefers-reduced-motion).
6. Explication explicite « divertissement, sans preuve de valeur prédictive ou médicale » dans toutes les langues.
7. Zéro requête / écriture DB / API pour le calcul et zéro fuite de date dans les URLs, les métadonnées et les requêtes réseau.
8. Tests unitaires des cycles (jour de naissance = 0, quart/demi période, changement d'année, 29 février, DST, dates invalides) et Playwright desktop/mobile huit langues ; vérification de non-régression des routes horoscope.
9. Même commit `main` avec Typecheck/Lint/Tests/Build et CI Playwright verts ; mise à jour de l'aide/documentation publique si nécessaire.

## Arbitrages et limites
- Cycles conventionnels ; ne pas ajouter de quatrième cycle sans demande métier.
- Fenêtre initiale de 31 jours, navigation ±15 jours : proposition technique validée en cadrage de principe, réglable par la User Story si nécessaire.
- Aucune recherche web sur la valeur scientifique des biorythmes n'a été lancée ; l'avertissement de divertissement est une exigence de présentation et non une allégation de validation médicale.

Références internes :
- `docs/BMAD/visitor-preferences-winston-architecture.md`
- `docs/BMAD/visitor-preferences-sally-ux.md`
- `apps/frontend/src/app/[locale]/horoscope/page.tsx`
- `apps/frontend/src/app/[locale]/horoscope/[sign]/page.tsx`
- `apps/frontend/src/lib/visitor-preferences.ts`

## Traçabilité Jira
- John — User Story [SCRUM-111](https://lmn24.atlassian.net/browse/SCRUM-111), créée le 16 novembre 2026, reprend ce cadrage et les 10 critères d'acceptation.
- Aucun code applicatif n'est modifié par ce cadrage et cette rédaction Jira.
