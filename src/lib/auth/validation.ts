export function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validOtp(value: unknown): value is string {
  return typeof value === "string" && /^\d{6,8}$/.test(value);
}

export function authErrorMessage(code?: string) {
  if (code === "otp_expired") return "El código venció o no es válido. Solicita otro e inténtalo de nuevo.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return "Espera unos minutos antes de volver a intentarlo.";
  if (code === "email_address_not_authorized") return "El envío de correos todavía no está configurado para esta dirección.";
  return "No pudimos completar el acceso. Revisa tus datos e inténtalo de nuevo.";
}
