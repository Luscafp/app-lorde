import type { Role } from './types'

const DIAS = ['dom','seg','ter','qua','qui','sex','sáb']
const MESES = ['','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

export function fmtFull(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2,'0')
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2,'0')
  const min = String(d.getMinutes()).padStart(2,'0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2,'0')
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function fmtCard(iso: string): string {
  const d = new Date(iso)
  const dia = DIAS[d.getDay()]
  const dd = String(d.getDate()).padStart(2,'0')
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const hh = String(d.getHours()).padStart(2,'0')
  const min = String(d.getMinutes()).padStart(2,'0')
  return `${dia} ${dd}/${mm} · ${hh}:${min}`
}

export function fmtShortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MESES[d.getMonth()+1]}`
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

// Permission helpers
export const canAccessPanel  = (r: Role) => r !== 'atleta'
export const canManageUsers  = (r: Role) => r === 'presidente' || r === 'vice' || r === 'admin'
export const canDelete       = (r: Role) => r === 'presidente' || r === 'vice' || r === 'admin'
export const canManageRoles  = (r: Role) => r === 'admin'

export function getMeByRole(role: Role) {
  const MAP: Record<Role, { id:string; nome:string; email:string; timeId?:string }> = {
    atleta:     { id:'u1', nome:'Gabriel Lima',   email:'gabriel@discente.ufma.br',    timeId:'lorde-futsal-m' },
    diretor:    { id:'u2', nome:'Juliana Ramos',  email:'juliana@discente.ufma.br',    timeId:'lorde-futsal-f' },
    presidente: { id:'u3', nome:'Rafael Mendes',  email:'rafael@discente.ufma.br',     timeId:'lorde-futsal-m' },
    vice:       { id:'u4', nome:'Carlos Eduardo', email:'carlos@discente.ufma.br',     timeId:'lorde-volei-m' },
    admin:      { id:'u6', nome:'Admin Sistema',  email:'admin@atleticalorde.ufma.br' },
  }
  return { ...MAP[role], role }
}
