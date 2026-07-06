"use client";

import { loginSchema, type LoginFormData} from "@repo/validators"
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth.store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      await login(data.email, data.password);
      router.push("/");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(
        axiosError.response?.data?.message ||
          "Erro ao fazer login. Verifique suas credenciais."
      );
    }
  };

  return (
    <div className="gradient-mesh relative flex min-h-screen items-center justify-center p-4 overflow-hidden">
      {/* Decorative floating orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl animate-float" />
        <div className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-accent/5 blur-2xl animate-float" style={{ animationDelay: "3s" }} />
      </div>

      {/* Grain overlay */}
      <div className="grain-texture pointer-events-none absolute inset-0" />

      <div className="relative z-10 w-full max-w-[420px] animate-scale-in">
        <Card className="glass border-white/10 shadow-float backdrop-blur-xl bg-white/[0.03]">
          <CardHeader className="space-y-2 text-center pb-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent animate-pulse-glow">
              <span className="text-2xl font-bold text-white font-heading">
                E
              </span>
            </div>
            <CardTitle className="text-2xl font-bold text-white font-heading tracking-tight">
              ERP System
            </CardTitle>
            <CardDescription className="text-white/50 text-[0.9rem]">
              Entre com suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              {error && (
                <div className="animate-slide-down rounded-lg bg-danger/15 border border-danger/20 p-3.5 text-sm text-red-300">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium leading-none text-white/70"
                >
                  E-mail
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="h-11 bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-accent/50 focus-visible:border-accent/30"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-red-400">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium leading-none text-white/70"
                >
                  Senha
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="h-11 bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-accent/50 focus-visible:border-accent/30"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-sm text-red-400">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold shadow-lg shadow-accent/20 transition-all duration-200 hover:shadow-xl hover:shadow-accent/30 active:scale-[0.98]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Subtle bottom tagline */}
        <p className="mt-8 text-center text-xs text-white/25 animate-fade-in stagger-4">
          Plataforma de gestão para marketplaces
        </p>
      </div>
    </div>
  );
}
