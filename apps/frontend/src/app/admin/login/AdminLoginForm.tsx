"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import styles from "./login.module.css";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "L’adresse e-mail est obligatoire.")
    .email("Saisissez une adresse e-mail valide."),
  password: z.string().min(1, "Le mot de passe est obligatoire."),
});

type LoginValues = z.infer<typeof loginSchema>;

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 002.8 2.8" />
        <path d="M9.9 4.2A10.8 10.8 0 0112 4c5 0 9.3 3.1 11 8a12.7 12.7 0 01-2.4 4.1" />
        <path d="M6.6 6.6A12.2 12.2 0 001 12c1.7 4.9 6 8 11 8a11 11 0 005.4-1.4" />
      </svg>
    );
  }

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function AdminLoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginValues) => {
    clearErrors();

    const validation = loginSchema.safeParse(values);

    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const field = issue.path[0];

        if (field === "email" || field === "password") {
          setError(field, {
            type: "validate",
            message: issue.message,
          });
        }
      }

      return;
    }

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(validation.data),
        credentials: "same-origin",
      });

      if (!response.ok) {
        setError("root", {
          type: "server",
          message:
            response.status === 429
              ? "Trop de tentatives de connexion. Réessayez plus tard."
              : "Email ou mot de passe incorrect.",
        });
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("root", {
        type: "server",
        message: "Connexion impossible. Réessayez dans quelques instants.",
      });
    }
  };

  return (
    <main className="container d-flex min-vh-100 align-items-center justify-content-center py-4">
      <section
        className={"card border-0 shadow-sm " + styles.card}
        aria-labelledby="admin-login-title"
      >
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <Image
              src="/logo_lmn24.png"
              width={88}
              height={88}
              alt="LMN24"
              className={styles.logo}
              priority
              unoptimized
            />
            <h1 id="admin-login-title" className="h3 mt-3 mb-1">
              Administration LMN24
            </h1>
            <p className="text-body-secondary mb-0">
              Connectez-vous pour accéder à l’administration.
            </p>
          </div>

          {errors.root?.message ? (
            <div className="alert alert-danger" role="alert">
              {errors.root.message}
            </div>
          ) : null}

          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            <div className="mb-3">
              <label className="form-label" htmlFor="admin-email">
                Adresse e-mail
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                aria-required="true"
                aria-invalid={Boolean(errors.email)}
                className={"form-control " + (errors.email ? "is-invalid" : "")}
                disabled={isSubmitting}
                {...register("email")}
              />
              {errors.email?.message ? (
                <div className="invalid-feedback">{errors.email.message}</div>
              ) : null}
            </div>

            <div className="mb-4">
              <label className="form-label" htmlFor="admin-password">
                Mot de passe
              </label>
              <div className="input-group">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  aria-required="true"
                  aria-invalid={Boolean(errors.password)}
                  className={
                    "form-control " + (errors.password ? "is-invalid" : "")
                  }
                  disabled={isSubmitting}
                  {...register("password")}
                />
                <button
                  type="button"
                  className={"btn btn-outline-secondary " + styles.eyeButton}
                  aria-label={
                    showPassword
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  aria-pressed={showPassword}
                  disabled={isSubmitting}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <EyeIcon hidden={showPassword} />
                </button>
              </div>
              {errors.password?.message ? (
                <div className="invalid-feedback d-block">
                  {errors.password.message}
                </div>
              ) : null}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  />
                  Connexion…
                </>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
