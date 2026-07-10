export const GPS_JUSTIFICATION_CATEGORIES = [
  {
    value: "workplace_geofence",
    label: "Fichaje solo en el centro de trabajo (recomendado)",
    hint: "Para evitar que los empleados fichen desde casa u otra ubicación.",
  },
  {
    value: "multiple_sites",
    label: "Varios centros de trabajo",
    hint: "Si la empresa tiene más de un local donde se puede fichar.",
  },
  {
    value: "itinerant_workers",
    label: "Trabajadores itinerantes",
    hint: "Reparto, obras, visitas a clientes, etc.",
  },
  {
    value: "off_site_work",
    label: "Trabajo habitual fuera del centro",
    hint: "Teletrabajo parcial o desplazamientos frecuentes.",
  },
  {
    value: "other",
    label: "Otro motivo",
    hint: "Indique la justificación en el campo de texto.",
  },
] as const;

export type GpsJustificationCategory = (typeof GPS_JUSTIFICATION_CATEGORIES)[number]["value"];

export const DEFAULT_WORKPLACE_GPS_JUSTIFICATION =
  "Comprobar que el empleado está en el centro de trabajo al fichar, evitando registros desde domicilio u otras ubicaciones no autorizadas.";
