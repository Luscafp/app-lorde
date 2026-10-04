import type { Prisma } from '../../generated/prisma/client'

/**
 * Classificação de **todos** os modelos (épico #3 §3 item 5; convenções §6). `true` = com escopo:
 * a extensão filtra por `atleticaId` do contexto. O `satisfies` obriga a classificar todo modelo
 * novo do schema — sem isso, `pnpm typecheck` falha.
 */
const TEM_ESCOPO = {
  VinculoAtletica: true,
  MembroTime: true,
  SolicitacaoEntrada: true,
  Evento: true,
  SerieRecorrencia: true,
  Participacao: true,
  Noticia: true,
  Tag: true,
  Banner: true,
  RegistroAuditoria: true,
  /** Regra especial: times próprios + times de adversárias sem app (épico #3 §3 item 6). */
  Time: true,

  // Globais ou da conta.
  Usuario: false,
  Atletica: false,
  Modalidade: false,
  PreferenciaNotificacao: false,
  DispositivoPush: false,
  /** Tem `atleticaId`, mas é lida e gravada via `semEscopo` pelo guard (#7) e pela #58. */
  Sessao: false,
  CodigoVerificacao: false,
  AceiteTermos: false,
  TentativaAcesso: false,
  /** Junção: a notícia e a tag já pertencem à atlética. */
  NoticiaTag: false,
} as const satisfies Record<Prisma.ModelName, boolean>

export const MODELOS_COM_ESCOPO: ReadonlySet<string> = new Set(
  Object.entries(TEM_ESCOPO)
    .filter(([, temEscopo]) => temEscopo)
    .map(([modelo]) => modelo),
)
