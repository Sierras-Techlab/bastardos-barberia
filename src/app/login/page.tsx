import type { Metadata } from "next";
import Image from "next/image";
import { BarChart3, CircleDollarSign, Users } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Acceso al sistema de gestión interna de Bastardos Barbería.",
};

const features = [
  { label: "Ventas", icon: CircleDollarSign },
  { label: "Clientes", icon: Users },
  { label: "Reportes", icon: BarChart3 },
];

const LoginPage = () => {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#d8d7d3] p-3 sm:p-5 lg:p-7">
      <section className="grid min-h-[calc(100svh-1.5rem)] w-full max-w-[1380px] overflow-hidden rounded-[2rem] bg-white shadow-[0_35px_100px_-45px_rgba(0,0,0,0.4)] sm:min-h-[calc(100svh-2.5rem)] lg:min-h-[760px] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden overflow-hidden bg-[#19191b] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -top-32 -right-24 size-96 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute -bottom-36 -left-24 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute top-1/2 right-12 h-44 w-32 -translate-y-1/2 rotate-12 rounded-[2rem] bg-primary shadow-2xl" />
          <div className="absolute top-[44%] right-40 h-36 w-24 -translate-y-1/2 -rotate-6 rounded-[1.75rem] border border-white/15 bg-white/5 backdrop-blur" />

          <Image
            src="/brand/bastardos-logo.png"
            alt="Bastardos Barbería"
            width={230}
            height={85}
            priority
            className="relative h-auto w-52"
          />

          <div className="relative max-w-lg">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Gestión interna
            </p>
            <h1 className="text-4xl font-semibold leading-[1.02] tracking-[-0.045em] xl:text-5xl">
              Toda la barbería, en un solo lugar.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/55 xl:text-base">
              Administrá ventas, clientes, productos y resultados desde una
              experiencia pensada para Bastardos.
            </p>
          </div>

          <div className="relative flex gap-3">
            {features.map((feature) => (
              <div
                key={feature.label}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 backdrop-blur"
              >
                <feature.icon className="size-3.5 text-primary" />
                {feature.label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-full flex-col bg-[#f8f7f4]">
          <div className="flex items-center justify-center border-b border-black/5 px-6 py-6 lg:hidden">
            <div className="rounded-2xl bg-[#19191b] px-6 py-3">
              <Image
                src="/brand/bastardos-logo.png"
                alt="Bastardos Barbería"
                width={180}
                height={66}
                priority
                className="h-auto w-36"
              />
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
            <div className="w-full max-w-md">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <span className="size-1.5 rounded-full bg-primary" />
                Acceso interno
              </span>
              <h2 className="mt-6 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Bienvenido
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Ingresá con el usuario y la contraseña proporcionados por el
                dueño.
              </p>

              <LoginForm />
            </div>
          </div>

          <p className="px-6 pb-6 text-center text-[11px] text-muted-foreground">
            Sistema interno de Bastardos · Acceso únicamente autorizado
          </p>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
