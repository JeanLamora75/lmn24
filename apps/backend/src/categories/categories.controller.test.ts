import {
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import { AuthService } from "../auth/auth.service";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { PublicHomeCategoriesController } from "./public-home-categories.controller";

const ID = "11111111-1111-4111-8111-111111111111";
const request = { headers: { cookie: "lmn24_session=example-session" } };

function setup(authenticated = true) {
  const service = {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue({ id: ID }),
    updateHomeDisplay: vi.fn().mockResolvedValue({ id: ID }),
    reorder: vi.fn().mockResolvedValue([]),
    listPublicHomeCategories: vi.fn().mockResolvedValue([]),
  };
  const auth = {
    getUserFromSession: vi.fn().mockResolvedValue(
      authenticated ? { id: ID } : null,
    ),
  };
  const config = { get: vi.fn().mockReturnValue(undefined) };
  const controller = new CategoriesController(
    service as unknown as CategoriesService,
    auth as unknown as AuthService,
    config as unknown as ConfigService,
  );
  return { service, auth, controller };
}

describe("CategoriesController / SCRUM-25", () => {
  it("n'autorise pas une session absente", async () => {
    const { controller, service } = setup(false);
    await expect(controller.list(request)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(service.list).not.toHaveBeenCalled();
  });

  it("normalise la couleur hexadécimale avant sauvegarde", async () => {
    const { controller, service } = setup();
    await controller.saveHomeDisplay(request, ID, {
      layoutType: "CAROUSEL",
      themeColor: "#aabbcc",
    });
    expect(service.updateHomeDisplay).toHaveBeenCalledWith(
      ID, "CAROUSEL", "#AABBCC",
    );
  });

  it("rejette un layout inconnu et les propriétés imprévues", async () => {
    const { controller, service } = setup();
    await expect(
      controller.saveHomeDisplay(request, ID, {
        layoutType: "UNKNOWN", themeColor: "#123ABC",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.saveHomeDisplay(request, ID, {
        layoutType: "GRID", themeColor: "#123ABC", isActive: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.updateHomeDisplay).not.toHaveBeenCalled();
  });

  it("rejette les UUID invalides et les corps de classement incorrects", async () => {
    const { controller, service } = setup();
    await expect(controller.getById(request, "invalid")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      controller.saveHomeOrder(request, {
        categoryIds: ["bad"], expectedOrder: [ID],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.reorder).not.toHaveBeenCalled();
  });

  it("transmet le classement complet au service", async () => {
    const { controller, service } = setup();
    await controller.saveHomeOrder(request, {
      categoryIds: [ID],
      expectedOrder: [ID],
    });
    expect(service.reorder).toHaveBeenCalledWith([ID], [ID]);
  });
});

describe("PublicHomeCategoriesController / SCRUM-25", () => {
  it("retourne les métadonnées sans authentification", async () => {
    const { service } = setup(false);
    const controller = new PublicHomeCategoriesController(
      service as unknown as CategoriesService,
    );
    await expect(controller.list()).resolves.toEqual({ items: [] });
    expect(service.listPublicHomeCategories).toHaveBeenCalledOnce();
  });
});
