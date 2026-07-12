/** Legal & misc UI strings — merged into es catalog */
export const legalExt = {
  legal: {
    common: {
      disclaimerShort:
        "Plantilla informativa — debe revisarse con un asesor legal antes de uso comercial.",
      disclaimerDpa:
        "Plantilla orientativa — requiere revisión por asesor legal/gestoría/DPO antes de uso oficial. Debe formalizarse entre el proveedor de TimeClock y cada empresa cliente.",
      backToHome: "Volver al inicio",
      privacyPolicy: "Política de privacidad",
      termsOfUse: "Términos de uso",
      versionLabel: "Versión {{version}}",
      readDocument: "Leer documento",
      copy: "Copiar",
      pdf: "PDF",
      templateVersion: "Versión plantilla: {{version}}",
      copySuccess: "Texto copiado al portapapeles",
      copyFailed: "No se pudo copiar",
      pdfDownloaded: "PDF descargado",
    },
    platform: {
      privacy: {
        title: "Política de privacidad de la plataforma TimeClock",
        lastUpdated: "Última actualización: 22 de junio de 2026",
        sections: {
          controller: {
            title: "1. Responsable y encargado",
            body: "Cada empresa cliente es responsable del tratamiento de los datos de sus empleados. La plataforma TimeClock actúa como encargado del tratamiento al prestar la herramienta técnica de registro horario.",
          },
          data: {
            title: "2. Datos que trata la plataforma",
            bullet1: "Identificación: nombre, usuario, teléfono (opcional).",
            bullet2: "Datos laborales: horarios, fichajes, incidencias, solicitudes de ausencia.",
            bullet3: "Ubicación puntual al fichar (solo si la empresa lo activa).",
            bullet4: "Datos técnicos mínimos: suscripción push, registros de auditoría.",
          },
          purpose: {
            title: "3. Finalidad y base legal",
            body: "Gestión del registro horario y control de jornada. La base legal principal es la obligación legal del empleador (art. 34.9 ET en España) y la ejecución de la relación laboral — no el consentimiento del trabajador como base principal.",
          },
          retention: {
            title: "4. Conservación",
            body: "Los registros horarios se conservan 4 años como mínimo. Otros datos mientras exista relación con la empresa o contrato de servicio.",
          },
          recipients: {
            title: "5. Destinatarios",
            body: "Empresa empleadora, trabajadores autorizados, asesoría laboral si procede, Inspección de Trabajo cuando lo solicite, y proveedores técnicos (hosting PostgreSQL, notificaciones push, mapas si se configuran).",
          },
          rights: {
            title: "6. Derechos",
            body: "Acceso, rectificación, supresión, oposición, limitación y portabilidad cuando proceda. Contacta con el responsable de tu empresa (datos en la sección legal del negocio) o con el soporte de la plataforma.",
          },
          security: {
            title: "7. Seguridad",
            body: "Contraseñas con hash seguro, HTTPS en producción, aislamiento multiempresa, registro de auditoría en correcciones de fichajes.",
          },
        },
      },
      terms: {
        title: "Términos de uso para empresas",
        sections: {
          object: {
            title: "1. Objeto",
            body: "TimeClock es una herramienta técnica SaaS para registro horario. La empresa usuaria es responsable del cumplimiento legal frente a sus trabajadores.",
          },
          obligations: {
            title: "2. Obligaciones de la empresa",
            bullet1: "Informar a los empleados sobre el tratamiento de datos.",
            bullet2: "Configurar correctamente sus datos legales (CIF, contacto privacidad).",
            bullet3: "Conservar y exportar registros horarios durante 4 años.",
            bullet4: "No usar la app para fines no laborales ni vigilancia invasiva.",
          },
          liability: {
            title: "3. Limitación de responsabilidad",
            body: "La plataforma presta infraestructura y software. No sustituye asesoramiento legal ni garantiza por sí sola el cumplimiento normativo sin configuración y uso correctos.",
          },
          data: {
            title: "4. Datos y baja",
            body: "Antes de eliminar una cuenta empresarial, exporta los registros. Los fichajes pueden estar sujetos a retención legal mínima de 4 años.",
          },
        },
      },
      dpa: {
        title: "Acuerdo de encargado del tratamiento (Art. 28 RGPD)",
        platform: "Plataforma: TimeClock",
        sections: {
          object: {
            title: "1. Objeto",
            body: "Tratamiento de datos personales de empleados de la empresa cliente para registro horario y gestión de jornada mediante la plataforma SaaS TimeClock.",
          },
          duration: {
            title: "2. Duración",
            body: "Vigencia del contrato de servicio SaaS entre las partes.",
          },
          dataTypes: {
            title: "3. Tipo de datos e interesados",
            bullet1: "Datos identificativos laborales: nombre, usuario, teléfono (opcional).",
            bullet2: "Registro horario: entradas, salidas, horarios, incidencias, ausencias.",
            bullet3: "Ubicación puntual al fichar (solo si la empresa lo activa).",
            bullet4: "Datos técnicos: auditoría de cambios, suscripciones push.",
          },
          obligations: {
            title: "4. Obligaciones del encargado",
            bullet1: "Tratar solo según instrucciones documentadas del responsable (empresa cliente).",
            bullet2: "Confidencialidad del personal autorizado.",
            bullet3: "Medidas de seguridad técnicas y organizativas adecuadas.",
            bullet4: "Subencargados (hosting, notificaciones) con garantías equivalentes.",
            bullet5: "Asistencia al responsable en derechos de los interesados.",
            bullet6: "Supresión o devolución al finalizar, salvo obligación legal de conservación.",
          },
          security: {
            title: "5. Medidas de seguridad",
            body: "Aislamiento multiempresa, HTTPS, hash de contraseñas, auditoría de correcciones en fichajes, backups del proveedor de base de datos.",
          },
          contact: {
            title: "6. Contacto",
            body: "Para formalizar este acuerdo o solicitar información, contacte con el soporte de la plataforma TimeClock o con su proveedor del servicio.",
          },
        },
      },
    },
    employeeNotice: {
      loading: "Cargando información legal...",
      platformPrivacyPrefix: "Más información en la",
      platformPrivacyLink: "política de privacidad de la plataforma",
      checkboxLabel:
        "He leído la información sobre el tratamiento de mis datos personales (acuse de recibo electrónico, no consentimiento de control horario).",
      saving: "Guardando...",
      continue: "Continuar",
      accepted: "Información registrada correctamente",
      defaultCompanyName: "Su empresa",
      documentVersion: "Versión del documento: {{version}}",
      employeeLabel: "Trabajador/a: {{name}}",
    },
    reacceptance: {
      title: "Actualización de documentos legales",
      description:
        "Hemos actualizado los textos de la plataforma. Debes revisarlos y aceptarlos para seguir usando el panel de administración.",
      acknowledgeLabel:
        "He leído los documentos anteriores en nombre de mi empresa y acepto la versión vigente. Entiendo que debo revisarlos con un asesor antes de uso oficial masivo.",
      accept: "Aceptar y continuar",
      saving: "Guardando…",
      success: "Documentos legales aceptados",
      failed: "No se pudo registrar la aceptación",
    },
  },
  notFound: {
    title: "Página no encontrada",
    description:
      "Lo sentimos, la página que buscas no existe. Puede que se haya movido o eliminado.",
    goHome: "Ir al inicio",
  },
  notifications: {
    ariaLabel: "Notificaciones",
    ariaLabelPending: "Notificaciones, {{count}} pendientes",
    title: "Notificaciones",
    subtitle: "Vacaciones, incidencias y solicitudes RGPD pendientes",
    loading: "Cargando…",
    empty: "No hay pendientes.",
    gdprPending: "{{count}} solicitud(es) RGPD pendiente(s)",
    gdprReview: "Revíselas en Legal / RGPD",
    timeOffSection: "Vacaciones / ausencias",
    incidentsSection: "Incidencias",
    viewAll: "Ver todas",
    approve: "Aprobar",
    deny: "Denegar",
    reject: "Rechazar",
    pending: "Pendiente",
    timeOffApproved: "Solicitud aprobada",
    timeOffDenied: "Solicitud denegada",
    timeOffUpdateFailed: "No se pudo actualizar la solicitud",
    incidentApproved: "Incidencia aprobada",
    incidentRejected: "Incidencia rechazada",
    incidentUpdateFailed: "No se pudo actualizar la incidencia",
    incidentTypes: {
      late_arrival: "Llegada tarde",
      early_exit: "Salida anticipada",
      absence: "Ausencia",
      other: "Otra incidencia",
    },
    timeOffKinds: {
      vacation: "Vacaciones",
      day_off: "Día libre",
    },
  },
  whatsapp: {
    contactAria: "Contactar por WhatsApp",
  },
  pwa: {
    title: "Instalar TimeClock",
    iosHint: "En Safari: Compartir → Añadir a pantalla de inicio.",
    androidHint: "Añade TimeClock a tu móvil como app para fichar más rápido.",
    install: "Instalar app",
  },
} as const;
