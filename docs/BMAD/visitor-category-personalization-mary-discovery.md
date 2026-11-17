# LMN24 — Personnalisation des catégories publiques
## Mary (BMAD Business Analyst) — cadrage fonctionnel
Date : 2026-11-17
Statut : première implémentation engagée sur main ; questions métier ouvertes pour les évolutions ultérieures.

## Besoin exprimé
Le visiteur ouvre « Mes préférences ». À la place de la phrase d'introduction visible, il trouve deux onglets avec icônes :
- **Général** : apparence, pays/ville et date de naissance préexistants, sans régression ;
- **Catégories** : activer/désactiver les rubriques et décider de leur ordre.

Cette configuration doit rester simple à utiliser sur smartphone comme sur ordinateur, et le visiteur conserve le contrôle de l'enregistrement.

## Règles de la première réalisation
1. « Activer/désactiver » signifie **afficher/masquer une rubrique sur la page d'accueil** du visiteur, pas supprimer ni désactiver la catégorie éditoriale pour les autres utilisateurs. La page dédiée d'une catégorie demeure accessible depuis son URL.
2. La liste des catégories provient d'un catalogue public en lecture seule de catégories actives ; les identifiants UUID sont utilisés pour les préférences afin de conserver les choix indépendamment de la langue.
3. Une catégorie nouvelle apparaît par défaut, sauf choix explicite ultérieur. L'ordre éditorial est conservé pour les catégories que le visiteur n'a jamais reclassées.
4. Le visiteur choisit la visibilité avec une case à cocher, puis modifie la priorité avec **Monter/Descendre**. Aucune dépendance au glisser-déposer tactile.
5. Toutes les modifications restent dans le brouillon de la modale. **Enregistrer** persiste dans `lmn24.visitorPreferences` uniquement sur ce navigateur ; **Annuler** abandonne ; **Réinitialiser** sur l'onglet restaure la visibilité et l'ordre ; « Tout réinitialiser » demeure la confirmation générale.
6. Les deux onglets ont une icône et un libellé traduits dans les huit langues FR/EN/DE/ES/PT/IT/RU/NL. Sur mobile, la modale reste accessible au clavier, aux lecteurs d'écran et sur écran étroit.
7. Quand tout est masqué, ne pas faire croire à une panne d'actualité : afficher un état explicite. Si le catalogue n'est pas accessible, afficher une erreur et un bouton Réessayer ; ne pas effacer les choix sauvegardés.
8. Pas de compte, pas d'API envoyant le choix personnel au serveur, pas d'écriture PostgreSQL. Une requête de lecture du catalogue public est autorisée ; la personnalisation de l'accueil s'effectue après hydratation, sans compromettre le rendu SEO serveur neutre.

## Périmètre et exclusions
**Inclus :** sélection et ordre des blocs catégories de l'accueil, interface de préférences, enregistrement local explicite, réinitialisation, i18n et tests.
**Exclus :** masquer les articles d'une catégorie sur toutes les autres pages, modifier l'ordre pour les autres visiteurs, synchronisation multi-appareils, recommandation algorithmique, personnalisation côté serveur, réorganisation de la navigation globale.
**Conséquence :** le lien « Catégories » de la navigation publique et les pages individuelles restent inchangés.

## Hypothèses à soumettre à validation
- L'utilisateur a demandé « activer/désactiver les catégories », sans préciser **où**. L'interprétation retenue pour la version initiale est l'**accueil**, car les blocs catégoriels y sont ordonnables. Souhaitera-t-il aussi cacher des catégories dans les menus, les listes de découverte, la recherche et les flux secondaires ?
- Le classement par boutons « Monter/Descendre » est volontairement privilégié pour l'accessibilité et la fiabilité ; faut-il ensuite proposer un glisser-déposer en complément ?
- Souhaite-t-il pouvoir activer/désactiver toutes les catégories en un clic ou créer des ensembles « Mes sujets », sans modifier le principe de sélection individuelle ?
- Le réglage doit-il rester strictement local au navigateur, comme les préférences existantes, ou devenir exportable/synchronisable après étude de confidentialité ?

## Critères de recette et points de vigilance
- Les préférences de version 1 déjà stockées restent lisibles sans perte de thème, ville ni date de naissance ; aucun état personnalisé n'est écrit avant Enregistrer.
- Les catégories identifiées restent stables si le visiteur change de langue ; les catégories absentes temporairement du catalogue ne provoquent pas d'erreur.
- La page publique charge d'abord le contenu éditorial neutre pour le SSR, puis applique l'ordre et les masquages locaux côté client après hydratation ; un bref changement de position est possible au premier affichage.
- Le catalogue n'expose pas de contenu privé et la route ne reçoit pas la date de naissance ni les préférences.
- Tests unitaires de tri, masquage, migration et transactions ; tests navigateur de tabs, ordre, Annuler, Enregistrer, mobile, disponibilité du catalogue et absence de régression de l'onglet Général.
- Une livraison terminée exige **une CI verte sur le même SHA de main** ; on ne déclare pas la recette concluante sur la simple présence des tests.

## Arbitrage Mary
La version « deux onglets / tri et masquage de l'accueil » constitue un **MVP cohérent** sans nouveau compte ni dépendance payante. Mary recommande de valider explicitement l'étendue du masquage (accueil seulement versus tous les supports) avant d'étendre l'usage des préférences au reste du site.

Liens utiles :
- [Étude Winston sur les préférences](https://github.com/JeanLamora75/lmn24/blob/main/docs/BMAD/visitor-preferences-winston-architecture.md)
- [Jira LMN24](https://lmn24.atlassian.net/jira/software/projects/SCRUM/issues)
