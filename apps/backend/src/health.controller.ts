import type { HealthResponse } from "@lmn24/contracts";
import {
  Controller,
  Get,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";

import { DatabaseService } from "./database/database.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  @ApiOkResponse({ description: "Backend and database operational status" })
  @ApiServiceUnavailableResponse({ description: "Database unavailable" })
  async getHealth(): Promise<HealthResponse> {
    try {
      await this.databaseService.ping();

      return {
        status: "ok",
        service: "backend",
        database: "up",
      };
    } catch {
      const response: HealthResponse = {
        status: "error",
        service: "backend",
        database: "down",
      };

      throw new ServiceUnavailableException(response);
    }
  }
}
