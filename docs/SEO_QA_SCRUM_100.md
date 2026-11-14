# SCRUM-100 — Recette SEO automatisée LMN24

## Ce qui est automatiquement couvert avant publication

La CI GitHub Actions `ci.yml` impose `pnpm test`, puis une étape dédiée :

```bash
pnpm --filter @lmn24/frontend exec vitest run src/lib/seo-regression.test.ts src/app/sitemap-routes.test.ts src/lib/seo-metadata.test.ts src/lib/seo-schema.test.ts src/lib/seo-social.test.ts
```

Les tests comportementaux contrôlent les réponses HTTP des routes Next.js (sitemap, shards, indisponibilité backend et paramètres invalides), l'absence d'URLs privées, les huit langues, les variantes réciproques, les canoniques absolues, les descriptions Open Graph/Twitter, le graphe Schema.org et la sérialisation anti-injection. Les tests d'interface existants valident également navigation, cartes et pages publiques.

Ces tests locaux simulent le backend pour une partie des scénarios : ils **ne prouvent pas** que le VPS sert la version attendue. Les tests sur les métadonnées utilisent le générateur commun, et ne remplacent donc pas un contrôle du HTML final.

## Contrôle réel après déploiement OVH

Workflow manuel : `.github/workflows/seo-http-acceptance.yml`

Script sans authentification : `node scripts/seo-http-acceptance.mjs`

Il interroge HTTPS `www.lmn24.com` en lecture seule, sur les 8 langues et les familles Accueil/Vidéos/Hashtags/Météo/Horoscope, plus Catégorie International, `/admin/login`, `/robots.txt` et `/sitemap.xml`.

Pour chaque HTML il teste : HTTP 200, title et description non vides, canonical unique et absolue, hreflang sur les pages communes, H1, existence et validité JSON-LD. L'administration doit être `noindex`; les XML doivent être accessibles et ne pas exposer de liens administratifs. Résultats enregistrés en artifact (30 jours), avec URLs exactes et erreurs explicites.

La campagne post-déploiement est **manuelle** afin de ne pas faire échouer une CI sur du contenu OVH provenant d'un commit précédent. Une exécution réussie ne garantit pas l'indexation effective par Google.

## Reste à qualifier avant clôture définitive

- Vérifier avec navigateur réel la navigation client, le sélecteur de langue et l'opt-in/opt-out Google Analytics ; vérifier le rendu mobile.
- Tester des catégories/sources/hashtags *réellement existants* ainsi que des inactifs et des pages vides en production. Le script public vérifie principalement les familles stables pour éviter des hypothèses de slugs.
- Ajouter à terme des scénarios navigateur sous Playwright avec backend et PostgreSQL isolés, car les tests locaux ne capturent pas tous les rendus SSR ni les interactions.
- Vérifier la cohérence de canonical/hreflang avec les sitemaps dynamiques et la donnée réellement publiée.
- Conserver des captures de CI et de recette post-déploiement dans Jira ; ne pas fermer la Story si la CI ou la production est en échec.

Références :
- https://github.com/JeanLamora75/lmn24/actions/workflows/ci.yml
- https://github.com/JeanLamora75/lmn24/actions/workflows/seo-http-acceptance.yml
