import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type WeatherStartPayload = { continentCode?: "EU" | "AS" | "AF" | "NA" | "SA" | "OC" | undefined };

export type WeatherRunView = {
  id: string;
  trigger: "MANUAL" | "AUTOMATIC";
  continentCode: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "ERROR" | "INTERRUPTED";
  totalCities: number;
  processedCities: number;
  successfulCities: number;
  failedCities: number;
  errorMessage: string | null;
};

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

  async startVideoRun(feedId?: string): Promise<{ accepted: boolean; runId: string }> {
    return this.startVideoBatch(feedId ? { feedId } : {});
  }

  async startVideoBatch(payload: ParserStartPayload & { feedId?: string }): Promise<{ accepted: boolean; runId: string }> {
    let response: Response;
    try {
      response = await fetch(this.parserUrl + "/video-runs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-parser-secret": this.sharedSecret },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException("Le service du parser vidéo est indisponible.");
    }
    if (!response.ok) {
      const message = await this.readMessage(response, "Le lancement du parser vidéo a échoué.");
      if (response.status === 409) throw new ConflictException(message);
      throw new BadGatewayException(message);
    }
    return await response.json() as { accepted: boolean; runId: string };
  }

  async openEvents(runId: string): Promise<Response> {
    return this.openRunEvents(runId, "runs");
  }

  async openVideoEvents(runId: string): Promise<Response> {
    return this.openRunEvents(runId, "video-runs");
  }

  private async openRunEvents(runId: string, resource: "runs" | "video-runs"): Promise<Response> {
    let response: Response;

    try {
      response = await fetch(
        this.parserUrl +
          "/" + resource + "/" +
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

  /** The weather parser remains internal: only NestJS forwards the shared secret. */
  async startWeatherRun(payload: WeatherStartPayload): Promise<{accepted:boolean;runId:string}> {
    return this.weatherRequest("/weather-runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async listWeatherRuns(): Promise<{items:WeatherRunView[]}> {
    return this.weatherRequest("/weather-runs");
  }

  async getWeatherRun(id:string): Promise<WeatherRunView> {
    return this.weatherRequest("/weather-runs/" + encodeURIComponent(id));
  }

  private async weatherRequest<T>(path:string, init:RequestInit={}):Promise<T> {
    let response:Response;
    try {
      response=await fetch(this.parserUrl + path, {
        ...init,
        headers: {
          ...init.headers,
          "x-parser-secret": this.sharedSecret,
        },
        cache:"no-store",
        signal:AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException("Le service du parser météo est indisponible.");
    }
    if(!response.ok) {
      const message=await this.readMessage(response,"Impossible de contacter le parser météo.");
      if(response.status===409)throw new ConflictException(message);
      if(response.status===404)throw new NotFoundException("Exécution météo introuvable.");
      throw new BadGatewayException(message);
    }
    try {
      return await response.json() as T;
    } catch {
      throw new BadGatewayException("Réponse du parser météo invalide.");
    }
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
