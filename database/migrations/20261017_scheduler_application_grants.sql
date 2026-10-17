-- Idempotent privileges for the existing LMN24 application role.
-- Execute after scheduler foundations, ownership and write-fence migrations.
BEGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.scheduler_config, public.scheduler_job, public.parser_write_epoch TO lmn24_app;
GRANT EXECUTE ON FUNCTION public.assert_parser_write_epoch(uuid) TO lmn24_app;
COMMIT;
