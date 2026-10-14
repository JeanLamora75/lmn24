/** Eight independently configurable retention durations, in whole days.
 * Database rows are seeded by database/seed_retention_settings.sql.
 * Changing a setting NEVER deletes data; SCRUM-57 handles the purge jobs.
 */
export const RETENTION_SETTING_KEYS = [
  "retentionArticlesDays",
  "retentionVideosDays",
  "retentionInfoParserRunsDays",
  "retentionVideoParserRunsDays",
  "retentionInfoParserLogsDays",
  "retentionVideoParserLogsDays",
  "retentionBackendLogsDays",
  "retentionHashtagHourlyCountsDays",
] as const;

export type RetentionSettingKey = typeof RETENTION_SETTING_KEYS[number];

export const RETENTION_DEFAULTS: Readonly<Record<RetentionSettingKey, number>> = {
  retentionArticlesDays: 60,
  retentionVideosDays: 60,
  retentionInfoParserRunsDays: 14,
  retentionVideoParserRunsDays: 14,
  retentionInfoParserLogsDays: 7,
  retentionVideoParserLogsDays: 7,
  retentionBackendLogsDays: 7,
  retentionHashtagHourlyCountsDays: 60,
};

export const RETENTION_MAX_DAYS = 3650;

export function isRetentionSettingKey(value: string): value is RetentionSettingKey {
  return (RETENTION_SETTING_KEYS as readonly string[]).includes(value);
}
