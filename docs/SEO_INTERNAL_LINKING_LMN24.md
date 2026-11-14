# SCRUM-99 — Navigation et maillage interne LMN24

## Inventaire des parcours publics (8 langues)

La navigation principale, les catégories dans le pied de page et les liens dans les cartes utilisent les mêmes routes dans `fr/en/de/es/pt/it/ru/nl`. Les profils des sources n'ont pas de rubrique générale `/source` : **ne pas créer de lien vers cette route inexistante**.

| Point d'entrée | Lien HTML public | Destination |
|---|---|---|
| En-tête | Liens Next-intl de navigation | Accueil, vidéos, hashtags, horoscope, météo |
| Pied de page (desktop et mobile) | Liens de catégories localisés | `/{lang}/category/{slug}` |
| Accueil | Titre de catégorie et « Voir plus » | Page de catégorie correspondante |
| Carte d'article (accueil ou liste de catégorie/source/hashtag) | Lien indépendant nommé par le média, uniquement si un slug source actif est exposé | `/{lang}/source/{slug}` |
| Carte d'article | Lien vers l'article externe de l'éditeur, indépendant du lien vers la source LMN24 | Site de l'éditeur |
| Pages catégorie et source | Fil d'Ariane SSR | Accueil de la même langue |
| Classement hashtags | Lien vers le détail de chaque hashtag | `/{lang}/hashtags/{slug}` |
| Détail hashtag | Retour vers classement | `/{lang}/hashtags` |
| Horoscope | Cartes des douze signes | `/{lang}/horoscope/{sign}` |
| Détail horoscope | Retour vers index horoscope | `/{lang}/horoscope` |
| Changement de langue | Sélecteur interactif existant | Variante correspondante lorsque navigable |

**Précautions :** les URLs publiées doivent respecter le slug réel et la langue. Les pages de détail source inactives sont exclues des listes publiques ; pas de slug fabriqué à partir du nom, ni de lien imbriqué dans une ancre externe. Ne pas présenter les articles RSS comme des contenus réédités sur LMN24.

## Pagination et indexabilité

Les familles catégories, sources et hashtags rendent la **première page côté serveur**, avec des liens d'articles directement disponibles dans le HTML. Les pages suivantes sont obtenues via `IntersectionObserver` et une API à curseur. Elles ne possèdent **pas de pages HTML crawlables dédiées**, donc elles ne sont **pas garanties découvrables** par les robots qui n'effectuent pas le défilement et ne chargent pas l'API. Le sitemap des catégories/sources/index hashtags permet de découvrir les pages de collection, **pas les articles RSS externes individuels**.

Une stratégie de pagination SEO avec URLs stables devrait être étudiée séparément avant de changer les mécanismes à curseur ; ne pas canoniser arbitrairement des pages de contenu réellement distinctes.

## Pages vides ou peu pertinentes

- Une catégorie/source inactive est exclue du sitemap et doit retourner 404.
- Une catégorie ou source active sans articles dans une langue ne doit pas être publiée comme variante `hreflang` indexable (règles SCRUM-94/95).
- Une indisponibilité backend ne doit pas être présentée comme une collection vide pérenne.
- Ne pas recopier les articles RSS pour créer artificiellement des pages de contenu interne.
- Pages de classement filtrées et horoscopes datés conservent la politique `noindex` décidée en SCRUM-95.

## Vérifications et limites

Tests du code : `apps/frontend/src/components/home/internal-linking.test.ts`; tests API catégories/sources et CI globale. Une recette navigateur mobile doit vérifier le rendu du pied de page, le comportement du lecteur vidéo, les liens source et la navigation au clavier.

Les catégories présentes de manière statique dans le pied de page doivent être contrôlées en production contre l'état actif réel. Une catégorie désactivée pourrait renvoyer 404 ; un pied de page piloté par la base peut être préférable si ce cas est courant.

**Reste à faire pour clore SCRUM-99 :** campagne HTTP de liens internes valides dans les huit langues, détection des liens cassés/orphelins, couverture navigateur, revue UX Sally et validation après déploiement OVH.
