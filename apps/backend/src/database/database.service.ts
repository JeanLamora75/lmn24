import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPrismaClient, type DatabaseClient } from "@lmn24/database";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  readonly prisma: DatabaseClient;

  constructor(configService: ConfigService) {
    this.prisma = createPrismaClient(
      configService.getOrThrow<string>("DATABASE_URL"),
    );
  }

  async onModuleInit(): Promise<void> {
    await this.prisma.$connect();
    this.logger.log("Connected to PostgreSQL through Prisma");
  }

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
