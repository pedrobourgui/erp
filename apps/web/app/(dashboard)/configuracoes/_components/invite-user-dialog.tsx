"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useInvalidSubmit } from "@/hooks/use-invalid-submit";
import { useInviteUser, useRoles } from "@/hooks/use-users";
import { getMutationErrorMessage } from "@/lib/mutation-error";

const inviteSchema = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido").max(255, "E-mail muito longo"),
  roleId: z.string().min(1, "Selecione um perfil"),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Invite dialog (FN-08).
 *
 * The role list comes from `GET /users/roles`: the previous version offered
 * four invented slugs (`admin | manager | operator | viewer`) while
 * `POST /users/invite` requires a real `roleId` from this tenant — every one of
 * those invites would have been rejected with 400.
 *
 * There is no e-mail service yet, so the generated link is shown for the admin
 * to send. Swallowing it would make "Enviar Convite" a second silent no-op.
 */
export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const inviteUser = useInviteUser();
  const { addToast } = useToast();
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", roleId: "" },
  });
  const onInvalid = useInvalidSubmit();

  const close = () => {
    reset();
    setInviteLink(null);
    setCopied(false);
    onOpenChange(false);
  };

  const onSubmit = async (values: InviteFormValues) => {
    try {
      const result = await inviteUser.mutateAsync(values);
      setInviteLink(`${window.location.origin}/convite/${result.token}`);
      addToast(`Convite gerado para ${result.email}.`, "success");
    } catch (err) {
      addToast(
        getMutationErrorMessage(err, "Erro ao enviar o convite."),
        "error"
      );
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) {return;}
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      addToast("Não foi possível copiar. Selecione o link manualmente.", "error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar Usuário</DialogTitle>
          <DialogDescription>
            {inviteLink
              ? "Envie o link abaixo para o convidado. Ele expira em 48 horas."
              : "Envie um convite para um novo membro da equipe."}
          </DialogDescription>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input readOnly value={inviteLink} className="font-mono text-xs" />
              <Button type="button" variant="secondary" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={close}>Concluir</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4" noValidate>
            <div className="space-y-1">
              <label className="text-sm font-medium">E-mail *</label>
              <Input {...register("email")} type="email" placeholder="email@exemplo.com" maxLength={255} />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Perfil *</label>
              <Controller
                name="roleId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={rolesLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={rolesLoading ? "Carregando perfis..." : "Selecione o perfil"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(roles ?? []).map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.roleId ? <p className="text-xs text-destructive">{errors.roleId.message}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="cancel" onClick={close}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting || inviteUser.isPending}>
                {inviteUser.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar Convite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
