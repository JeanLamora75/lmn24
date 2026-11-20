-- SCRUM-114 — READ-ONLY inventory on an authorized isolated PostgreSQL clone.
-- No credentials, tuples, sensitive business rows, writes, or DDL.
-- This is NOT permission to connect to production.
BEGIN READ ONLY;
SELECT 'POSTGRES_VERSION' AS section, current_setting('server_version') AS name, current_setting('server_version_num') AS detail;
SELECT 'EXTENSION' AS section, e.extname AS name, e.extversion AS detail
FROM pg_extension e ORDER BY e.extname;
SELECT 'SCHEMA' AS section, n.nspname AS name,
       'owner=' || pg_get_userbyid(n.nspowner) AS detail
FROM pg_namespace n WHERE n.nspname IN ('public','tv') ORDER BY n.nspname;
SELECT 'DATABASE_ROLE' AS section, r.rolname AS name,
       'login='||r.rolcanlogin||';super='||r.rolsuper||';inherit='||r.rolinherit AS detail
FROM pg_roles r WHERE r.rolname IN ('lmn24_app','postgres','tv_epg_writer','tv_public_reader','tv_admin_catalog')
ORDER BY r.rolname;
SELECT 'SCHEMA_OBJECT_COUNT' AS section, n.nspname || '.' || c.relkind::text AS name,
       count(*)::text AS detail
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')
GROUP BY n.nspname,c.relkind ORDER BY name;
SELECT 'TV_TABLE' AS section, c.relname AS name,
       'owner=' || pg_get_userbyid(c.relowner) AS detail
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname LIKE 'tv_%'
ORDER BY c.relname;
SELECT 'MIGRATION_LEDGER' AS section,
       to_regclass('public._prisma_migrations')::text AS name,
       CASE WHEN to_regclass('public._prisma_migrations') IS NULL
         THEN 'absent' ELSE 'present — inspect authorized migration history separately' END AS detail;
SELECT 'FUNCTION_EXECUTE' AS section, p.proname AS name,
       EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE')::text AS detail
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
('assert_parser_write_epoch','tv_assert_current_writer_lease',
 'tv_assert_current_published','tv_protect_published_revision','tv_protect_published_airings')
ORDER BY p.proname;
COMMIT;
