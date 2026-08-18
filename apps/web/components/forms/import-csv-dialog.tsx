"use client";

import { Loader2, Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  useUploadImport,
  useImportJob,
  type ImportDomain,
  type ImportStatus,
} from "@/hooks/use-imports";
import { getMutationErrorMessage } from "@/lib/mutation-error";

const COLUMNS: Record<ImportDomain, string> = {
  products: "sku, name, salePrice, costPrice, description, ncm, ean",
  customers: "name, email, phone, document",
  expenses: "description, amount, dueDate",
};

const STATUS_META: Record<ImportStatus, { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }> = {
  PENDING: { label: "Na fila", variant: "secondary" },
  PROCESSING: { label: "Processando", variant: "warning" },
  COMPLETED: { label: "Concluído", variant: "success" },
  COMPLETED_WITH_ERRORS: { label: "Concluído com erros", variant: "warning" },
  FAILED: { label: "Falhou", variant: "destructive" },
};

type ImportCsvDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: ImportDomain;
  title: string;
  onCompleted?: () => void;
};

export function ImportCsvDialog({ open, onOpenChange, domain, title, onCompleted }: ImportCsvDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadImport();
  const { addToast } = useToast();
  const [jobId, setJobId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const { data: job } = useImportJob(jobId);

  useEffect(() => {
    if (open) {
      setJobId(null);
      setFileName(null);
    }
  }, [open]);

  const isDone =
    job && ["COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"].includes(job.status);

  useEffect(() => {
    if (isDone) {onCompleted?.();}
  }, [isDone, onCompleted]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setFileName(file.name);
    try {
      const created = await upload.mutateAsync({ domain, file });
      setJobId(created.id);
      addToast("Arquivo enviado! Processando em segundo plano.", "success");
    } catch (error) {
      addToast(
        getMutationErrorMessage(
          error,
          error instanceof Error ? error.message : "Erro ao enviar arquivo."
        ),
        "error"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV. O processamento ocorre em segundo plano e cada
            linha é validada individualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <span className="font-medium">Colunas esperadas:</span> {COLUMNS[domain]}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFile}
          />
          {!jobId && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Selecionar arquivo CSV
            </Button>
          )}

          {job ? <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{fileName ?? job.fileName}</span>
                </div>
                <Badge variant={STATUS_META[job.status].variant}>
                  {STATUS_META[job.status].label}
                </Badge>
              </div>

              {isDone ? <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-lg border p-2">
                    <p className="text-xs text-muted-foreground">Linhas</p>
                    <p className="font-bold">{job.totalRows}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-xs text-muted-foreground">Importadas</p>
                    <p className="font-bold text-emerald-600">{job.successRows}</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-xs text-muted-foreground">Com erro</p>
                    <p className="font-bold text-destructive">{job.errorRows}</p>
                  </div>
                </div> : null}

              {isDone && job.errorRows === 0 ? <p className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Importação concluída sem erros.
                </p> : null}

              {job.errors && job.errors.length > 0 ? <div className="max-h-48 overflow-y-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 border-b bg-muted/60">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Linha</th>
                        <th className="px-3 py-2 text-left font-medium">Erro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.errors.map((err, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-1.5 tabular-nums">{err.line}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-destructive" />
                              {err.message}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div> : null}
            </div> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>
            {isDone ? "Fechar" : "Cancelar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
