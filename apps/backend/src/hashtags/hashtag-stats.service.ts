import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { rebuildHashtagHourlyCounts, type RebuildResult } from "@lmn24/database";
import { DatabaseService } from "../database/database.service";
import { HashtagTrendsService } from "./hashtag-trends.service";

/**
 * Coalesced, best-effort immediate rebuild after a subject/alias edit.
 * A full daily parser reconciliation repairs changes missed during a backend
 * restart or an interrupted worker; no ephemeral state is source of truth.
 */
@Injectable()
export class HashtagStatsService implements OnModuleDestroy {
  private readonly logger = new Logger(HashtagStatsService.name);
  private readonly queued = new Set<string>();
  private readonly latest = new Map<string, { finishedAt: string; result?: RebuildResult; error?: string }>();
  private running = false;
  private stopped = false;

  constructor(private readonly db: DatabaseService, private readonly trends: HashtagTrendsService) {}

  enqueue(hashtagId: string): void {
    this.queued.add(hashtagId);
    if (!this.running && !this.stopped) void this.drain();
  }

  getStatus(hashtagId: string) {
    return {
      queued: this.queued.has(hashtagId),
      busy: this.running,
      latest: this.latest.get(hashtagId) ?? null,
    };
  }

  private async drain() {
    this.running = true;
    try {
      while (!this.stopped && this.queued.size) {
        const id = this.queued.values().next().value!;
        this.queued.delete(id);
        try {
          const result = await rebuildHashtagHourlyCounts(this.db.prisma, { hashtagId: id });
          this.latest.set(id, { finishedAt: new Date().toISOString(), result });
          this.trends.invalidate();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erreur inconnue";
          this.latest.set(id, { finishedAt: new Date().toISOString(), error: message });
          this.logger.error("Hashtag rebuild failed (" + id + "): " + message);
        }
      }
    } finally {
      this.running = false;
    }
  }

  onModuleDestroy(): void {
    this.stopped = true;
  }
}
