export function normalizeEmployeePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

export function isValidEmployeePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

export function validateEmployeeEmailOrPhone(
  email?: string | null,
  phone?: string | null
): {
  valid: boolean;
  message?: string;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
} {
  const emailTrim = email?.trim() ?? "";
  const phoneTrim = phone?.trim() ?? "";

  if (!emailTrim && !phoneTrim) {
    return {
      valid: false,
      message: "Indique email o teléfono de contacto del empleado",
      normalizedEmail: null,
      normalizedPhone: null,
    };
  }

  if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    return {
      valid: false,
      message: "Introduce un email válido o deja el campo vacío",
      normalizedEmail: null,
      normalizedPhone: null,
    };
  }

  if (phoneTrim && !isValidEmployeePhone(phoneTrim)) {
    return {
      valid: false,
      message: "Introduce un teléfono válido (mín. 9 dígitos) o deja el campo vacío",
      normalizedEmail: null,
      normalizedPhone: null,
    };
  }

  return {
    valid: true,
    normalizedEmail: emailTrim ? emailTrim.toLowerCase() : null,
    normalizedPhone: phoneTrim ? normalizeEmployeePhone(phoneTrim) : null,
  };
}
