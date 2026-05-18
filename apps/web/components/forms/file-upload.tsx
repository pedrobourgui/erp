"use client";

import React, { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Upload, X, FileIcon, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ──────────────────────────────────────────────────────────────

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
  progress: number;
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
}

interface FileUploadProps {
  value?: UploadedFile[];
  onChange?: (files: UploadedFile[]) => void;
  onUpload?: (file: File) => Promise<string>;
  accept?: string;
  maxFiles?: number;
  maxSize?: number; // bytes
  multiple?: boolean;
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(type: string): boolean {
  return type.startsWith("image/");
}

// ─── Component ──────────────────────────────────────────────────────────

export function FileUpload({
  value = [],
  onChange,
  onUpload,
  accept,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB
  multiple = true,
  label,
  description,
  className,
  disabled = false,
  error,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const remaining = maxFiles - value.length;
      const toAdd = files.slice(0, remaining);

      const newFiles: UploadedFile[] = toAdd
        .filter((f) => f.size <= maxSize)
        .map((file) => ({
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          preview: isImageFile(file.type)
            ? URL.createObjectURL(file)
            : undefined,
          progress: 0,
          status: "idle" as const,
        }));

      const updated = [...value, ...newFiles];
      onChange?.(updated);

      // If upload handler provided, upload each file
      if (onUpload) {
        for (const uf of newFiles) {
          try {
            const idx = updated.findIndex((f) => f.id === uf.id);
            if (idx === -1) continue;
            updated[idx] = { ...updated[idx], status: "uploading", progress: 50 };
            onChange?.([...updated]);

            await onUpload(uf.file);

            updated[idx] = { ...updated[idx], status: "done", progress: 100 };
            onChange?.([...updated]);
          } catch {
            const idx = updated.findIndex((f) => f.id === uf.id);
            if (idx !== -1) {
              updated[idx] = {
                ...updated[idx],
                status: "error",
                progress: 0,
                error: "Falha no upload",
              };
              onChange?.([...updated]);
            }
          }
        }
      } else {
        // Mark all as done if no upload handler
        const done = updated.map((f) =>
          newFiles.find((n) => n.id === f.id)
            ? { ...f, status: "done" as const, progress: 100 }
            : f
        );
        onChange?.(done);
      }
    },
    [value, onChange, onUpload, maxFiles, maxSize]
  );

  const removeFile = useCallback(
    (id: string) => {
      const file = value.find((f) => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      onChange?.(value.filter((f) => f.id !== id));
    },
    [value, onChange]
  );

  const handleDrag = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true);
      } else if (e.type === "dragleave") {
        setDragActive(false);
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (disabled) return;
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [disabled, addFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles]
  );

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <label className="text-sm font-medium leading-none">{label}</label>
      )}

      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          disabled && "cursor-not-allowed opacity-50",
          error && "border-destructive"
        )}
      >
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          Arraste arquivos aqui ou clique para selecionar
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {description ??
            `Máximo ${maxFiles} arquivo${maxFiles > 1 ? "s" : ""}, até ${formatFileSize(maxSize)} cada`}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* File list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              {/* Preview / Icon */}
              {file.preview ? (
                <img
                  src={file.preview}
                  alt={file.name}
                  className="h-12 w-12 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                  <FileIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
                {/* Progress bar */}
                {file.status === "uploading" && (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
                {file.status === "error" && (
                  <p className="mt-0.5 text-xs text-destructive">
                    {file.error}
                  </p>
                )}
              </div>

              {/* Status / Remove */}
              <div className="flex items-center gap-2">
                {file.status === "uploading" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.id);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
