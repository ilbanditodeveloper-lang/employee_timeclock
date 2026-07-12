/** Employee UI extensions — merged into es catalog */
export const employeeExt = {
  employee: {
    clock: {
      geolocation: {
        permissionDenied:
          "Permite el acceso a ubicación en el navegador para fichar (Ajustes → Permisos).",
        unavailable: "No se pudo obtener tu ubicación. Comprueba que el GPS está activo.",
        timeout:
          "La ubicación tardó demasiado. Inténtalo de nuevo al aire libre o cerca de una ventana.",
        fallback: "No se pudo obtener tu ubicación",
        confirmContinue:
          "Tu empresa requiere ubicación puntual solo al fichar. ¿Continuar?",
      },
      toasts: {
        notificationsNotConfigured:
          "Notificaciones no configuradas. Contacta con el administrador.",
        invalidSession: "Sesión no válida",
        locationRequired:
          "Tu empresa requiere ubicación para fichar. Permite el GPS en el navegador y vuelve a pulsar Entrada.",
        clockInSuccess: "¡Entrada registrada!",
        clockInSuccessUnstable: "¡Entrada registrada! (la conexión estaba inestable)",
        clockInFailed: "Error al registrar entrada",
        clockInConnectionError:
          "Error de conexión. Espera unos segundos y vuelve a pulsar Entrada.",
        clockOutSuccess: "¡Salida registrada!",
        clockOutSuccessUnstable: "¡Salida registrada! (la conexión estaba inestable)",
        clockOutFailed: "Error al registrar salida",
        clockOutConnectionError:
          "Error de conexión. Espera unos segundos y vuelve a pulsar Salida.",
        resumeSuccess: "Jornada reanudada",
        pauseSuccess: "Pausa iniciada",
        pauseFailed: "No se pudo actualizar la pausa",
      },
    },
  },
  common: {
    map: {
      searchAddress: "Buscar dirección",
      addressPlaceholder: "Escribe una dirección o selecciona en el mapa",
      locationLabel: "Ubicación:",
      useMyLocation: "Usar mi ubicación",
      detecting: "Obteniendo ubicación...",
      instructionsTitle: "Instrucciones:",
      instructions:
        'Haz clic en el mapa para seleccionar la ubicación del restaurante, o usa el botón "Usar mi ubicación" para detectar tu posición actual.',
      geoUnavailable: "Geolocalización no disponible en tu navegador",
      loadError:
        "No se pudo cargar Google Maps. Revisa la API key y las restricciones del dominio.",
      notFound: "No se pudo encontrar la ubicación",
      markerTitle: "Ubicación del negocio",
      obtainedSuccess: "Ubicación obtenida correctamente",
      obtainFailed: "No se pudo obtener tu ubicación",
    },
  },
  landing: {
    mockup: {
      brandTagline: "Fichaje de empleados",
      liveSubtitle: "Seguimiento en vivo · Cafetería Sol · 01/07/2026",
      vacation: "Vacaciones",
    },
  },
} as const;
