export type Role = 'atleta' | 'diretor' | 'vice' | 'presidente' | 'admin'
export type Tab = 'home' | 'agenda' | 'modalidades' | 'perfil'
export type Screen = Tab | 'login' | 'painel' | 'modalidade-detail'

export type Modalidade = { id: string; nome: string; emoji: string; cor: string; ativa: boolean }

export type AtleticaRef = { id: string; nome: string; curso: string }

export type Time = {
  id: string
  nome: string
  modalidadeId: string
  atleticaId: string
  capitao?: string
  atletas?: string[]
  treino?: string
  local?: string
  ativo?: boolean
}

export type EventoStatus = 'Agendado' | 'Em andamento' | 'Finalizado' | 'Cancelado'
export type EventoTipo = 'JOGO' | 'TREINO'

export type Evento = {
  id: string
  tipo: EventoTipo
  timeLordeId: string
  timeAdvId?: string
  inicio: string
  local: string
  status: EventoStatus
  placar?: { lorde: number; adv: number }
  confirmados: string[]
  recorrente?: boolean
  serieId?: string
  participacoes?: Participacao[]
}

export type Participacao = {
  usuarioId: string
  nome: string
  resposta?: 'VOU' | 'NAO_VOU'
  presente?: boolean
}

export type NoticiaStatus = 'Rascunho' | 'Publicada'

export type Noticia = {
  id: string
  titulo: string
  conteudo: string
  imagem: string
  data: string
  status: NoticiaStatus
  tags: string[]
  autorId?: string
  autorNome?: string
  publicadaEm?: string
}

export type Banner = {
  id: string
  titulo: string
  imagem: string
  link?: string
  ordem: number
  ativo: boolean
}

export type Usuario = {
  id: string
  nome: string
  email: string
  role: Role
  ativo: boolean
  timeId?: string
}

export type Solicitacao = {
  id: string
  usuarioId: string
  nomeUsuario: string
  timeId: string
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'CANCELADA'
  data: string
}

export type AuditLog = {
  id: string
  usuarioId: string
  nomeUsuario: string
  acao: string
  entidade: AuditEntity
  alvo: string
  data: string
}

export type AuditEntity =
  | 'Eventos'
  | 'Resultados'
  | 'Presenças'
  | 'Times e elencos'
  | 'Modalidades'
  | 'Solicitações'
  | 'Notícias'
  | 'Banners'
  | 'Usuários'
  | 'Cargos'
  | 'Avisos'

export type DemoState = 'ready' | 'loading' | 'error' | 'offline'

export type ToastItem = { id: string; message: string; type: 'success' | 'error' }

export type ConfirmState = {
  title: string
  message: string
  onConfirm: () => void
} | null
