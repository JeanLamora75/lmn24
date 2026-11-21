-- LMN24 - Guide TV mondial - Catalogue des 249 pays/territoires ISO (i18n)
-- Source des codes : messages/{fr,en,de,es,it,pt,nl,ru}.json sur LMN24/main,
-- comparés le 21/11/2026 : mêmes 249 codes dans chacune des 8 langues.
-- Fuseaux IANA : base tzdata/pytz 2026.2 ; 1 fuseau de référence par pays.
-- Le fuseau de référence n'est PAS la liste de tous les fuseaux du pays.
-- Pour pays multizones, choix indicatif capitale / grande zone de population :
--   FR Europe/Paris ; US America/New_York ; CA America/Toronto ;
--   AU Australia/Sydney ; RU Europe/Moscow ; BR America/Sao_Paulo ; etc.
-- AQ Antarctica/McMurdo : convention administrative de test (pas de fuseau unique).
-- BV et HM : Etc/UTC par convention, territoires inhabités sans fuseau civil propre.
--
-- Pré-requis : public.country doit déjà contenir les 249 pays (seed LMN24
--   database/seed_country.sql) et public.tv_country doit déjà exister.
-- Script pour BASE LOCALE / TEST UNIQUEMENT, sans GO de production.
-- À conserver pour déploiement futur APRÈS homologation du schéma, sauvegarde
-- et autorisation explicite de l'opération ; jamais lancé automatiquement.
-- RÉEXÉCUTABLE : n'écrase jamais les paramètres TV déjà existants,
-- notamment France, is_active et reference_timezone.
-- Les NOUVELLES lignes tv_country sont toutes INACTIVES : activation manuelle.
-- Aucune écriture dans messages/*.json ou dans public.country.
--
-- Exemple sous psql :
-- psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5432 -U postgres -d lmn24 \
--   -f database/seed_tv_countries_249.sql

BEGIN;
SELECT pg_advisory_xact_lock(241024, 193);

DO $preflight$
BEGIN
  IF to_regclass('public.country') IS NULL THEN
    RAISE EXCEPTION 'Table public.country absente : importer d''abord database/seed_country.sql';
  END IF;
  IF to_regclass('public.tv_country') IS NULL THEN
    RAISE EXCEPTION 'Table public.tv_country absente : installer/qualifier le schema Guide TV avant ce seed';
  END IF;
END
$preflight$;

-- Toutes les sources i18n disposent de 249 codes ISO2 identiques.
CREATE TEMP TABLE _lmn24_tv_country_seed (
  iso_code2 CHAR(2) PRIMARY KEY,
  reference_timezone VARCHAR(100) NOT NULL
) ON COMMIT DROP;

INSERT INTO _lmn24_tv_country_seed (iso_code2,reference_timezone)
VALUES
  ('AD', 'Europe/Andorra'),
  ('AE', 'Asia/Dubai'),
  ('AF', 'Asia/Kabul'),
  ('AG', 'America/Antigua'),
  ('AI', 'America/Anguilla'),
  ('AL', 'Europe/Tirane'),
  ('AM', 'Asia/Yerevan'),
  ('AO', 'Africa/Luanda'),
  ('AQ', 'Antarctica/McMurdo'),
  ('AR', 'America/Argentina/Buenos_Aires'),
  ('AS', 'Pacific/Pago_Pago'),
  ('AT', 'Europe/Vienna'),
  ('AU', 'Australia/Sydney'),
  ('AW', 'America/Aruba'),
  ('AX', 'Europe/Mariehamn'),
  ('AZ', 'Asia/Baku'),
  ('BA', 'Europe/Sarajevo'),
  ('BB', 'America/Barbados'),
  ('BD', 'Asia/Dhaka'),
  ('BE', 'Europe/Brussels'),
  ('BF', 'Africa/Ouagadougou'),
  ('BG', 'Europe/Sofia'),
  ('BH', 'Asia/Bahrain'),
  ('BI', 'Africa/Bujumbura'),
  ('BJ', 'Africa/Porto-Novo'),
  ('BL', 'America/St_Barthelemy'),
  ('BM', 'Atlantic/Bermuda'),
  ('BN', 'Asia/Brunei'),
  ('BO', 'America/La_Paz'),
  ('BQ', 'America/Kralendijk'),
  ('BR', 'America/Sao_Paulo'),
  ('BS', 'America/Nassau'),
  ('BT', 'Asia/Thimphu'),
  ('BV', 'Etc/UTC'),
  ('BW', 'Africa/Gaborone'),
  ('BY', 'Europe/Minsk'),
  ('BZ', 'America/Belize'),
  ('CA', 'America/Toronto'),
  ('CC', 'Indian/Cocos'),
  ('CD', 'Africa/Kinshasa'),
  ('CF', 'Africa/Bangui'),
  ('CG', 'Africa/Brazzaville'),
  ('CH', 'Europe/Zurich'),
  ('CI', 'Africa/Abidjan'),
  ('CK', 'Pacific/Rarotonga'),
  ('CL', 'America/Santiago'),
  ('CM', 'Africa/Douala'),
  ('CN', 'Asia/Shanghai'),
  ('CO', 'America/Bogota'),
  ('CR', 'America/Costa_Rica'),
  ('CU', 'America/Havana'),
  ('CV', 'Atlantic/Cape_Verde'),
  ('CW', 'America/Curacao'),
  ('CX', 'Indian/Christmas'),
  ('CY', 'Asia/Nicosia'),
  ('CZ', 'Europe/Prague'),
  ('DE', 'Europe/Berlin'),
  ('DJ', 'Africa/Djibouti'),
  ('DK', 'Europe/Copenhagen'),
  ('DM', 'America/Dominica'),
  ('DO', 'America/Santo_Domingo'),
  ('DZ', 'Africa/Algiers'),
  ('EC', 'America/Guayaquil'),
  ('EE', 'Europe/Tallinn'),
  ('EG', 'Africa/Cairo'),
  ('EH', 'Africa/El_Aaiun'),
  ('ER', 'Africa/Asmara'),
  ('ES', 'Europe/Madrid'),
  ('ET', 'Africa/Addis_Ababa'),
  ('FI', 'Europe/Helsinki'),
  ('FJ', 'Pacific/Fiji'),
  ('FK', 'Atlantic/Stanley'),
  ('FM', 'Pacific/Pohnpei'),
  ('FO', 'Atlantic/Faroe'),
  ('FR', 'Europe/Paris'),
  ('GA', 'Africa/Libreville'),
  ('GB', 'Europe/London'),
  ('GD', 'America/Grenada'),
  ('GE', 'Asia/Tbilisi'),
  ('GF', 'America/Cayenne'),
  ('GG', 'Europe/Guernsey'),
  ('GH', 'Africa/Accra'),
  ('GI', 'Europe/Gibraltar'),
  ('GL', 'America/Nuuk'),
  ('GM', 'Africa/Banjul'),
  ('GN', 'Africa/Conakry'),
  ('GP', 'America/Guadeloupe'),
  ('GQ', 'Africa/Malabo'),
  ('GR', 'Europe/Athens'),
  ('GS', 'Atlantic/South_Georgia'),
  ('GT', 'America/Guatemala'),
  ('GU', 'Pacific/Guam'),
  ('GW', 'Africa/Bissau'),
  ('GY', 'America/Guyana'),
  ('HK', 'Asia/Hong_Kong'),
  ('HM', 'Etc/UTC'),
  ('HN', 'America/Tegucigalpa'),
  ('HR', 'Europe/Zagreb'),
  ('HT', 'America/Port-au-Prince'),
  ('HU', 'Europe/Budapest'),
  ('ID', 'Asia/Jakarta'),
  ('IE', 'Europe/Dublin'),
  ('IL', 'Asia/Jerusalem'),
  ('IM', 'Europe/Isle_of_Man'),
  ('IN', 'Asia/Kolkata'),
  ('IO', 'Indian/Chagos'),
  ('IQ', 'Asia/Baghdad'),
  ('IR', 'Asia/Tehran'),
  ('IS', 'Atlantic/Reykjavik'),
  ('IT', 'Europe/Rome'),
  ('JE', 'Europe/Jersey'),
  ('JM', 'America/Jamaica'),
  ('JO', 'Asia/Amman'),
  ('JP', 'Asia/Tokyo'),
  ('KE', 'Africa/Nairobi'),
  ('KG', 'Asia/Bishkek'),
  ('KH', 'Asia/Phnom_Penh'),
  ('KI', 'Pacific/Tarawa'),
  ('KM', 'Indian/Comoro'),
  ('KN', 'America/St_Kitts'),
  ('KP', 'Asia/Pyongyang'),
  ('KR', 'Asia/Seoul'),
  ('KW', 'Asia/Kuwait'),
  ('KY', 'America/Cayman'),
  ('KZ', 'Asia/Almaty'),
  ('LA', 'Asia/Vientiane'),
  ('LB', 'Asia/Beirut'),
  ('LC', 'America/St_Lucia'),
  ('LI', 'Europe/Vaduz'),
  ('LK', 'Asia/Colombo'),
  ('LR', 'Africa/Monrovia'),
  ('LS', 'Africa/Maseru'),
  ('LT', 'Europe/Vilnius'),
  ('LU', 'Europe/Luxembourg'),
  ('LV', 'Europe/Riga'),
  ('LY', 'Africa/Tripoli'),
  ('MA', 'Africa/Casablanca'),
  ('MC', 'Europe/Monaco'),
  ('MD', 'Europe/Chisinau'),
  ('ME', 'Europe/Podgorica'),
  ('MF', 'America/Marigot'),
  ('MG', 'Indian/Antananarivo'),
  ('MH', 'Pacific/Majuro'),
  ('MK', 'Europe/Skopje'),
  ('ML', 'Africa/Bamako'),
  ('MM', 'Asia/Yangon'),
  ('MN', 'Asia/Ulaanbaatar'),
  ('MO', 'Asia/Macau'),
  ('MP', 'Pacific/Saipan'),
  ('MQ', 'America/Martinique'),
  ('MR', 'Africa/Nouakchott'),
  ('MS', 'America/Montserrat'),
  ('MT', 'Europe/Malta'),
  ('MU', 'Indian/Mauritius'),
  ('MV', 'Indian/Maldives'),
  ('MW', 'Africa/Blantyre'),
  ('MX', 'America/Mexico_City'),
  ('MY', 'Asia/Kuala_Lumpur'),
  ('MZ', 'Africa/Maputo'),
  ('NA', 'Africa/Windhoek'),
  ('NC', 'Pacific/Noumea'),
  ('NE', 'Africa/Niamey'),
  ('NF', 'Pacific/Norfolk'),
  ('NG', 'Africa/Lagos'),
  ('NI', 'America/Managua'),
  ('NL', 'Europe/Amsterdam'),
  ('NO', 'Europe/Oslo'),
  ('NP', 'Asia/Kathmandu'),
  ('NR', 'Pacific/Nauru'),
  ('NU', 'Pacific/Niue'),
  ('NZ', 'Pacific/Auckland'),
  ('OM', 'Asia/Muscat'),
  ('PA', 'America/Panama'),
  ('PE', 'America/Lima'),
  ('PF', 'Pacific/Tahiti'),
  ('PG', 'Pacific/Port_Moresby'),
  ('PH', 'Asia/Manila'),
  ('PK', 'Asia/Karachi'),
  ('PL', 'Europe/Warsaw'),
  ('PM', 'America/Miquelon'),
  ('PN', 'Pacific/Pitcairn'),
  ('PR', 'America/Puerto_Rico'),
  ('PS', 'Asia/Hebron'),
  ('PT', 'Europe/Lisbon'),
  ('PW', 'Pacific/Palau'),
  ('PY', 'America/Asuncion'),
  ('QA', 'Asia/Qatar'),
  ('RE', 'Indian/Reunion'),
  ('RO', 'Europe/Bucharest'),
  ('RS', 'Europe/Belgrade'),
  ('RU', 'Europe/Moscow'),
  ('RW', 'Africa/Kigali'),
  ('SA', 'Asia/Riyadh'),
  ('SB', 'Pacific/Guadalcanal'),
  ('SC', 'Indian/Mahe'),
  ('SD', 'Africa/Khartoum'),
  ('SE', 'Europe/Stockholm'),
  ('SG', 'Asia/Singapore'),
  ('SH', 'Atlantic/St_Helena'),
  ('SI', 'Europe/Ljubljana'),
  ('SJ', 'Arctic/Longyearbyen'),
  ('SK', 'Europe/Bratislava'),
  ('SL', 'Africa/Freetown'),
  ('SM', 'Europe/San_Marino'),
  ('SN', 'Africa/Dakar'),
  ('SO', 'Africa/Mogadishu'),
  ('SR', 'America/Paramaribo'),
  ('SS', 'Africa/Juba'),
  ('ST', 'Africa/Sao_Tome'),
  ('SV', 'America/El_Salvador'),
  ('SX', 'America/Lower_Princes'),
  ('SY', 'Asia/Damascus'),
  ('SZ', 'Africa/Mbabane'),
  ('TC', 'America/Grand_Turk'),
  ('TD', 'Africa/Ndjamena'),
  ('TF', 'Indian/Kerguelen'),
  ('TG', 'Africa/Lome'),
  ('TH', 'Asia/Bangkok'),
  ('TJ', 'Asia/Dushanbe'),
  ('TK', 'Pacific/Fakaofo'),
  ('TL', 'Asia/Dili'),
  ('TM', 'Asia/Ashgabat'),
  ('TN', 'Africa/Tunis'),
  ('TO', 'Pacific/Tongatapu'),
  ('TR', 'Europe/Istanbul'),
  ('TT', 'America/Port_of_Spain'),
  ('TV', 'Pacific/Funafuti'),
  ('TW', 'Asia/Taipei'),
  ('TZ', 'Africa/Dar_es_Salaam'),
  ('UA', 'Europe/Kyiv'),
  ('UG', 'Africa/Kampala'),
  ('UM', 'Pacific/Midway'),
  ('US', 'America/New_York'),
  ('UY', 'America/Montevideo'),
  ('UZ', 'Asia/Tashkent'),
  ('VA', 'Europe/Vatican'),
  ('VC', 'America/St_Vincent'),
  ('VE', 'America/Caracas'),
  ('VG', 'America/Tortola'),
  ('VI', 'America/St_Thomas'),
  ('VN', 'Asia/Ho_Chi_Minh'),
  ('VU', 'Pacific/Efate'),
  ('WF', 'Pacific/Wallis'),
  ('WS', 'Pacific/Apia'),
  ('YE', 'Asia/Aden'),
  ('YT', 'Indian/Mayotte'),
  ('ZA', 'Africa/Johannesburg'),
  ('ZM', 'Africa/Lusaka'),
  ('ZW', 'Africa/Harare');

-- Refus explicite si le seed ISO de LMN24 est incomplet : pas de succès silencieux.
DO $validate$
DECLARE missing_codes text;
BEGIN
  IF (SELECT count(*) FROM _lmn24_tv_country_seed) <> 249 THEN
    RAISE EXCEPTION 'Le seed pays TV ne contient pas exactement 249 codes';
  END IF;
  SELECT string_agg(s.iso_code2, ', ' ORDER BY s.iso_code2)
    INTO missing_codes
  FROM _lmn24_tv_country_seed s
  LEFT JOIN public.country c ON trim(c.iso_code2) = trim(s.iso_code2)
  WHERE c.id IS NULL;
  IF missing_codes IS NOT NULL THEN
    RAISE EXCEPTION 'Pays absents de public.country : %. Appliquer d''abord database/seed_country.sql', missing_codes;
  END IF;
END
$validate$;

INSERT INTO public.tv_country (country_id, is_active, reference_timezone)
SELECT c.id, FALSE, s.reference_timezone
FROM _lmn24_tv_country_seed s
JOIN public.country c ON trim(c.iso_code2) = trim(s.iso_code2)
ON CONFLICT (country_id) DO NOTHING;

-- Contrôle final transactionnel : toutes les entrées TV doivent exister.
DO $assert_complete$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM _lmn24_tv_country_seed s
  JOIN public.country c ON trim(c.iso_code2) = trim(s.iso_code2)
  JOIN public.tv_country tc ON tc.country_id = c.id;
  IF n <> 249 THEN
    RAISE EXCEPTION 'Insertion incomplète de tv_country : % / 249', n;
  END IF;
END
$assert_complete$;

COMMIT;

-- Résumé des enregistrements présents après traitement :
SELECT count(*) AS tv_pays_present,
       count(*) FILTER (WHERE tc.is_active) AS tv_pays_actifs,
       count(*) FILTER (WHERE NOT tc.is_active) AS tv_pays_inactifs
FROM public.tv_country tc
JOIN public.country c ON c.id=tc.country_id
WHERE trim(c.iso_code2) IN ('AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW');

-- Contrôle détaillé facultatif :
-- SELECT trim(c.iso_code2) AS iso2, tc.reference_timezone, tc.is_active
-- FROM public.tv_country tc JOIN public.country c ON c.id=tc.country_id
-- ORDER BY c.iso_code2;
