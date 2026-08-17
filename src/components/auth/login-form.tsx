"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const LoginForm = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) {
        setError(payload.error?.message ?? "No se pudo iniciar sesi\u00f3n.");
        return;
      }
      router.replace("/");
    } catch {
      setError("No se pudo conectar con el servidor. Intent\u00e1 nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium">
          Nombre de usuario
        </label>
        <div className="relative">
          <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="Ingresá tu usuario"
            required
            disabled={isSubmitting}
            className="h-12 rounded-xl border-black/10 bg-[#f6f5f2] pr-3 pl-10 shadow-none transition-colors focus-visible:bg-white"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Ingresá tu contraseña"
            required
            disabled={isSubmitting}
            className="h-12 rounded-xl border-black/10 bg-[#f6f5f2] pr-11 pl-10 shadow-none transition-colors focus-visible:bg-white"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute top-1/2 right-2.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="h-12 w-full rounded-xl text-base shadow-[0_14px_30px_-16px_rgba(229,37,42,0.75)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_35px_-16px_rgba(229,37,42,0.65)]"
      >
        {isSubmitting ? "Ingresando..." : "Ingresar"}
      </Button>

      <p className="text-center text-xs leading-5 text-muted-foreground">
        Si no podés acceder, contactá al dueño de Bastardos para revisar tu
        cuenta.
      </p>
    </form>
  );
};
