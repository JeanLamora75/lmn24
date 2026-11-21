-- LMN24 - Guide TV mondial - Candidats de sources XMLTV (21 novembre 2026)
-- Sources effectivement citées dans l'étude BMAD initiale :
--   IPTV-org/epg et XMLTV/xmltv = OUTILS / COLLECTEURS, pas flux XMLTV unique.
--   https://github.com/iptv-org/epg
--   https://github.com/XMLTV/xmltv
-- Ces deux projets ne sont pas insérés : source_url attend un flux téléchargeable.
--
-- Les 10 URL ci-dessous sont des CANDIDATS ADDITIONNELS documentés,
-- découverts lors de la revue externe demandée. Ce ne sont PAS des sources
-- juridiquement approuvées ni des endpoints garantis opérationnels à l'import.
-- Les pages sources décrivent ces URL (ou indexent leur fichier) au 21/11/2026 ;
-- le contenu XML/GZIP et les droits de réutilisation n'ont pas été validés
-- par un téléchargement/parser d'intégration dans l'environnement LMN24.
--
-- IMPORTANT : accès public/gratuit ou licence open source du collecteur
-- n'autorise PAS à copier/republier des grilles, titres, descriptions et images.
-- Toutes les sources sont INACTIVES et droits = UNREVIEWED.
-- Aucune insertion dans tv_source_country (source mondiale par défaut).
-- Pas de contact HTTP avec ces URL lors de l'exécution SQL.
-- Pas d'activation des flags TV_EPG_NETWORK_ENABLED / TV_PUBLIC_ENABLED.
-- Une habilitation/qualification juridique et technique distincte est requise.
--
-- Réexécutable : rapprochement par URL exacte ; aucune modification des sources
-- qui existent déjà (même nom, droits, activation, historique).
-- Ne supprime et ne modifie aucune source existante.
--
-- Note : "XMLTV_GZIP" pour une réponse .xml.gz ; JSON .json.gz n'est PAS
-- importé en "JSON" car l'adaptateur attend du JSON lisible directement.
--
-- Avant toute exécution en PRODUCTION : backup, inventaire des contraintes,
-- examen des preuves de droits, GO explicite et procédure contrôlée.
BEGIN;
SELECT pg_advisory_xact_lock(241024, 194);

DO $check$
BEGIN
 IF to_regclass('public.tv_source') IS NULL THEN
  RAISE EXCEPTION 'Table public.tv_source absente : qualifier le schéma Guide TV avant cet import';
 END IF;
END
$check$;

CREATE TEMP TABLE _lmn24_epg_source_candidates (
 name VARCHAR(255) NOT NULL,
 source_url TEXT PRIMARY KEY,
 format VARCHAR(16) NOT NULL,
 documentation_url TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _lmn24_epg_source_candidates(name,source_url,format,documentation_url)
VALUES
  ('Teleonline EPG — Monde', 'https://teleonline.github.io/epg/epg.xml.gz', 'XMLTV_GZIP', 'https://github.com/teleonline/epg'),
  ('EPGSHARE01 — France FR1', 'https://epgshare01.online/epgshare01/epg_ripper_FR1.xml.gz', 'XMLTV_GZIP', 'https://epgshare01.online/'),
  ('EPGSHARE01 — Belgique BE2', 'https://epgshare01.online/epgshare01/epg_ripper_BE2.xml.gz', 'XMLTV_GZIP', 'https://epgshare01.online/'),
  ('EPGSHARE01 — Royaume-Uni UK1', 'https://epgshare01.online/epgshare01/epg_ripper_UK1.xml.gz', 'XMLTV_GZIP', 'https://epgshare01.online/'),
  ('EPGSHARE01 — Allemagne DE1', 'https://epgshare01.online/epgshare01/epg_ripper_DE1.xml.gz', 'XMLTV_GZIP', 'https://epgshare01.online/'),
  ('EPGSHARE01 — Espagne ES1', 'https://epgshare01.online/epgshare01/epg_ripper_ES1.xml.gz', 'XMLTV_GZIP', 'https://epgshare01.online/'),
  ('EPGSHARE01 — États-Unis US2', 'https://epgshare01.online/epgshare01/epg_ripper_US2.xml.gz', 'XMLTV_GZIP', 'https://epgshare01.online/'),
  ('EPGSHARE01 — Australie AU1', 'https://epgshare01.online/epgshare01/epg_ripper_AU1.xml.gz', 'XMLTV_GZIP', 'https://epgshare01.online/'),
  ('Matt Huisman — Nouvelle-Zélande', 'https://i.mjh.nz/nz/epg.xml.gz', 'XMLTV_GZIP', 'https://www.matthuisman.nz/2017/07/new-updated-nz-iptv-files.html'),
  ('NZXMLTV Freeview — Nouvelle-Zélande', 'https://nzxmltv.com/freeview/guide-static.xml.gz', 'XMLTV_GZIP', 'https://nzxmltv.com/xmltv/');

DO $preflight$
DECLARE actual_cols integer;
BEGIN
 SELECT count(*) INTO actual_cols FROM information_schema.columns
 WHERE table_schema='public' AND table_name='tv_source'
 AND column_name IN ('name','source_url','format','is_active','rights_status',
 'programme_rights_status','synopsis_rights_status','image_rights_status','logo_rights_status');
 IF actual_cols<>9 THEN
  RAISE EXCEPTION 'Schéma tv_source incompatible : 9 colonnes obligatoires attendues, % trouvées', actual_cols;
 END IF;
 IF (SELECT count(*) FROM _lmn24_epg_source_candidates)<>10 THEN
  RAISE EXCEPTION 'Catalogue candidats EPG incomplet';
 END IF;
END
$preflight$;

INSERT INTO public.tv_source (
 name, source_url, format, is_active, rights_status,
 programme_rights_status, synopsis_rights_status, image_rights_status, logo_rights_status
)
SELECT c.name,c.source_url,c.format,FALSE,'UNREVIEWED',
 'UNREVIEWED','UNREVIEWED','UNREVIEWED','UNREVIEWED'
FROM _lmn24_epg_source_candidates c
WHERE NOT EXISTS (
 SELECT 1 FROM public.tv_source t WHERE t.source_url=c.source_url
);

-- Contrôle transactionnel : aucune URL manquante.
DO $verify$
DECLARE missing integer;
BEGIN
 SELECT count(*) INTO missing FROM _lmn24_epg_source_candidates c
 WHERE NOT EXISTS(SELECT 1 FROM public.tv_source t WHERE t.source_url=c.source_url);
 IF missing<>0 THEN RAISE EXCEPTION 'Sources candidates non enregistrées : %',missing; END IF;
END
$verify$;

COMMIT;

-- Résumé des 10 URL candidates : si déjà présentes et actives, elles ne
-- sont PAS désactivées ; vérifier les autorisations existantes avant import.
SELECT count(*) AS candidats_presents,
 count(*) FILTER (WHERE s.is_active) AS candidats_actifs,
 count(*) FILTER (WHERE NOT s.is_active) AS candidats_inactifs,
 count(*) FILTER (WHERE s.programme_rights_status = 'APPROVED') AS droits_programmes_approuves
FROM public.tv_source s
WHERE s.source_url IN (
 'https://teleonline.github.io/epg/epg.xml.gz',
 'https://epgshare01.online/epgshare01/epg_ripper_FR1.xml.gz',
 'https://epgshare01.online/epgshare01/epg_ripper_BE2.xml.gz',
 'https://epgshare01.online/epgshare01/epg_ripper_UK1.xml.gz',
 'https://epgshare01.online/epgshare01/epg_ripper_DE1.xml.gz',
 'https://epgshare01.online/epgshare01/epg_ripper_ES1.xml.gz',
 'https://epgshare01.online/epgshare01/epg_ripper_US2.xml.gz',
 'https://epgshare01.online/epgshare01/epg_ripper_AU1.xml.gz',
 'https://i.mjh.nz/nz/epg.xml.gz',
 'https://nzxmltv.com/freeview/guide-static.xml.gz'
);
