"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useUpdateProfile } from "@/hooks/use-profile";
import { getApiErrorMessage } from "@/lib/api";
import { maskPhone } from "@/lib/masks";


const profileSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(255),
  email: z.string().email("Informe um e-mail válido").max(255),
  phone: z.string().max(20).optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type ProfileFormProps = {
  defaultValues: { name: string; email: string; phone: string };
};

export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const updateProfile = useUpdateProfile();
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const phone = watch("phone");

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      await updateProfile.mutateAsync({
        name: data.name,
        email: data.email,
        phone: data.phone || undefined,
      });
      addToast("Perfil atualizado com sucesso!", "success");
    } catch (error) {
      addToast(
        getApiErrorMessage(error) ?? "Erro ao atualizar o perfil. Tente novamente.",
        "error"
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados cadastrais</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4"
          noValidate
        >
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome *</label>
            <Input {...register("name")} maxLength={255} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">E-mail *</label>
              <Input type="email" {...register("email")} maxLength={255} />
              {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Telefone</label>
              <Input
                value={phone ?? ""}
                onChange={(e) =>
                  setValue("phone", maskPhone(e.target.value), {
                    shouldValidate: true,
                  })
                }
                placeholder="(00) 00000-0000"
                maxLength={20}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar alterações
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
