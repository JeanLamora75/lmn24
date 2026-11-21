# LMN24 — SCRUM-122 / GTV-09 — Administration Guide TV

Date : 2026-11-21. Implémentation candidate sur `main`, sans GO de migration ni de publication.

## Périmètre effectivement codé

- Une seule entrée de navigation `Guide TV` réservée au rôle ADMIN avec sous-navigation : Vue d'ensemble, Pays, Chaînes, Sources EPG, Imports, Traductions, Statistiques.
- Layout protégé côté serveur Next.js (404 si rôle non ADMIN), sans modifier le verrou des routes TV publiques.
- Proxy `/api/admin/tv/[...path]` avec chemins explicitement autorisés, longueur de requête/payload bornée et propagation des contrôles 401/403 NestJS.
- Pays : liste, filtre, fuseau IANA, statut, modal d'édition, version optimiste avec conflit 409.
- Chaînes : liste par association pays/chaîne, statut, numéro effectif, filtres, modal de correction de numéro et statut ; version optimiste avec conflit 409.
- Sources EPG : liste, filtre par pays/statut, création en modal avec droits distincts pour programmes, synopsis, images, logos ; URL validée en backend et preuve exigée pour APPROVED.
- Imports : historique paginé côté API, lancer un import manuel global (pays actifs uniquement) ou pour un pays explicitement sélectionné, même inactif ; jours 1…7, suivi scopes/événements et reprise des seuls échecs.
- Traductions : liste des fournisseurs sans secrets, sélection manuelle d'un fournisseur actif avec gratuité/droits approuvés, consultation des descriptions par langue et sauvegarde MANUAL explicite avec 409 concurrent.
- Statistiques : mesures disponibles effectivement calculées à partir des listes et état « Couverture non calculable » lorsque l'attestation manque. Ni badge admin global, ni email.

## Contrôles et sécurité

- Les contrôleurs NestJS restent bloqués si `TV_CATALOG_ADMIN_ENABLED` n'est pas explicitement `true`, et le volet imports requiert en plus `TV_IMPORTS_ENABLED`.
- La fermeture du Guide TV public (Next.js + NestJS, 404/no-store avant GO) n'a pas été modifiée.
- Aucune nouvelle table ni migration production, aucun changement de variables d'environnement, aucune création de provider fictif.
- Aucune traduction automatique ni bascule de fournisseur automatisée ; les textes existants d'autres langues sont conservés.
- Les conflits de versions sont remontés en 409 et la source de vérité reste le serveur, sans mise à jour optimiste aveugle.

## Points restant à livrer pour la DoD intégrale SCRUM-122

- Écran chaîne complet : identité, langues, variantes, descriptions, liens officiels, mapping EPG, recherche automatique de liens avec aperçus/provenance ; ces API de fond n'ont pas encore toutes les fonctionnalités nécessaires.
- Écran source complet : édition du format/droits, priorités atomiques par pays et review des mappings à relier à l'UI.
- Gestion configurée des fournisseurs, moteur de traduction et reprise ciblée des langues manquantes/échouées (sans écraser MANUAL). Ce moteur n'est pas activé par simple présence de l'UI.
- Indicateurs couverture/durée/provenance si et seulement si attestation réelle de la source disponible ; pas de pourcentage ou qualité inventés.
- Historique imports : backend renvoie 100 éléments max actuellement dans la vue ; pagination complète par API à connecter.
- Validation maquettes UX-04 à 320/390/768/1440 px et huit langues si l'administration devient localisée, accessibilité clavier/modal complète, scénario UX04-01…30, revue Murat.
- CI verte sur le **même commit** après les dernières modifications. Tant que tests QA et fonctionnalités restantes manquent, ne pas déclarer SCRUM-122 terminée.

Documentation de référence : [Jira SCRUM-122](https://lmn24.atlassian.net/browse/SCRUM-122), [Sally UX-04](./guide-tv-mondial-sally-ux04-administration.md), [Mary/Winston D01–D15](./guide-tv-mondial-mary-winston-arbitrages-d01-d15.md).
