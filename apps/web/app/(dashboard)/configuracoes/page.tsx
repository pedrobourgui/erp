"use client";

import { 
  companySchema, type CompanyFormValues,
  inviteSchema, type InviteFormValues
} from "@repo/validators";
import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Save, UserPlus, Loader2, Building2, Users, CreditCard } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

// ─── Tabs ───────────────────────────────────────────────────────────────

const tabs = [
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "plano", label: "Plano", icon: CreditCard },
] as const;

type TabId = (typeof tabs)[number]["id"];

// ─── Page ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("empresa");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações da sua conta</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "empresa" && <CompanyTab />}
      {activeTab === "usuarios" && <UsersTab />}
      {activeTab === "plano" && <PlanTab />}
    </div>
  );
}

// ─── Company tab ────────────────────────────────────────────────────────

const TAX_REGIME_OPTIONS = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
] as const;

function CompanyTab() {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      cnpj: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      taxRegime: "",
    },
  });

  const onSubmit = async (_data: CompanyFormValues) => {
    // TODO: integrate with API
  };

  const fieldError = (field: keyof CompanyFormValues) =>
    errors[field]?.message as string | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dados da Empresa</CardTitle>
        <CardDescription>Informações cadastrais da empresa</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Razão Social *</label>
              <Input {...register("name")} placeholder="Nome da empresa" />
              {fieldError("name") && <p className="text-xs text-destructive">{fieldError("name")}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">CNPJ *</label>
              <Input {...register("cnpj")} placeholder="00.000.000/0000-00" />
              {fieldError("cnpj") && <p className="text-xs text-destructive">{fieldError("cnpj")}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Endereço *</label>
            <Input {...register("address")} placeholder="Rua, número, complemento" />
            {fieldError("address") && <p className="text-xs text-destructive">{fieldError("address")}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Cidade *</label>
              <Input {...register("city")} placeholder="Cidade" />
              {fieldError("city") && <p className="text-xs text-destructive">{fieldError("city")}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">UF *</label>
              <Input {...register("state")} placeholder="SP" maxLength={2} />
              {fieldError("state") && <p className="text-xs text-destructive">{fieldError("state")}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">CEP *</label>
              <Input {...register("zipCode")} placeholder="00000-000" maxLength={9}/>
              {fieldError("zipCode") && <p className="text-xs text-destructive">{fieldError("zipCode")}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Regime Tributário *</label>
            <Controller
              name="taxRegime"
              control={control}
              render={({ field, fieldState}) => (
                <div>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="sm:max-w-xs">
                      <SelectValue placeholder="Selecione o regime" />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_REGIME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error && (
                    <p className="text-xs text-destructive pt-1">{fieldState.error.message}</p>
                  )}      
                </div>
              )}
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isSubmitting}>
              <Save className="mr-2 h-4 w-4" />
              Salvar Alterações
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Users tab ──────────────────────────────────────────────────────────

const MOCK_USERS = [
  { id: "1", name: "João Silva", email: "joao@empresa.com", role: "admin" },
  { id: "2", name: "Maria Santos", email: "maria@empresa.com", role: "manager" },
  { id: "3", name: "Pedro Oliveira", email: "pedro@empresa.com", role: "operator" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  operator: "Operador",
  viewer: "Visualizador",
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "success" | "warning"> = {
  admin: "default",
  manager: "success",
  operator: "secondary",
  viewer: "warning",
};

function UsersTab() {
  const [inviteOpen, setInviteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control: inviteControl,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: undefined },
  });

  const handleInvite = async (_data: InviteFormValues) => {
    // TODO: integrate with API
    reset();
    setInviteOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Usuários</CardTitle>
            <CardDescription>Gerencie os membros da equipe</CardDescription>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {MOCK_USERS.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant={ROLE_VARIANTS[user.role] ?? "secondary"}>
                  {ROLE_LABELS[user.role] ?? user.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
            <DialogDescription>Envie um convite para um novo membro da equipe.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleInvite)} className="space-y-4" noValidate>
            <div className="space-y-1">
              <label className="text-sm font-medium">E-mail *</label>
              <Input {...register("email")} type="email" placeholder="email@exemplo.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Perfil *</label>
              <Controller
                name="role"
                control={inviteControl}
                render={({ field, fieldState}) => ( 
                  <div>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="manager">Gerente</SelectItem>
                        <SelectItem value="operator">Operador</SelectItem>
                        <SelectItem value="viewer">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldState.error && (
                      <p className="text-xs text-destructive pt-1">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="cancel" onClick={() => setInviteOpen(false)}>Cancelar</Button>
              <Button type="submit">Enviar Convite</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Plan tab ───────────────────────────────────────────────────────────

const PLAN_LIMITS = [
  { label: "Usuários", current: 3, max: 5 },
  { label: "Produtos", current: 245, max: 500 },
  { label: "Pedidos / mês", current: 1247, max: 5000 },
  { label: "Depósitos", current: 2, max: 3 },
];

function PlanTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Plano Atual</CardTitle>
              <CardDescription>Detalhes do seu plano e uso</CardDescription>
            </div>
            <Badge variant="success" className="text-sm px-3 py-1">Profissional</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {PLAN_LIMITS.map((item) => {
            const pct = Math.round((item.current / item.max) * 100);
            const isNearLimit = pct >= 80;
            return (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.current} / {item.max}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isNearLimit ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                {isNearLimit && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Você está utilizando {pct}% do limite
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="font-medium">Precisa de mais recursos?</p>
            <p className="text-sm text-muted-foreground">
              Faça upgrade do seu plano para aumentar os limites.
            </p>
          </div>
          <Button>Fazer Upgrade</Button>
        </CardContent>
      </Card>
    </div>
  );
}
