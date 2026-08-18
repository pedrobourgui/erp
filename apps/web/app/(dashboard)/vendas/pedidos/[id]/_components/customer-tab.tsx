"use client";

import { formatDocument } from "@erp/validators";
import { Mail, MapPin, Phone, User } from "lucide-react";
import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrderDetail } from "@/hooks/use-orders";
import { maskCEP, maskPhone } from "@/lib/masks";

export function CustomerTab({ order }: { order: OrderDetail }) {
  const c = order.customer;
  if (!c) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Dados do cliente não disponíveis
        </CardContent>
      </Card>
    );
  }

  const defaultAddr = c.addresses?.find((a) => a.isDefault) ?? c.addresses?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dados do Cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{c.name}</p>
                {/* VD-16: a aba mostrava `11185874640` cru. O CLAUDE.md já
                    exige máscara na exibição — faltava aplicar aqui. */}
                {c.document ? (
                  <p className="text-sm text-muted-foreground">
                    {formatDocument(c.document)}
                  </p>
                ) : null}
              </div>
            </div>
            {c.email ? <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm">{c.email}</p>
              </div> : null}
            {c.phone ? <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm">{maskPhone(c.phone)}</p>
              </div> : null}
          </div>

          {defaultAddr ? <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <p className="font-medium">
                  Endereço{defaultAddr.label ? ` (${defaultAddr.label})` : ""}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p>
                  {defaultAddr.street}, {defaultAddr.number}
                  {defaultAddr.complement ? ` - ${defaultAddr.complement}` : ""}
                </p>
                <p>{defaultAddr.neighborhood}</p>
                <p>
                  {defaultAddr.city} - {defaultAddr.state}
                </p>
                <p>CEP: {maskCEP(defaultAddr.zipCode)}</p>
              </div>
            </div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
