/**
 * Tenant plan and tax regime labels.
 *
 * Kept here for the same reason as the permission matrix and the order state
 * machine: the settings screen had its own map with `BASIC` and `PRO`, neither
 * of which is a value of `TenantPlan` — while `STARTER` and `PROFESSIONAL`,
 * which are, were missing. A tenant on the real plan rendered its raw slug.
 */

export const TENANT_PLANS = [
  'TRIAL',
  'STARTER',
  'PROFESSIONAL',
  'ENTERPRISE',
] as const;

export type TenantPlan = (typeof TENANT_PLANS)[number];

export const TENANT_PLAN_LABELS: Record<TenantPlan, string> = {
  TRIAL: 'Avaliação',
  STARTER: 'Inicial',
  PROFESSIONAL: 'Profissional',
  ENTERPRISE: 'Empresarial',
};

export function getTenantPlanLabel(plan: string): string {
  return TENANT_PLAN_LABELS[plan as TenantPlan] ?? plan;
}

export const TAX_REGIMES = [
  'SIMPLES_NACIONAL',
  'LUCRO_PRESUMIDO',
  'LUCRO_REAL',
  'MEI',
] as const;

export type TaxRegime = (typeof TAX_REGIMES)[number];

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  MEI: 'MEI',
};

/** `{ value, label }` pairs for a select. */
export const TAX_REGIME_OPTIONS = TAX_REGIMES.map((value) => ({
  value,
  label: TAX_REGIME_LABELS[value],
}));
