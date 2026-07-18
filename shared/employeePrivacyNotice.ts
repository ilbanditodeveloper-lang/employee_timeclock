import { EMPLOYEE_PRIVACY_NOTICE_VERSION } from "./const";

export type CompanyLegalInfo = {
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  privacyContactEmail?: string | null;
  country?: string | null;
  locationEnabled?: boolean;
  dataRetentionYears?: number;
  /** Company-specific notice version (bumped when legal data changes). */
  employeePrivacyNoticeVersion?: string | null;
};

export type EmployeeNoticeContext = {
  employeeName?: string;
  employeeUsername?: string;
};

export type PrivacyNoticeSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type EmployeePrivacyNoticeDocument = {
  version: string;
  title: string;
  subtitle: string;
  disclaimer: string;
  sections: PrivacyNoticeSection[];
  acknowledgmentLabel: string;
  signatureBlock: {
    employeeLabel: string;
    companyLabel: string;
    dateLabel: string;
    placeLabel: string;
  };
};

const PLATFORM_NAME = "TimeClock";

export function buildEmployeePrivacyNotice(
  company: CompanyLegalInfo,
  employee?: EmployeeNoticeContext
): EmployeePrivacyNoticeDocument {
  const responsible =
    company.legalName?.trim() || company.name.trim() || "Su empresa";
  const retentionYears = company.dataRetentionYears ?? 4;
  const contact =
    company.privacyContactEmail?.trim() ||
    "el departamento de Recursos Humanos o la persona de contacto designada por su empresa";
  const addressLine = company.address?.trim()
    ? `Domicilio: ${company.address.trim()}.`
    : "";
  const taxLine = company.taxId?.trim() ? `NIF/CIF: ${company.taxId.trim()}.` : "";
  const locationBullets = company.locationEnabled
    ? [
        "Coordenadas GPS aproximadas únicamente en el instante del fichaje (entrada/salida), cuando utilice la aplicación móvil.",
        "No se realiza seguimiento continuo ni localización fuera del momento del registro.",
        "La empresa ha activado esta función; puede consultar con su responsable si tiene dudas.",
      ]
    : [
        "La geolocalización no está activada en su empresa. Si se activara en el futuro, se le informará previamente y solo se usaría al fichar, sin seguimiento continuo.",
      ];

  const employeeIntro = employee?.employeeName
    ? `Documento personalizado para: ${employee.employeeName}${
        employee.employeeUsername ? ` (${employee.employeeUsername})` : ""
      }.`
    : "";

  const noticeVersion =
    company.employeePrivacyNoticeVersion?.trim() || EMPLOYEE_PRIVACY_NOTICE_VERSION;

  return {
    version: noticeVersion,
    title: "CLÁUSULA INFORMATIVA SOBRE PROTECCIÓN DE DATOS",
    subtitle: "Registro de jornada laboral mediante aplicación digital",
    disclaimer:
      "Este documento cumple el deber de información del artículo 13 del Reglamento (UE) 2016/679 (RGPD) " +
      "y la guía de la Agencia Española de Protección de Datos sobre relaciones laborales. " +
      "No constituye consentimiento para el control horario: la base legal es el cumplimiento de una obligación legal " +
      "(artículo 34.9 del Estatuto de los Trabajadores y artículo 6.1.c del RGPD).",
    sections: [
      {
        heading: "1. Responsable del tratamiento",
        paragraphs: [
          employeeIntro,
          `Responsable: ${responsible}.`,
          taxLine,
          addressLine,
          `Correo de contacto para protección de datos: ${contact}.`,
        ].filter(Boolean),
        bullets: [],
      },
      {
        heading: "2. Finalidad del tratamiento",
        paragraphs: [
          `${responsible} utiliza la aplicación ${PLATFORM_NAME} exclusivamente para:`,
        ],
        bullets: [
          "Registrar de forma individualizada la jornada laboral (entrada y salida).",
          "Gestionar horarios, incidencias, ausencias y vacaciones.",
          "Cumplir obligaciones legales de registro horario, prevención de riesgos e inspección de trabajo.",
        ],
      },
      {
        heading: "3. Base jurídica",
        paragraphs: [
          "Cumplimiento de obligaciones legales aplicables al responsable (artículo 6.1.c RGPD), en particular el artículo 34.9 del Estatuto de los Trabajadores.",
          "Ejecución del contrato de trabajo cuando el registro sea necesario para la relación laboral (artículo 6.1.b RGPD), en su caso.",
        ],
      },
      {
        heading: "4. Categorías de datos personales tratados",
        paragraphs: ["Se tratarán, entre otros, los siguientes datos:"],
        bullets: [
          "Datos identificativos: nombre, usuario de acceso y, en su caso, teléfono.",
          "Datos de jornada: horas de entrada y salida, turnos, horarios asignados, incidencias y solicitudes de ausencia/vacaciones.",
          "Datos técnicos mínimos: fecha y hora del registro, origen del fichaje (aplicación móvil, panel administrador, etc.) e identificador de sesión.",
          ...locationBullets,
        ],
      },
      {
        heading: "5. Quién puede ver sus datos",
        paragraphs: [
          "Sus datos de jornada pueden ser consultados por personal autorizado de su empresa (dirección, recursos humanos, administración) " +
            "con fines de gestión laboral y cumplimiento legal.",
          "No están disponibles para otros empleados salvo que su empresa configure informes específicos.",
        ],
      },
      {
        heading: "6. Destinatarios y comunicaciones",
        paragraphs: [
          "Los datos podrán comunicarse a la Inspección de Trabajo y Seguridad Social, juzgados o administraciones públicas cuando exista obligación legal.",
          `El encargado del tratamiento tecnológico (${PLATFORM_NAME}) trata los datos por cuenta del responsable con contrato de encargado del tratamiento (artículo 28 RGPD). Los datos se alojan en servidores de la Unión Europea o con garantías adecuadas conforme al RGPD.`,
        ],
      },
      {
        heading: "7. Plazo de conservación",
        paragraphs: [
          `Los registros de jornada se conservarán durante un mínimo de ${retentionYears} años, conforme a la normativa laboral española.`,
          "Transcurrido el plazo, los datos serán suprimidos o anonimizados, salvo obligación legal distinta o reclamación pendiente.",
        ],
      },
      {
        heading: "8. Derechos de las personas trabajadoras",
        paragraphs: [
          "Puede ejercer los derechos de acceso, rectificación, supresión (cuando proceda), limitación del tratamiento, portabilidad y oposición dirigiéndose al responsable en la dirección indicada.",
          "La supresión puede no ser procedente cuando exista obligación legal de conservar los registros horarios.",
          "Si considera que no se han atendido sus derechos, puede presentar reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).",
        ],
      },
      {
        heading: "9. Medidas de seguridad",
        paragraphs: [
          "Se aplican medidas técnicas y organizativas apropiadas: acceso autenticado, cifrado en tránsito (HTTPS), registro de auditoría de cambios en fichajes y separación de datos por empresa.",
        ],
      },
      {
        heading: "10. Acuse de recibo",
        paragraphs: [
          "La empresa debe poder acreditar que ha informado a la persona trabajadora. Puede hacerlo mediante:",
          "— Acuse electrónico en la aplicación (casilla «He leído la información…» al primer acceso), o",
          "— Firma manuscrita o firma digital en el ejemplar impreso de este documento, que la empresa conservará.",
        ],
      },
    ],
    acknowledgmentLabel:
      "He leído la información sobre el tratamiento de mis datos personales en relación con el sistema de registro de jornada.",
    signatureBlock: {
      employeeLabel: "Firma de la persona trabajadora",
      companyLabel: "Firma / sello de la empresa (opcional)",
      dateLabel: "Fecha",
      placeLabel: "Lugar",
    },
  };
}

export function noticeDocumentToPlainText(doc: EmployeePrivacyNoticeDocument): string {
  const lines: string[] = [
    doc.title,
    doc.subtitle,
    `Versión: ${doc.version}`,
    "",
    doc.disclaimer,
    "",
  ];
  for (const section of doc.sections) {
    lines.push(section.heading);
    for (const p of section.paragraphs) {
      if (p) lines.push(p);
    }
    if (section.bullets?.length) {
      for (const b of section.bullets) {
        lines.push(`• ${b}`);
      }
    }
    lines.push("");
  }
  lines.push(doc.acknowledgmentLabel);
  return lines.join("\n");
}
