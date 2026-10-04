/** `ana@ex.com` → `a***@ex.com`; sem `@` → `***`. Para logs: nunca registrar o e-mail completo. */
export function mascararEmail(email: string): string {
  const arroba = email.lastIndexOf('@')
  if (arroba < 1) return '***'
  return `${email[0]}***${email.slice(arroba)}`
}
