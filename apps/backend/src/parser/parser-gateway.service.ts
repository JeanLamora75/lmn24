import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type ParserStartPayload = {
  countryIsoCode2?: string | undefined;
  languageIsoCode2?: string | undefined;
  categoryId?: string | undefined;
};

@Injectable()
export class ParserGatewayService {
  private readonly parserUrl: string;
  private readonly sharedSecret: string;

  constructor(configService: ConfigService) {
    this.parserUrl = configService
      .getOrThrow<string>("PARSER_INTERNAL_URL")
      .replace(/\/$/, "");
    this.sharedSecret =
      configService.getOrThrow<string>("PARSER_SHARED_SECRET");
  }

  async startRun(payload: ParserStartPayload): Promise<{ runId: string }> {
    let response: Response;

    try {
      response = await fetch(this.parserUrl + "/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-parser-secret": this.sharedSecret,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException(
        "Le service du parser est indisponible.",
      );
    }

    if (!response.ok) {
      const message = await this.readMessage(
        response,
        "Le lancement du parser a échoué.",
      );

      if (response.status === 409) {
        throw new ConflictException(message);
      }

      throw new BadGatewayException(message);
    }

    return (await response.json()) as { runId: string };
  }

  async openEvents(runId: string): Promise<Response> {
    let response: Response;

    try {
      response = await fetch(
        this.parserUrl +
          "/runs/" +
          encodeURIComponent(runId) +
          "/events",
        {
          headers: {
            "x-parser-secret": this.sharedSecret,
          },
          cache: "no-store",
        },
      );
    } catch {
      throw new BadGatewayException(
        "Le service du parser est indisponible.",
      );
    }

    if (response.status === 404) {
      throw new NotFoundException("Exécution du parser introuvable.");
    }

    if (!response.ok || !response.body) {
      throw new BadGatewayException(
        await this.readMessage(
          response,
          "Impossible de suivre l’exécution du parser.",
        ),
      );
    }

    return response;
  }

  private async readMessage(
    response: Response,
    fallback: string,
  ): Promise<string> {
    try {
      const payload = (await response.json()) as {
        message?: string;
      };

      return payload.message || fallback;
    } catch {
      return fallback;
    }
  }
}
