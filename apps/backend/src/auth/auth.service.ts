import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes } from "node:crypto";

import { DatabaseService } from "../database/database.service";
import {
  AUTH_FAILURE_MESSAGE,
  DEFAULT_SESSION_TTL_HOURS,
  LOGIN_RATE_LIMIT,
} from "./auth.constants";

export type AuthenticatedUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

export type LoginResult = {
  token: string;
  expiresAt: Date;
  maxAgeSeconds: number;
  user: AuthenticatedUser;
};

type LoginAttempt = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AuthService {
  private readonly sessionSecret: string;
  private readonly sessionTtlMs: number;
  private readonly loginAttempts = new Map<string, LoginAttempt>();

  constructor(
    private readonly database: DatabaseService,
    configService: ConfigService,
  ) {
    const sessionSecret = configService.get<string>("SESSION_SECRET")?.trim();

    if (!sessionSecret) {
      throw new Error("SESSION_SECRET is required for authentication.");
    }

    if (
      configService.get<string>("NODE_ENV") === "production" &&
      sessionSecret === "CHANGE_ME"
    ) {
      throw new Error("SESSION_SECRET must be changed in production.");
    }

    this.sessionSecret = sessionSecret;

    const configuredTtl = Number(
      configService.get<string>("SESSION_TTL_HOURS") ??
        DEFAULT_SESSION_TTL_HOURS,
    );
    const ttlHours =
      Number.isFinite(configuredTtl) && configuredTtl > 0
        ? configuredTtl
        : DEFAULT_SESSION_TTL_HOURS;

    this.sessionTtlMs = ttlHours * 60 * 60 * 1000;
  }

  async login(
    email: string,
    password: string,
    rateLimitKey: string,
  ): Promise<LoginResult> {
    this.assertNotRateLimited(rateLimitKey);

    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.database.prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });

    const passwordMatches = await this.verifyPassword(
      password,
      user?.passwordHash,
    );

    if (!user || !user.isActive || !passwordMatches) {
      this.recordFailure(rateLimitKey);
      throw new UnauthorizedException(AUTH_FAILURE_MESSAGE);
    }

    this.loginAttempts.delete(rateLimitKey);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlMs);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(token);

    await this.database.prisma.$transaction([
      this.database.prisma.session.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
      this.database.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      }),
    ]);

    return {
      token,
      expiresAt,
      maxAgeSeconds: Math.floor(this.sessionTtlMs / 1000),
      user: this.toAuthenticatedUser(user),
    };
  }

  async getUserFromSession(
    token: string | undefined,
  ): Promise<AuthenticatedUser | null> {
    if (!token) {
      return null;
    }

    const tokenHash = this.hashToken(token);
    const now = new Date();

    const session = await this.database.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !session.user.isActive
    ) {
      return null;
    }

    return this.toAuthenticatedUser(session.user);
  }

  private async verifyPassword(
    password: string,
    passwordHash?: string,
  ): Promise<boolean> {
    if (!passwordHash) {
      await this.database.prisma.$queryRaw`
        SELECT crypt(${password}, gen_salt('bf', 12))
      `;
      return false;
    }

    const rows = await this.database.prisma.$queryRaw<
      Array<{ valid: boolean | null }>
    >`
      SELECT crypt(${password}, ${passwordHash}) = ${passwordHash} AS "valid"
    `;

    return rows[0]?.valid === true;
  }

  private hashToken(token: string): string {
    return createHmac("sha256", this.sessionSecret)
      .update(token)
      .digest("hex");
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }

  private assertNotRateLimited(key: string): void {
    const attempt = this.loginAttempts.get(key);

    if (!attempt) {
      return;
    }

    if (attempt.resetAt <= Date.now()) {
      this.loginAttempts.delete(key);
      return;
    }

    if (attempt.count >= LOGIN_RATE_LIMIT.maxAttempts) {
      throw new HttpException(
        "Trop de tentatives de connexion. Réessayez plus tard.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailure(key: string): void {
    const now = Date.now();
    const current = this.loginAttempts.get(key);

    if (!current || current.resetAt <= now) {
      this.loginAttempts.set(key, {
        count: 1,
        resetAt: now + LOGIN_RATE_LIMIT.windowMs,
      });
      return;
    }

    current.count += 1;
    this.loginAttempts.set(key, current);
  }
}
