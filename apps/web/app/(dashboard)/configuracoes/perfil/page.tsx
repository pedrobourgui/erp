"use client";

import { Loader2 } from "lucide-react";
import { useProfileQuery } from "@/hooks/use-profile";
import { AvatarUploader } from "./_components/avatar-uploader";
import { ProfileForm } from "./_components/profile-form";
import { PasswordForm } from "./_components/password-form";

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfileQuery();

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Não foi possível carregar o perfil.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meu perfil</h1>
        <p className="text-muted-foreground">
          Gerencie seus dados de conta, avatar e senha.
        </p>
      </div>

      <AvatarUploader name={profile.name} avatarUrl={profile.avatar} />

      <ProfileForm
        defaultValues={{
          name: profile.name,
          email: profile.email,
          phone: profile.phone ?? "",
        }}
      />

      <PasswordForm />
    </div>
  );
}
