import { ImageOff } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { ProductImageDetail } from "./types";

type ProductImagesCardProps = {
  images: ProductImageDetail[];
};

export function ProductImagesCard({ images }: ProductImagesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Imagens ({images.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {images.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <ImageOff className="h-10 w-10 md:h-8 md:w-8" />
            <p className="text-sm">Nenhuma imagem cadastrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image) => (
              <div
                key={image.id}
                className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
              >
                <Image
                  src={image.url}
                  alt={`Imagem do produto (posição ${image.position + 1})`}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />
                {image.isMain ? (
                  <Badge className="absolute left-2 top-2" variant="default">
                    Principal
                  </Badge>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
