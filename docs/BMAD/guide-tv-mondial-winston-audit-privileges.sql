-- READ-ONLY catalog audit for LMN24 PostgreSQL. DO NOT GRANT/REVOKE.
-- Intended for disposable clone ONLY; no sensitive data returned.
-- Evaluates roles and effective privileges, including function PUBLIC EXECUTE.
BEGIN READ ONLY;
SELECT 'DB_INFO' AS section, current_database() AS object, version() AS detail;
SELECT 'ROLE' AS section, rolname AS object,
       'login='||rolcanlogin||'; super='||rolsuper||'; inherit='||rolinherit AS detail
FROM pg_roles WHERE rolname IN ('lmn24_app','tv_reader_ci','tv_writer_ci','postgres')
ORDER BY rolname;
SELECT 'TABLE_PRIV' AS section, r.rolname||' / '||n.nspname||'.'||c.relname AS object,
       'SELECT='||has_table_privilege(r.oid,c.oid,'SELECT')
       ||'; INSERT='||has_table_privilege(r.oid,c.oid,'INSERT')
       ||'; UPDATE='||has_table_privilege(r.oid,c.oid,'UPDATE')
       ||'; DELETE='||has_table_privilege(r.oid,c.oid,'DELETE') AS detail
FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE r.rolname IN ('lmn24_app','tv_reader_ci','tv_writer_ci')
AND c.relkind IN ('r','p') AND n.nspname='public'
AND c.relname IN ('parser_write_epoch','scheduler_config','scheduler_job',
                   'tv_schedule_current','tv_schedule_revision','tv_translation_provider')
ORDER BY r.rolname,c.relname;
SELECT 'FUNCTION_EXECUTE' AS section, p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS object,
       'public_execute='||EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS detail
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
 'assert_parser_write_epoch','tv_assert_current_writer_lease',
 'tv_assert_current_published','tv_protect_published_airings','tv_protect_published_revision')
ORDER BY p.proname;
SELECT 'SCHEMA' AS section, n.nspname AS object,
       'public_acl='||COALESCE(array_to_string(n.nspacl,','),'default') AS detail
FROM pg_namespace n WHERE n.nspname='public';
COMMIT;
