"use client";

import {
  checkPassword,
} from "@erp/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PasswordStrength } from "@/components/forms/password-strength";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useChangePassword } from "@/hooks/use-profile";
import { getApiErrorMessage } from "@/lib/api";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    // FN-25: mínimo de 6 sem complexidade nenhuma protegendo um ERP inteiro.
    // A política vem de @erp/validators — a mesma que a API aplica.
    newPassword: z
      .string()
      .max(72)
      .superRefine((value, ctx) => {
        const result = checkPassword(value);
        if (!result.valid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: result.message ?? "Senha inválida",
          });
        }
      }),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "A nova senha deve ser diferente da atual",
    path: ["newPassword"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function PasswordForm() {
  const changePassword = useChangePassword();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (data: PasswordFormValues) => {
    try {
      await changePassword.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      addToast("Senha alterada com sucesso!", "success");
      reset();
    } catch (error) {
      addToast(
        getApiErrorMessage(error) ?? "Erro ao trocar a senha. Tente novamente.",
        "error"
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trocar senha</CardTitle>
      </CardHeader>
      <CardContent>
        {/* FN-26: noValidate tira a validação nativa do browser, que aparece em
            inglês e ignora as mensagens do zod. */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1">
            <label className="text-sm font-medium">Senha atual *</label>
            <Input type="password" autoComplete="current-password" {...register("currentPassword")} />
            {errors.currentPassword ? <p className="text-xs text-destructive">{errors.currentPassword.message}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nova senha *</label>
              <Input type="password" autoComplete="new-password" {...register("newPassword")} />
              <PasswordStrength password={watch("newPassword") ?? ""} />
              {errors.newPassword ? <p className="text-xs text-destructive">{errors.newPassword.message}</p> : null}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Confirmar nova senha *</label>
              <Input type="password" autoComplete="new-password" {...register("confirmPassword")} />
              {errors.confirmPassword ? <p className="text-xs text-destructive">{errors.confirmPassword.message}</p> : null}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Trocar senha
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
