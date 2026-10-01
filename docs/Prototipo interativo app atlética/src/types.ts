// Papel no vínculo com a atlética (VinculoAtletica.papel). Presidente e Vice têm as mesmas permissões (RN05).
export type Role = 'atleta' | 'diretor' | 'vice' | 'presidente' | 'admin'
export type Tab = 'home' | 'agenda' | 'modalidades' | 'perfil'
export type Screen = Tab | 'painel'
export type AgendaTab = 'eventos' | 'placar'

// Catálogo global (sem atleticaId) — seção 7.2
export type Modalidade = { id: string; nome: string; emoji: string; cor: string; ativa: boolean }

// Atléticas adversárias são registros de Atletica com usaAplicativo = false (RN21)
export type Atletica = { id: string; nome: string; curso: string; usaAplicativo: boolean }

export type Time = {
  id: string
  nome: string
  modalidadeId: string
  atleticaId: string
  capitaoId?: string
  ativo: boolean
}

// Elenco: vínculo do usuário com o time, separado da solicitação (seção 7.2)
// saidaEm preenchido = passagem encerrada (o histórico do elenco é preservado)
export type MembroTime = { timeId: string; usuarioId: string; entradaEm: string; saidaEm?: string }

export type EventoStatus = 'Agendado' | 'Em andamento' | 'Finalizado' | 'Cancelado'
export type EventoTipo = 'JOGO' | 'TREINO'
export type Resultado = 'VITORIA' | 'EMPATE' | 'DERROTA'

export type Evento = {
  id: string
  tipo: EventoTipo
  timeId: string
  timeAdversarioId?: string
  inicio: string // data e hora em um único campo (dd/mm/aaaa HH:mm na interface)
  local: string
  status: EventoStatus
  placarTime?: number
  placarAdversario?: number
  serieId?: string // ocorrência de um treino recorrente (SerieRecorrencia)
}

// confirmado = resposta do atleta ("Vou"/"Não vou"); presente = registro da diretoria.
// São independentes: apenas presente entra nas estatísticas (RN32).
export type Participacao = {
  eventoId: string
  usuarioId: string
  confirmado: boolean | null
  respondidoEm?: string
  presente: boolean | null
}

export type NoticiaStatus = 'Rascunho' | 'Publicada'

export type Noticia = {
  id: string
  titulo: string
  conteudo: string
  imagem: string
  status: NoticiaStatus
  tags: string[]
  criadaEm: string
  autorId?: string
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
  excluido?: boolean
}

export type StatusSolicitacao = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'CANCELADA'

export type Solicitacao = {
  id: string
  usuarioId: string
  timeId: string
  status: StatusSolicitacao
  criadaEm: string
  avaliadaEm?: string
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

export type AuditLog = {
  id: string
  usuarioId: string
  nomeUsuario: string
  acao: string
  entidade: AuditEntity
  alvo: string
  data: string
}

// Estados simulados pelo menu Demo (UC01 A2/A3, RNF19, UC12 A1)
export type DemoFlags = {
  offline: boolean
  carregando: boolean
  erro: boolean
  notifNegada: boolean
}

export type ToastItem = { id: string; message: string; type: 'success' | 'error' }

export type ConfirmState = {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
} | null
