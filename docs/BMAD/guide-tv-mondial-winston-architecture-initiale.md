# LMN24 — Guide TV mondial — Winston — Architecture initiale
Date : 2026-11-20
Statut : DRAFT, étude engagée, ni développement ni publication autorisés
Référence : [Mary — cadrage consolidé](./guide-tv-mondial-mary-cadrage-fonctionnel.md)

## 1. État de l'existant vérifié sur main
- Monorepo : frontend Next.js, backend NestJS, PostgreSQL / Prisma.
- Country et Language existent dans packages/database/schema.prisma. Ne pas réutiliser le statut editorial Country.isActive pour le Guide TV : prévoir une activation TV spécifique.
- Les modules Sources, Feeds, Parser, Horoscopes et Statistics sont enregistrés dans le backend. Réutiliser les patterns de sécurité/import, pas leurs tables métier.
- Les fiches Source portent déjà websiteUrl, logoUrl, facebookUrl, xUrl, instagramUrl, youtubeUrl et description.
- ParserBatchRun / ParserRunEvent existent pour la journalisation ; étudier leur modèle avant de développer les imports EPG.
- La navigation PublicHeader actuelle ne contient pas Programme TV ; le sitemap est construit dans apps/frontend/src/lib/seo-sitemap.ts.
- Le paramètre TV_GUIDE_PUBLIC_ENABLED est false dans apps/frontend/src/lib/tv-guide-release.ts. Il ne protège PAS encore de futures routes publiques par lui-même.

## 2. Architecture cible recommandée
1. Module NestJS TV autonome : catalogue, pays TV, chaînes, variantes horaires, sources EPG, imports, fusion, recherche, statistiques, gestion des traductions.
2. Adaptateurs XMLTV, XMLTV gzip et JSON pour les sources autorisées, avec streaming, contrôle taille, délais, provenance, validation de schéma.
3. Modèle Prisma spécifique TV (noms provisoires) : TvCountrySetting, TvChannel, TvChannelCountry, TvChannelLanguage, TvChannelAlias, TvChannelVariant, TvEpgSource, TvEpgSourceCountry, TvProgramme, TvAiring, TvImportBatch, TvImportCountryRun, TvImportEvent, TvChannelDescriptionTranslation, TvTranslationProviderConfig.
4. Conserver les identifiants externes par source dans une table d'alias ; ne jamais fusionner deux chaînes seulement sur la ressemblance du nom. Dédupliquer les diffusions d'une variante en tenant compte des horaires et des priorités EPG.
5. Construire une grille de staging, vérifier l'intégrité, puis basculer atomiquement les données valides par périmètre. Un échec d'import ne doit pas effacer la grille publiée précédente.
6. Lacunes EPG calculées à la lecture sous forme « Programme non disponible », sans création de faux programmes en base.
7. Horaires en UTC / timestamptz avec fuseau IANA par variante ; fuseau de référence par pays pour la date. Découpage de jours et fenêtres Ce soir/2ème partie au fuseau de la diffusion, mode visiteur limité à la conversion de présentation.
8. API lecture publique paginée : pays/langues, quatre onglets, grille de chaîne/jour, fiche émission, recherche mondiale, pages SEO. Cache et index DB adaptés aux dates, chaînes et textes.
9. Purges : diffusions passées après sept jours ; journaux d'import après trente jours ; catalogues et corrections manuelles conservés.
10. Traduction : interfaces de fournisseurs configurables, uniquement gratuits et qualifiés, fournisseur actif choisi manuellement, sans gestion de quota ni basculement automatique ; prévisualisation, traduction partielle et protection des corrections humaines.

## 3. Gate de publication — blocage impératif
Le Guide TV ne pourra être visible ou accessible publiquement qu'après un GO explicite du propriétaire LMN24, indépendamment de la fin des US, des merges, de la CI ou du déploiement.
- Configuration fermée par défaut côté serveur ; aucun bouton/lien dans header, accueil, footer, préférences, sitemap.
- Les futures routes Next.js, API publiques, metadata, sitemaps et URL directes doivent refuser l'accès tant que le gate reste fermé. Le paramètre existant false ne constitue PAS à lui seul une protection serveur.
- Back-office protégé autorisé pour les tests et l'administration.
- Tests unitaires, API, intégration et navigateur démontrant qu'aucune exposition n'est possible avant le GO ; revue au même SHA publié sur main.
- Toute activation doit être une opération séparée, traçable, jamais automatique.

## 4. Risques et questions ouverts
- Droits des EPG et des descriptions/images/logos pour la republication commerciale.
- Correspondance sûre des chaînes entre plusieurs sources et variantes nationales.
- Limites d'import manuel, seuils de qualité, collisions horaires, résolutions de décalages DST/minuit.
- Mesures réelles de volume PostgreSQL, index, WAL, mémoire et temps d'import sur fichiers échantillons.
- SSRF, redirections, taille maximale et décompression XML/gzip, nettoyage des champs issus de sites externes.
- Gratuité sans carte bancaire ni facturation des API de traduction et compatibilité avec les langues LMN24.

## 5. Prochaines productions Winston
Modèle de données et migrations ; contrats d'API ; processus staging/fusion/validation ; stratégie de test et de sécurité ; dimensionnement après validation des échantillons ; intégration du gate avec l'ensemble des routes et du SEO. Revue avec Sally/Murat avant la découpe John en US.
