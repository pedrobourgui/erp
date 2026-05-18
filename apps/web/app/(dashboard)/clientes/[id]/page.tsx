"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCustomer, useDeleteCustomer } from "@/hooks/use-customers";
import { useOrders, type OrderListItem } from "@/hooks/use-orders";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { maskDocument, maskPhone, maskCEP } from "@/lib/masks";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  ShoppingCart,
  DollarSign,
  Loader2,
  Trash2,
  Edit,
  User,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

// ─── Tabs ───────────────────────────────────────────────────────────────

const tabs = [
  { id: "info", label: "Informações" },
  { id: "addresses", label: "Endereços" },
  { id: "orders", label: "Pedidos" },
] as const;

type TabId = (typeof tabs)[number]["id"];

// ─── Page ───────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const { data: customerResp, isLoading } = useCustomer(customerId);
  const deleteCustomer = useDeleteCustomer();
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [showDelete, setShowDelete] = useState(false);

  const customer = customerResp?.data;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" onClick={() => router.back()}>Voltar</Button>
      </div>
    );
  }

  const { addToast } = useToast();

  const handleDelete = async () => {
    try {
      await deleteCustomer.mutateAsync(customerId);
      addToast("Cliente excluído com sucesso!", "success");
      router.push("/clientes");
    } catch {
      addToast("Erro ao excluir cliente. Tente novamente.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Tooltip content="Voltar">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Tooltip>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
              <Badge variant="outline">{customer.documentType === "CPF" ? "Pessoa Física" : "Pessoa Jurídica"}</Badge>
            </div>
            <p className="text-muted-foreground font-mono">
              {customer.documentType ? maskDocument(customer.document, customer.documentType) : customer.document}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={<User className="h-5 w-5" />} label="Segmento" value={customer.segment ?? "Regular"} />
        <SummaryCard icon={<ShoppingCart className="h-5 w-5" />} label="Total de Pedidos" value={String(customer.totalOrders ?? 0)} />
        <SummaryCard icon={<DollarSign className="h-5 w-5" />} label="Total Gasto" value={formatCurrency(customer.totalSpent ?? 0)} />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "info" && <InfoTab customer={customer} />}
      {activeTab === "addresses" && <AddressesTab addresses={customer.addresses ?? []} />}
      {activeTab === "orders" && <OrdersTab customerId={customerId} />}

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Excluir Cliente"
        message={`Deseja excluir o cliente "${customer.name}"? Esta ação não pode ser desfeita.`}
        destructive
        confirmLabel="Excluir"
        loading={deleteCustomer.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ─── Summary card ───────────────────────────────────────────────────────

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Info tab ───────────────────────────────────────────────────────────

function InfoTab({ customer }: { customer: { email: string; phone: string; createdAt: string } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Informações de Contato</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <span>{customer.email}</span>
        </div>
        <div className="flex items-center gap-3">
          <Phone className="h-5 w-5 text-muted-foreground" />
          <span>{maskPhone(customer.phone)}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Cliente desde {formatDateTime(customer.createdAt)}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Addresses tab ──────────────────────────────────────────────────────

function AddressesTab({ addresses }: { addresses: { label: string; street: string; number: string; complement?: string; neighborhood: string; city: string; state: string; zipCode: string; isDefault: boolean }[] }) {
  if (addresses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum endereço cadastrado
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {addresses.map((addr, idx) => (
        <Card key={idx}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{addr.label}</span>
              {addr.isDefault && <Badge variant="success" className="text-xs">Padrão</Badge>}
            </div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <p>{addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ""}</p>
              <p>{addr.neighborhood}</p>
              <p>{addr.city} - {addr.state}</p>
              <p>CEP: {maskCEP(addr.zipCode)}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Orders tab ─────────────────────────────────────────────────────────

function OrdersTab({ customerId }: { customerId: string }) {
  const { data, isLoading } = useOrders({ page: 1, limit: 10, customerId });
  const orders: OrderListItem[] = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum pedido encontrado para este cliente
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pedido</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/vendas/pedidos/${order.id}`} className="font-medium text-primary hover:underline">
                      #{order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(order.createdAt)}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(order.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
