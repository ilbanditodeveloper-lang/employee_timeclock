import { GENERIC_SERVER_ERROR_MSG } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

const BUSINESS_MESSAGE_PATTERNS = [
  /^Ya existe una cuenta de administrador con ese email/,
  /^El registro requiere base de datos/,
  /^Debes aceptar los términos/,
  /^Las contraseñas no coinciden/,
  /^Introduce un email válido/,
  /^La contraseña debe tener/,
  /^Demasiados intentos/,
  /^Credenciales inválidas$/,
  /^Invalid admin credentials$/,
  /^Empresa no disponible/,
  /^Tu periodo de prueba ha terminado/,
  /^Has alcanzado el límite de \d+ empleados/,
  /^Modo demo no disponible/,
  /^Superadmin no configurado/,
  /^No autorizado/,
  /^Sesión inválida/,
  /^Please login \(10001\)$/,
  /^You do not have required permission \(10002\)$/,
  /^Negocio no encontrado/,
  /^Se requiere ubicación para fichar/,
  /^No estás en la ubicación autorizada del negocio/,
  /^No estás dentro del radio permitido/,
  /^Debes fichar salida antes de volver a entrar/,
  /^Fichaje disponible desde/,
  /^Fichaje no permitido:/,
  /^No hay fichaje de entrada activo/,
  /^Debes fichar entrada antes de pausar/,
  /^Ya estás en pausa/,
  /^No estás en pausa/,
  /^Cuenta de empleado desactivada/,
];

/** Errores de negocio visibles al usuario (400, no 500 genérico). */
export function throwBusinessError(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

/** Sesión ausente o caducada — debe responder 401, no 500. */
export function throwAuthError(message: string): never {
  throw new TRPCError({ code: "UNAUTHORIZED", message });
}

/** PostgreSQL unique_violation */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "23505";
}

export function isBusinessSafeMessage(message: string): boolean {
  if (!message.trim()) return false;
  return BUSINESS_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export function sanitizeErrorMessage(message: string): string {
  if (!ENV.isProduction) return message;
  if (isBusinessSafeMessage(message)) return message;
  return GENERIC_SERVER_ERROR_MSG;
}

export function sanitizeThrownError(error: unknown): Error {
  if (error instanceof Error) {
    return new Error(sanitizeErrorMessage(error.message));
  }
  return new Error(GENERIC_SERVER_ERROR_MSG);
}
