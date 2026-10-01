import { createContext, useContext } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
  Role, Screen, AgendaTab, Evento, Participacao, Time, MembroTime, Modalidade, Atletica,
  Solicitacao, Noticia, Banner, Usuario, AuditLog, AuditEntity, DemoFlags,
} from './types'

type Setter<T> = Dispatch<SetStateAction<T>>

// Estado compartilhado: tudo o que o painel altera aparece imediatamente nas telas do atleta e vice-versa.
export type AppCtx = {
  me: Usuario
  role: Role
  setScreen: (s: Screen) => void
  agendaTab: AgendaTab
  openAgenda: (tab: AgendaTab) => void
  setAgendaTab: (tab: AgendaTab) => void
  abrirEvento: (id: string | null) => void
  showToast: (message: string, type: 'success' | 'error') => void
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void
  logout: (toast?: string) => void
  senhaCorreta: (usuarioId: string, senha: string) => boolean
  alterarSenha: (usuarioId: string, senha: string) => void
  demo: DemoFlags
  setDemo: Setter<DemoFlags>
  // Ações de gravação chamam online() antes: sem conexão, mostra "Sem conexão" e bloqueia (RNF19)
  online: () => boolean
  nomeUsuario: (id: string) => string

  eventos: Evento[]
  setEventos: Setter<Evento[]>
  participacoes: Participacao[]
  setParticipacoes: Setter<Participacao[]>
  times: Time[]
  setTimes: Setter<Time[]>
  membros: MembroTime[]
  setMembros: Setter<MembroTime[]>
  modalidades: Modalidade[]
  setModalidades: Setter<Modalidade[]>
  atleticas: Atletica[]
  setAtleticas: Setter<Atletica[]>
  solicitacoes: Solicitacao[]
  setSolicitacoes: Setter<Solicitacao[]>
  noticias: Noticia[]
  setNoticias: Setter<Noticia[]>
  banners: Banner[]
  setBanners: Setter<Banner[]>
  usuarios: Usuario[]
  setUsuarios: Setter<Usuario[]>
  auditoria: AuditLog[]
  audit: (entidade: AuditEntity, acao: string, alvo: string) => void
}

export const AppContext = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp fora do AppContext')
  return ctx
}
