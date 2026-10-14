import {
  BadRequestException, ConflictException, Injectable, ServiceUnavailableException,
} from "@nestjs/common";
import {
  isRetentionSettingKey, RETENTION_MAX_DAYS, RETENTION_SETTING_KEYS,
  type RetentionSettingKey,
} from "@lmn24/contracts";
import { DatabaseService } from "../database/database.service";

export type RetentionValues = Record<RetentionSettingKey, number>;

function parseDays(key: string, value: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > RETENTION_MAX_DAYS) {
    throw new ServiceUnavailableException("Durée de conservation invalide en base : " + key + ".");
  }
  return number;
}

@Injectable()
export class RetentionSettingsService {
  constructor(private readonly database: DatabaseService) {}

  /** Never hide missing or invalid seeded rows behind hard-coded defaults. */
  async getAll(): Promise<{ values: RetentionValues }> {
    const rows = await this.database.prisma.setting.findMany({
      where: {
        scope: "GLOBAL", scopeId: null,
        key: { in: [...RETENTION_SETTING_KEYS] },
      },
      select: { key: true, value: true, type: true },
    });
    const indexed = new Map(rows.map((row) => [row.key, row]));
    const values = {} as RetentionValues;
    for (const key of RETENTION_SETTING_KEYS) {
      const row = indexed.get(key);
      if (!row || row.type !== "INTEGER") {
        throw new ServiceUnavailableException(
          "Paramètre manquant ou invalide : " + key +
          ". Exécutez database/seed_retention_settings.sql.",
        );
      }
      values[key] = parseDays(key, row.value);
    }
    return { values };
  }

  /** Optimistic concurrency ensures another administrator's changes are not overwritten.
   * Only the requested GLOBAL INTEGER row is updated; no deletion is performed.
   */
  async updateOne(request: {
    key: string;
    days: number;
    expectedDays: number;
    confirmDecrease: boolean;
  }): Promise<{ key: RetentionSettingKey; days: number }> {
    const { key, days, expectedDays, confirmDecrease } = request;
    if (!isRetentionSettingKey(key)) {
      throw new BadRequestException("Clé de conservation inconnue.");
    }
    if (![days, expectedDays].every((n) =>
      Number.isSafeInteger(n) && n >= 1 && n <= RETENTION_MAX_DAYS)) {
      throw new BadRequestException(
        "La durée et la valeur précédente doivent être des entiers de 1 à " +
        RETENTION_MAX_DAYS + " jours.",
      );
    }
    const row = await this.database.prisma.setting.findFirst({
      where: { key, scope: "GLOBAL", scopeId: null },
      select: { value: true, type: true },
    });
    if (!row || row.type !== "INTEGER") {
      throw new ServiceUnavailableException(
        "Paramètre non initialisé : " + key + ". Exécutez le script de seed.",
      );
    }
    const currentDays = parseDays(key, row.value);
    if (currentDays !== expectedDays) {
      throw new ConflictException(
        "Ce paramètre a été modifié par un autre administrateur. Rechargez la page.",
      );
    }
    if (days < currentDays && confirmDecrease !== true) {
      throw new BadRequestException(
        "Confirmez la réduction : les données expirées pourront être supprimées " +
        "irréversiblement lors du prochain cycle de purge.",
      );
    }
    if (days === currentDays) return { key, days };

    const updated = await this.database.prisma.setting.updateMany({
      where: { key, scope: "GLOBAL", scopeId: null, type: "INTEGER", value: row.value },
      data: { value: String(days) },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        "Le paramètre a changé pendant l'enregistrement. Rechargez la page.",
      );
    }
    return { key, days };
  }
}
