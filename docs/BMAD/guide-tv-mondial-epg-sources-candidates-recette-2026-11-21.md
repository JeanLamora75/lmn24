# Guide TV mondial — revue des sources EPG pour la recette (21 novembre 2026)

## Origine : étude BMAD vs nouveaux candidats

Le cadrage Mary [guide-tv-mondial-mary-cadrage-fonctionnel.md](./guide-tv-mondial-mary-cadrage-fonctionnel.md)
cite explicitement **deux projets externes** : [IPTV-org/epg](https://github.com/iptv-org/epg)
et [XMLTV/xmltv](https://github.com/XMLTV/xmltv). Il ne donne pas de lien de
fichier EPG XMLTV prêt à télécharger. Ce sont des **collecteurs/outils** :
- IPTV-org/epg collecte les sites déclarés dans `SITES.md`, produit un guide XML et
  répertorie des guides partagés. Sa licence Unlicense s'applique au **code du collecteur**,
  pas automatiquement aux programmes tiers.
- XMLTV/xmltv est une suite de grabbers et d'utilitaires, pas un serveur XMLTV global.

Une URL `source_url` dans LMN24 doit être un **fichier EPG XMLTV/JSON directement
consommable**. Ces deux projets ne sont donc pas ajoutés comme de fausses sources.

## Sources complémentaires identifiées pendant la recherche

Les dix URL ci-dessous ont un **lien publié par l'auteur ou présent dans
un index public** lors de la recherche du 21/11/2026. Elles sont proposées
comme candidats, **pas comme flux testés de bout en bout depuis LMN24**.
Les droits de redistribution des grilles et des médias sont **non qualifiés**.

| Nom affiché | URL XMLTV GZIP | Preuve d'URL |
|---|---|---|
| Teleonline EPG — Monde | https://teleonline.github.io/epg/epg.xml.gz | https://github.com/teleonline/epg |
| EPGSHARE01 — France FR1 | https://epgshare01.online/epgshare01/epg_ripper_FR1.xml.gz | https://epgshare01.online/epgshare01/ |
| EPGSHARE01 — Belgique BE2 | https://epgshare01.online/epgshare01/epg_ripper_BE2.xml.gz | idem |
| EPGSHARE01 — Royaume-Uni UK1 | https://epgshare01.online/epgshare01/epg_ripper_UK1.xml.gz | idem |
| EPGSHARE01 — Allemagne DE1 | https://epgshare01.online/epgshare01/epg_ripper_DE1.xml.gz | idem |
| EPGSHARE01 — Espagne ES1 | https://epgshare01.online/epgshare01/epg_ripper_ES1.xml.gz | idem |
| EPGSHARE01 — États-Unis US2 | https://epgshare01.online/epgshare01/epg_ripper_US2.xml.gz | idem |
| EPGSHARE01 — Australie AU1 | https://epgshare01.online/epgshare01/epg_ripper_AU1.xml.gz | idem |
| Matt Huisman — Nouvelle-Zélande | https://i.mjh.nz/nz/epg.xml.gz | https://www.matthuisman.nz/2017/07/new-updated-nz-iptv-files.html |
| NZXMLTV Freeview — Nouvelle-Zélande | https://nzxmltv.com/freeview/guide-static.xml.gz | https://nzxmltv.com/xmltv/ |

**Ne pas importer aveuglément l'archive ALL_SOURCES d'EPGSHARE01** : elle
atteignait ~210 Mo compressés dans l'index vu lors de la recherche et peut
dépasser les limites de téléchargement/décompression de l'application.
Les flux régionaux restent à qualifier techniquement.

## Restrictions et sécurité

1. Les dix sources sont créées `is_active=false`, tous statuts de droits
   `UNREVIEWED`, sans associer de pays (sources globales par défaut).
2. Un lien accessible librement n'est **pas** une autorisation de collecte,
   réutilisation commerciale ou republication. Il faut documenter les droits
   pour programmes, synopsis, images et logos **séparément**.
3. La requête SQL ne déclenche **aucun téléchargement** de flux et ne
   lève aucun flag d'exécution réseau ou d'ouverture au public.
4. L'import est réexécutable par URL et ne modifie aucune entrée préexistante.
   Si une URL existait déjà et était active, l'import ne la désactive pas.
5. Après insertion, recette : lecture/inspection manuelle des sources,
   conformité légale, puis seulement qualification technique via runner isolé,
   mappings en `PENDING_REVIEW`, contrôle de couverture et GO final distinct.

## Commande locale sans psql

```sh
git pull origin main
node --env-file=.env scripts/seed-tv-epg-sources-local.cjs
```

Le script refuse toute base dont l'hôte n'est pas localhost ou dont le
nom n'est pas `lmn24`. Les fichiers sont versionnés pour être repris dans
une **procédure production qualifiée**, sans exécution automatique.
