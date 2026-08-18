"use client";

import { checkPassword } from "@erp/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PasswordStrength } from "@/components/forms/password-strength";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useInvalidSubmit } from "@/hooks/use-invalid-submit";
import api from "@/lib/api";
import { getMutationErrorMessage } from "@/lib/mutation-error";
import { useAuthStore } from "@/stores/auth.store";

// FN-25: the same policy the API enforces, from the same package — a form that
// accepts what the backend refuses is a dead end with no explanation.
const acceptSchema = z
  .object({
    name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(255, "Nome muito longo"),
    password: z.string().min(1, "Senha é obrigatória"),
    confirmPassword: z.string().min(1, "Confirme a senha"),
  })
  .superRefine((data, ctx) => {
    const check = checkPassword(data.password, [data.name]);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: check.message ?? "Senha inválida",
      });
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "As senhas não conferem",
      });
    }
  });

type AcceptFormValues = z.infer<typeof acceptSchema>;

/**
 * Invite acceptance (FN-08).
 *
 * Lives outside the `(auth)` route group on purpose: that layout bounces an
 * authenticated visitor to `/`, which would make an admin unable to open the
 * link they just generated to check it.
 */
export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AcceptFormValues>({
    resolver: zodResolver(acceptSchema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  });
  const onInvalid = useInvalidSubmit();

  const password = watch("password");

  const onSubmit = async (values: AcceptFormValues) => {
    try {
      const { data } = await api.post("/auth/accept-invite", {
        token: params.token,
        name: values.name,
        password: values.password,
      });

      const { accessToken, refreshToken } = data.data;
      localStorage.setItem("erp_token", accessToken);
      localStorage.setItem("erp_refresh_token", refreshToken);
      useAuthStore.getState().hydrate();

      addToast("Conta criada com sucesso! Bem-vindo.", "success");
      router.replace("/");
    } catch (err) {
      addToast(
        getMutationErrorMessage(
          err,
          "Não foi possível aceitar o convite. Ele pode ter expirado."
        ),
        "error"
      );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aceitar convite</CardTitle>
          <CardDescription>
            Defina seu nome e sua senha para acessar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4" noValidate>
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome completo *</label>
              <Input {...register("name")} placeholder="Seu nome" maxLength={255} />
              {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Senha *</label>
              <Input {...register("password")} type="password" placeholder="••••••••" />
              {errors.password ? (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              ) : null}
              <PasswordStrength password={password ?? ""} />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Confirmar senha *</label>
              <Input {...register("confirmPassword")} type="password" placeholder="••••••••" />
              {errors.confirmPassword ? (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Criar conta
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
