import type { Role } from './types'

const DIAS = ['dom','seg','ter','qua','qui','sex','sáb']
const MESES = ['','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const p2 = (n: number) => String(n).padStart(2, '0')

// 'AAAA-MM-DD' sem hora é interpretado como UTC pelo Date e vira o dia anterior no fuso de São Luís.
// Todas as datas do protótipo são locais (America/Fortaleza).
export function parseLocal(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
}

// Relógio da demonstração: começa em 30/09/2026 15:00 (data dos dados de exemplo) e avança em tempo real,
// para que "próximos eventos", "já começou" etc. continuem coerentes em qualquer dia em que o protótipo for aberto.
const DEMO_INICIO = new Date('2026-09-30T15:00:00').getTime()
const DEMO_OFFSET = DEMO_INICIO - Date.now()

// Data/hora local atual no mesmo formato dos dados ('AAAA-MM-DDTHH:mm:ss')
export function nowLocal(): string {
  const d = new Date(Date.now() + DEMO_OFFSET)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
}

export function todayLocal(): string {
  return nowLocal().slice(0, 10)
}

// Formato padrão de data e hora do documento: dd/mm/aaaa HH:mm
export function fmtFull(iso: string): string {
  const d = parseLocal(iso)
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export function fmtDate(iso: string): string {
  const d = parseLocal(iso)
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`
}

// Versão compacta para cards: "sáb 04/10 · 15:00"
export function fmtCard(iso: string): string {
  const d = parseLocal(iso)
  return `${DIAS[d.getDay()]} ${p2(d.getDate())}/${p2(d.getMonth() + 1)} · ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export function fmtShortDate(iso: string): string {
  const d = parseLocal(iso)
  return `${d.getDate()} ${MESES[d.getMonth() + 1]}`
}

export function fmtHora(iso: string): string {
  const d = parseLocal(iso)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export function diaSemana(iso: string): string {
  return DIAS[parseLocal(iso).getDay()]
}

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0,2).map(n=>n[0].toUpperCase()).join('')
}

export const ROLE_LABEL: Record<Role, string> = {
  atleta:     'Atleta',
  diretor:    'Diretor',
  vice:       'Vice-presidente',
  presidente: 'Presidente',
  admin:      'Administrador',
}

// Hierarquia: Atleta < Diretoria < Presidência (Presidente = Vice) < Administrador (RN05)
export function roleLevel(r: Role): number {
  return ({ atleta: 0, diretor: 1, vice: 2, presidente: 2, admin: 3 } as Record<Role, number>)[r]
}

// Permissões (seção 2.4)
export const canAccessPanel  = (r: Role) => roleLevel(r) >= 1
export const canManageUsers  = (r: Role) => roleLevel(r) >= 2
export const canDelete       = (r: Role) => roleLevel(r) >= 2
export const canManageRoles  = (r: Role) => r === 'admin'

// Regra de senha (UC06): no mínimo 8 caracteres, com letras e números
export const SENHA_REGRA = 'A senha deve ter no mínimo 8 caracteres, com pelo menos uma letra e um número.'
export function senhaValida(p: string): boolean {
  return p.length >= 8 && /[A-Za-zÀ-ÿ]/.test(p) && /\d/.test(p)
}

export function emailValido(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
}
