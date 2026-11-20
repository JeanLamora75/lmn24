# LMN24 — SCRUM-113 — Amelia / Winston / Murat : verrou de publication du Guide TV

**Date :** 2026-11-20  
**Statut :** implémentation initiale sur `main`, vérification CI en cours ; **aucun GO de publication**.  
**Story :** [SCRUM-113](https://lmn24.atlassian.net/browse/SCRUM-113).

## 1. Implémentation

- Frontend : `apps/frontend/src/lib/tv-public-gate.ts` expose la règle pure ; `apps/frontend/src/proxy.ts` applique un refus avant next-intl locale routing. La configuration Next.js inclut explicitement les routes TV sous `/api/public/tv` et `/api/tv/public`, normalement exclues du matcher locale. Les pages `/tv`, `/programme-tv` et leurs équivalents dans les huit locales sont filtrés.
- Backend : `apps/backend/src/tv/tv-public-gate.ts` expose un contrôle indépendant ; `apps/backend/src/main.ts` applique une barrière Express précoce sur `/public/tv`, `/api/public/tv` et leurs variantes `/tv/public`, `/api/tv/public`.
- **Activation défensive double** : `TV_PUBLIC_ENABLED === "true"` **et** `TV_PUBLIC_RELEASE_APPROVED === "true"`. Toutes les autres combinaisons sont fermées. Aucun de ces paramètres n'est écrit par cette story, ni ajouté aux fichiers de production.
- Refus serveur : HTTP **404 générique**, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`. L'administration `/admin/tv` et les API `/api/admin/tv` sont exclues de la barrière publique (les futures APIs d'administration devront obligatoirement effectuer leur propre contrôle session + rôle ADMIN à chaque endpoint).
- Aucune page ou API publique TV n'est créée par cette story, aucun lien au menu, aucune URL ajoutée aux sitemaps/robots. La candidate SQL n'est pas modifiée ni exécutée.

## 2. Tests ajoutés

- `apps/frontend/src/lib/tv-public-gate.test.ts` : huit locales, root paths, pages de recherche, flag désactivé par défaut, refus d'une seule variable, non-régression des pages et API admin et des pages publiques existantes.
- `apps/backend/src/tv/tv-public-gate.test.ts` : chemins API publiques, paramètres, non-régression des API admin, docs/health, activation double explicite.
- `apps/frontend/src/proxy-seo.test.ts` : vérifier le matcher réel des huit locales et deux préfixes API TV, sans régression sitemap/admin.

## 3. Limitations et portes de contrôle

- Les futurs contrôleurs devront être rattachés aux préfixes publics conventionnels protégés, ou mettre à jour la barrière **avant** exposition d'un nouveau préfixe. Les routes API admin nécessitent chacune un guard NestJS / Next server approprié.
- Une barrière de proxy ne remplace pas les guards **internes** d'un futur contrôleur, ni la vérification des droits EPG ; tous les tests devront être rejoués à l'arrivée des routes effectives.
- La documentation Swagger des **futurs** contrôleurs ne devra pas exposer les données de l'API TV avant GO ; les schémas publics TV ne sont pas encore créés.
- Les chemins du Guide TV dans les sitemaps/metadata doivent faire l'objet de tests régressifs lorsque les pages permanentes seront développées.
- **GO public express du propriétaire** requis avant toute configuration des deux variables ; ne jamais les activer en CI/CD ou durant un déploiement ordinaire.
- Les vérifications de sécurité de la production ne sont pas prouvées par la seule CI. L'homologation SCRUM-125 reste distincte.

## 4. Conclusion

SCRUM-113 fournit une première barrière serveur Next/Nest testable avant l'existence des routes publiques. **Il ne permet et n'autorise aucune publication**. Le verdict définitif de cette implémentation nécessite la CI complète verte sur un même SHA et, pour sa DoD complète, une recette d'accès HTTP réel et des contrôles d'administration lorsque les endpoints existeront.
