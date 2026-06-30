export const CRM_STAGES = ["lead", "trial", "active", "paying", "paused", "churned"] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  lead: "Lead",
  trial: "En prueba",
  active: "Activo",
  paying: "Pagando",
  paused: "Pausado",
  churned: "Perdido",
};

export const CRM_STAGE_COLORS: Record<CrmStage, string> = {
  lead: "bg-violet-100 text-violet-800",
  trial: "bg-sky-100 text-sky-800",
  active: "bg-emerald-100 text-emerald-800",
  paying: "bg-blue-100 text-blue-800",
  paused: "bg-amber-100 text-amber-800",
  churned: "bg-slate-200 text-slate-600",
};

export const CRM_ACTIVITY_TYPES = ["note", "call", "email", "whatsapp", "meeting"] as const;
export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number];

export const CRM_ACTIVITY_LABELS: Record<CrmActivityType, string> = {
  note: "Nota",
  call: "Llamada",
  email: "Email",
  whatsapp: "WhatsApp",
  meeting: "Reunión",
};

export function suggestCrmStage(input: {
  subscriptionPlan?: string | null;
  isActive?: boolean;
  billingStatus?: string | null;
}): CrmStage {
  if (input.isActive === false) return "churned";
  const plan = input.subscriptionPlan ?? "trial";
  if (plan === "trial") return "trial";
  if (input.billingStatus === "active" || input.billingStatus === "trialing") return "paying";
  if (plan === "legacy" || plan === "enterprise" || plan === "pro" || plan === "starter") {
    return "active";
  }
  return "trial";
}
