import { LEGAL_TEMPLATES_VERSION } from "./const";
import { LEGAL_TEMPLATE_DISCLAIMER } from "./laborReport";

export type LegalTemplateDocument = {
  id: string;
  title: string;
  version: string;
  disclaimer: string;
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
};

export type LegalTemplateCompanyInfo = {
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  privacyContactEmail?: string | null;
  dataRetentionYears?: number;
};

function responsible(c: LegalTemplateCompanyInfo): string {
  return c.legalName?.trim() || c.name.trim() || "Su empresa";
}

function contact(c: LegalTemplateCompanyInfo): string {
  return c.privacyContactEmail?.trim() || "email de privacidad configurado por la empresa";
}

export function buildBusinessPrivacyPolicy(company: LegalTemplateCompanyInfo): LegalTemplateDocument {
  const resp = responsible(company);
  const years = company.dataRetentionYears ?? 4;
  return {
    id: "business_privacy",
    title: "Política de privacidad del negocio",
    version: LEGAL_TEMPLATES_VERSION,
    disclaimer: LEGAL_TEMPLATE_DISCLAIMER,
    sections: [
      {
        heading: "1. Responsable del tratamiento",
        paragraphs: [
          `Responsable: ${resp}.`,
          company.taxId ? `NIF/CIF: ${company.taxId}.` : "",
          company.address ? `Domicilio: ${company.address}.` : "",
          `Contacto privacidad: ${contact(company)}.`,
        ].filter(Boolean),
      },
      {
        heading: "2. Finalidad",
        paragraphs: [
          "Gestión del registro horario de los trabajadores, horarios, incidencias, ausencias y vacaciones, " +
            "así como el cumplimiento de obligaciones legales en materia laboral y de prevención de riesgos.",
        ],
      },
      {
        heading: "3. Base jurídica",
        paragraphs: [
          "Obligación legal del empleador (art. 6.1.c RGPD) y, en su caso, ejecución del contrato de trabajo (art. 6.1.b RGPD).",
          "El consentimiento no es la base principal del registro horario.",
        ],
      },
      {
        heading: "4. Datos tratados",
        bullets: [
          "Identificación laboral: nombre, usuario, teléfono (opcional).",
          "Registro horario: entradas, salidas, horarios, incidencias, ausencias.",
          "Ubicación puntual al fichar (solo si la empresa lo activa).",
          "Datos técnicos: auditoría de cambios, registros de acceso.",
        ],
        paragraphs: [],
      },
      {
        heading: "5. Conservación",
        paragraphs: [
          `Registros horarios: mínimo ${years} años conforme a la normativa laboral española.`,
          "Demás datos: mientras dure la relación laboral o el contrato de servicio, salvo obligación legal distinta.",
        ],
      },
      {
        heading: "6. Destinatarios",
        bullets: [
          "Personal autorizado de la empresa.",
          "Asesoría laboral o gestoría, si procede.",
          "Inspección de Trabajo y Seguridad Social cuando exista obligación legal.",
          "Proveedores técnicos (hosting, notificaciones) como encargados del tratamiento.",
        ],
        paragraphs: [],
      },
      {
        heading: "7. Derechos",
        paragraphs: [
          "Los trabajadores pueden ejercer acceso, rectificación, supresión (cuando proceda), limitación, portabilidad y oposición " +
            `contactando con ${contact(company)}.`,
          "La supresión puede no ser procedente cuando exista obligación legal de conservar registros horarios.",
          "Los trabajadores pueden descargar sus registros de jornada desde el portal del empleado.",
        ],
      },
      {
        heading: "8. Tiempo parcial",
        paragraphs: [
          "Para contratos a tiempo parcial, la empresa puede generar resúmenes mensuales con totalización de horas registradas y diferencia frente a las horas contratadas.",
          "Este documento se facilita para ayudar a cumplir el deber de información; no sustituye asesoramiento laboral.",
        ],
      },
    ],
  };
}

export function buildCompanyTerms(company: LegalTemplateCompanyInfo): LegalTemplateDocument {
  const resp = responsible(company);
  return {
    id: "company_terms",
    title: "Términos para empresas usuarias",
    version: LEGAL_TEMPLATES_VERSION,
    disclaimer: LEGAL_TEMPLATE_DISCLAIMER,
    sections: [
      {
        heading: "1. Objeto",
        paragraphs: [
          `${resp} utiliza TimeClock como herramienta técnica de registro horario. ` +
            "La plataforma no sustituye asesoramiento legal, laboral ni de protección de datos.",
        ],
      },
      {
        heading: "2. Responsabilidades de la empresa",
        bullets: [
          "Informar a los trabajadores sobre el tratamiento de datos y el sistema de registro.",
          "Configurar datos legales correctos (razón social, CIF, contacto privacidad).",
          "Utilizar la herramienta de forma adecuada, sin vigilancia invasiva ni usos discriminatorios.",
          "Conservar y exportar registros conforme a la normativa (mínimo 4 años en España).",
          "Proteger credenciales de acceso de administradores y empleados.",
        ],
        paragraphs: [],
      },
      {
        heading: "3. Limitaciones",
        paragraphs: [
          "TimeClock facilita el registro y la trazabilidad; la exactitud de los datos introducidos es responsabilidad de la empresa usuaria.",
          "Las plantillas legales incluidas son orientativas y deben revisarse profesionalmente.",
        ],
      },
      {
        heading: "4. Baja del servicio",
        paragraphs: [
          "Antes de eliminar la cuenta empresarial, la empresa debe exportar los datos que necesite conservar.",
        ],
      },
    ],
  };
}

export function buildDpaTemplate(company: LegalTemplateCompanyInfo): LegalTemplateDocument {
  const resp = responsible(company);
  return {
    id: "dpa",
    title: "Acuerdo de encargado del tratamiento (Art. 28 RGPD)",
    version: LEGAL_TEMPLATES_VERSION,
    disclaimer:
      LEGAL_TEMPLATE_DISCLAIMER +
      " Debe formalizarse entre el proveedor de TimeClock y cada empresa cliente.",
    sections: [
      {
        heading: "1. Objeto",
        paragraphs: [
          `Tratamiento de datos personales de empleados de ${resp} para registro horario y gestión de jornada.`,
        ],
      },
      {
        heading: "2. Duración",
        paragraphs: ["Vigencia del contrato de servicio SaaS."],
      },
      {
        heading: "3. Tipo de datos e interesados",
        bullets: [
          "Datos de empleados: identificación, fichajes, horarios, incidencias, ausencias.",
          "Ubicación puntual al fichar (si la empresa lo activa).",
        ],
        paragraphs: [],
      },
      {
        heading: "4. Obligaciones del encargado",
        bullets: [
          "Tratar solo según instrucciones documentadas del responsable.",
          "Confidencialidad del personal autorizado.",
          "Medidas de seguridad técnicas y organizativas.",
          "Subencargados autorizados (hosting, notificaciones) con contratos equivalentes.",
          "Asistencia al responsable en derechos de los interesados.",
          "Supresión o devolución de datos al finalizar, salvo obligación legal de conservación.",
        ],
        paragraphs: [],
      },
      {
        heading: "5. Medidas de seguridad",
        paragraphs: [
          "Aislamiento multiempresa, cifrado en tránsito (HTTPS), hash de contraseñas, auditoría de cambios en fichajes.",
        ],
      },
    ],
  };
}

export function legalTemplateToPlainText(doc: LegalTemplateDocument): string {
  const lines: string[] = [doc.title, `Versión: ${doc.version}`, "", doc.disclaimer, ""];
  for (const s of doc.sections) {
    lines.push(s.heading);
    for (const p of s.paragraphs) {
      if (p) lines.push(p);
    }
    for (const b of s.bullets ?? []) {
      lines.push(`• ${b}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
