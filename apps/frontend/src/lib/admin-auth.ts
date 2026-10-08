import { cookies } from "next/headers";

const DEFAULT_SESSION_COOKIE_NAME = "lmn24_session";

export type AdminSessionUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

function getBackendUrl(): string {
  return (
    process.env.BACKEND_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

function getSessionCookieName(): string {
  return (
    process.env.SESSION_COOKIE_NAME?.trim() || DEFAULT_SESSION_COOKIE_NAME
  );
}

export async function getAdminSession(): Promise<AdminSessionUser | null> {
  const cookieStore = await cookies();
  const cookieName = getSessionCookieName();
  const token = cookieStore.get(cookieName)?.value;

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(getBackendUrl() + "/auth/session", {
      headers: {
        cookie: cookieName + "=" + token,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      user?: AdminSessionUser;
    };

    return payload.user ?? null;
  } catch {
    return null;
  }
}
