"use client";

import { Loader2, Upload, User as UserIcon } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useUploadAvatar } from "@/hooks/use-profile";
import { getMutationErrorMessage } from "@/lib/mutation-error";

type AvatarUploaderProps = {
  name: string;
  avatarUrl?: string | null;
};

export function AvatarUploader({ name, avatarUrl }: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadAvatar = useUploadAvatar();
  const { addToast } = useToast();
  const [preview, setPreview] = useState<string | null>(avatarUrl ?? null);

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      addToast("O avatar deve ser uma imagem.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast("A imagem deve ter no máximo 5 MB.", "error");
      return;
    }

    try {
      const profile = await uploadAvatar.mutateAsync(file);
      setPreview(profile.avatar ?? null);
      addToast("Avatar atualizado com sucesso!", "success");
    } catch (error) {
      addToast(
        getMutationErrorMessage(
          error,
          error instanceof Error ? error.message : "Erro ao enviar o avatar."
        ),
        "error"
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avatar</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <div className="relative h-20 w-20 overflow-hidden rounded-full border bg-muted">
          {preview ? (
            <Image
              src={preview}
              alt="Avatar"
              fill
              unoptimized
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
              {initials || <UserIcon className="h-10 w-10 md:h-8 md:w-8" />}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploadAvatar.isPending}
          >
            {uploadAvatar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Enviar imagem
          </Button>
          <p className="text-xs text-muted-foreground">PNG ou JPG, até 5 MB.</p>
        </div>
      </CardContent>
    </Card>
  );
}
