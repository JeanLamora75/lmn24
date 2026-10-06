import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOkResponse({ description: "Backend operational status" })
  getHealth() {
    return {
      status: "ok",
      service: "backend",
    };
  }
}
