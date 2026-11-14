# SCRUM-101 — Google Search Console : activation et supervision LMN24

## À quoi sert la connexion

LMN24 dispose déjà d'un suivi d'audience **Google Analytics 4**. **Google Search Console** est un service distinct : il décrit la visibilité dans la recherche Google (clics, impressions, CTR, position) et l'état des sitemaps. L'activation de GA4 ne donne pas automatiquement accès à Search Console.

Le tableau de bord administrateur créé par SCRUM-101 est accessible depuis **Administration → Statistiques du site → Search Console** (URL `/admin/site-statistics/search-console`). La route `/api/admin/statistics/search-console` reste strictement protégée par la session administrateur et ne renvoie jamais le secret du compte de service.

## Activation du côté Google (intervention humaine obligatoire)

1. Se connecter à [Google Search Console](https://search.google.com/search-console) avec le compte propriétaire de LMN24.
2. Ajouter ou sélectionner la propriété exacte **`https://www.lmn24.com/`** (propriété *Préfixe d'URL*), ou, si la propriété `sc-domain:lmn24.com` existe déjà, configurer la variable privée `GSC_SITE_URL=sc-domain:lmn24.com` sur OVH. Attention : ces deux identifiants ne sont pas interchangeables dans l'API.
3. Vérifier la propriété en suivant le mode de vérification proposé par Google : DNS TXT chez OVH pour une propriété de domaine, ou une méthode supportée pour une propriété Préfixe d'URL. La simple présence de `robots.txt` ou d'un sitemap ne prouve pas la propriété. Aucune modification DNS n'est automatisée par ce chantier.
4. Dans Search Console → **Paramètres / Utilisateurs et autorisations**, accorder un accès de lecture de la propriété à l'adresse e-mail du **compte de service déjà utilisé pour GA4** (ou d'un compte de service GSC dédié). L'adresse est dans `client_email` du JSON privé. Ne jamais copier ni transmettre la clé privée dans Jira, un chat ou le dépôt.
5. Google Cloud : activer **Google Search Console API** sur le projet auquel appartient le compte de service. Cette API est différente de Google Analytics Data API.
6. Dans Search Console → **Sitemaps**, envoyer **`https://www.lmn24.com/sitemap.xml`** ou saisir `sitemap.xml` lorsque le champ utilise déjà le préfixe du site. Relever la date, l'état de traitement et le nombre d'URL découvertes. Cette action doit être effectuée par un propriétaire habilité. Aucune soumission n'a été effectuée par l'implémentation.
7. Après déploiement de SCRUM-101, aller dans LMN24 → Administration → Statistiques du site → **Search Console**. Tester 7 et 30 jours. L'affichage d'une erreur d'autorisation indique que la propriété, l'API ou les droits du compte de service ne sont pas encore correctement configurés.

## Configuration secrète OVH

Le frontend lit, uniquement côté serveur :
- `GA4_SERVICE_ACCOUNT_JSON_B64` : compte de service GA4 **déjà installé** ; réutilisé pour Search Console **uniquement si la propriété Search Console lui a donné accès**.
- `GSC_SERVICE_ACCOUNT_JSON_B64` (facultatif) : clé d'un compte de service GSC distinct. Prioritaire lorsqu'elle existe.
- `GSC_SITE_URL` (facultatif) : `https://www.lmn24.com/` par défaut ou `sc-domain:lmn24.com` pour la propriété de domaine correctement vérifiée.

Ne jamais ajouter de préfixe `NEXT_PUBLIC_` à ces variables. Les clés doivent demeurer uniquement dans l'environnement privé du serveur OVH ou les secrets d'un workflow d'installation explicitement autorisé.

Le backend utilise uniquement le scope Google **`https://www.googleapis.com/auth/webmasters.readonly`**. Aucun endpoint de soumission, suppression ou modification de propriété n'est implémenté.

## Lecture des statistiques

- Périodes 7 ou 30 jours **complets**, jusqu'à J-3 UTC pour laisser du temps à Google de finaliser les données.
- Cartes globales : clics, impressions, CTR moyen, position moyenne issus d'une requête sans dimension `page`.
- Tableau des **100 premières pages** rapportées par l'API ; leur somme n'est pas présentée abusivement comme le total du site.
- Sitemaps : dernier téléchargement, dernière soumission, état pending, erreurs/avertissements et nombres d'URL lorsque Google les expose.
- Données vides ou absentes ≠ zéro page indexée. La Search Analytics API ne dresse pas la liste complète des pages indexées et les statistiques sont limitées par les données que Google rend disponibles.

## Recette d'indexation à documenter dans Jira

Dans Search Console → **Inspection d'URL**, contrôler au minimum :
- Accueil `/fr`, `/en`, `/de`, `/es`, `/pt`, `/it`, `/ru`, `/nl`.
- Catégorie `/fr/category/international` ainsi que ses traductions réellement alimentées.
- Source publique active réelle, hashtag actif réel, `/fr/videos`, `/fr/weather`, `/fr/horoscope` et un signe.
- Un slug réellement inexistant pour confirmer HTTP 404, une route admin/noindex et une variante filtrée/noindex.

Pour chaque URL, noter date, verdict indexée / non indexée, source de découverte, canonical choisie par Google, canonical déclarée par LMN24, dernière exploration, couverture robots, problème (alternative canonique, duplicata, soft 404, exclue par noindex, inaccessible, découverte mais non indexée). Ne pas inventer des statuts non observés.

## Routine recommandée

- Après chaque déploiement SEO : lancer le workflow GitHub Actions **SEO post-deployment acceptance** et inspecter l'état de `/robots.txt`, `/sitemap.xml` et des balises rendues.
- Une fois par semaine : consulter Indexation → Pages et Sitemaps pour les nouveaux problèmes ; collecter les preuves dans SCRUM-101 ou une anomalie liée.
- Une fois par mois : examiner les performances de recherche (clics, impressions, CTR et pages/queries), comparer des périodes homogènes, vérifier les 8 langues et les régressions du nombre d'URL indexées.
- Ne conclure à une amélioration SEO qu'avec des données Search Console observées sur une période suffisante ; la soumission d'un sitemap n'entraîne aucune garantie d'indexation.

## État de la Story

- **Implémenté :** tableau de bord privé, client Google Search Console API en lecture seule, erreurs d'accès explicites, accès dans la navigation des statistiques, tests d'API.
- **À confirmer manuellement :** propriété vérifiée, autorisation du compte de service, API Google activée, sitemap soumis et traité, inspection d'URLs et premiers rapports réellement affichés. Ces opérations ne sont **pas** revendiquées comme réalisées.
- **Avant clôture :** CI du dernier commit réussie et recette OVH avec captures/observations réelles.
