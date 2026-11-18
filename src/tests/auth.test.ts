import { describe, expect, it } from "vitest";
import { parseSupabaseEnv } from "@/lib/supabase/env";
import { authErrorMessage, validEmail, validOtp } from "@/lib/auth/validation";

describe("public Supabase configuration", () => {
  it("accepts hosted HTTPS and local HTTP only", () => {
    expect(parseSupabaseEnv("https://example.supabase.co", "sb_publishable_test").url).toBe("https://example.supabase.co");
    expect(parseSupabaseEnv("http://127.0.0.1:54321", "sb_publishable_test").url).toBe("http://127.0.0.1:54321");
    for (const url of ["http://example.com", "https://user:pass@example.com", "https://example.com/path", "javascript:alert(1)"]) {
      expect(() => parseSupabaseEnv(url, "sb_publishable_test")).toThrow();
    }
  });
  it("rejects missing configuration and secret keys without echoing them", () => {
    expect(() => parseSupabaseEnv(undefined, undefined)).toThrow();
    expect(() => parseSupabaseEnv("https://example.com", "sb_secret_sensitive")).toThrow("publishable");
  });
});

describe("email OTP", () => {
  it("validates email and numeric codes without accepting arbitrary input", () => {
    expect(validEmail("player@example.test")).toBe(true);
    for (const email of [null, {}, "a@b", "a b@example.test", "a\n@example.test"]) expect(validEmail(email)).toBe(false);
    expect(validOtp("012345")).toBe(true);
    expect(validOtp("01234567")).toBe(true);
    for (const code of [123456, "12345", "123456789", "abcdef", "123456\n"]) expect(validOtp(code)).toBe(false);
  });
  it("maps expiry and throttling to actionable messages without exposing server errors", () => {
    expect(authErrorMessage("otp_expired")).toContain("venció");
    expect(authErrorMessage("over_email_send_rate_limit")).toContain("Espera");
    expect(authErrorMessage("secret_database_error")).not.toContain("secret_database_error");
  });
});
