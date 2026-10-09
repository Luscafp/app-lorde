import { ROTULO_PAPEL } from '../auth/papeis'
import { DATA_LOCAL, formatarDataHora, formatarDataLocal } from '../utils/datas'
import type { AcaoAuditoria, EntidadeAuditoria } from './acoes'

export const ROTULO_AUTOR_EXCLUIDO = 'Usuário excluído'
export const ROTULO_SISTEMA = 'Sistema'
export const VALOR_VAZIO = '—'

/** Quem adiciona uma ação ao catálogo adiciona o rótulo aqui (o teste falha sem ele). */
export const ROTULOS_ACAO: Readonly<Record<AcaoAuditoria, string>> = {
  MODALIDADE_CRIADA: 'Modalidade criada',
  MODALIDADE_ALTERADA: 'Modalidade alterada',
  MODALIDADE_ATIVADA: 'Modalidade ativada',
  MODALIDADE_DESATIVADA: 'Modalidade desativada',
  MODALIDADE_EXCLUIDA: 'Modalidade excluída',
  ATLETICA_ADVERSARIA_CRIADA: 'Atlética adversária criada',
  ATLETICA_ADVERSARIA_ALTERADA: 'Atlética adversária alterada',
  TIME_CRIADO: 'Time criado',
  TIME_ALTERADO: 'Time alterado',
  TIME_ATIVADO: 'Time ativado',
  TIME_DESATIVADO: 'Time desativado',
  TIME_EXCLUIDO: 'Time excluído',
  CAPITAO_DEFINIDO: 'Capitão definido',
  CAPITAO_REMOVIDO: 'Capitão removido',
  MEMBRO_ADICIONADO: 'Membro adicionado ao time',
  MEMBRO_REMOVIDO: 'Membro removido do time',
  MEMBRO_REMOVIDO_EXCLUSAO_CONTA: 'Membro removido por exclusão de conta',
  MEMBRO_SAIU: 'Membro saiu do time',
  SOLICITACAO_APROVADA: 'Solicitação aprovada',
  SOLICITACAO_REJEITADA: 'Solicitação rejeitada',
  EVENTO_CRIADO: 'Evento criado',
  EVENTO_ALTERADO: 'Evento alterado',
  EVENTO_CANCELADO: 'Evento cancelado',
  EVENTO_EXCLUIDO: 'Evento excluído',
  EVENTO_STATUS_ALTERADO: 'Status do evento alterado',
  RESULTADO_REGISTRADO: 'Resultado registrado',
  RESULTADO_CORRIGIDO: 'Resultado corrigido',
  SERIE_CRIADA: 'Treino recorrente criado',
  SERIE_ALTERADA: 'Treino recorrente alterado',
  SERIE_DIVIDIDA: 'Treino recorrente dividido',
  PRESENCAS_REGISTRADAS: 'Presenças registradas',
  NOTICIA_CRIADA: 'Notícia criada',
  NOTICIA_ALTERADA: 'Notícia alterada',
  NOTICIA_PUBLICADA: 'Notícia publicada',
  NOTICIA_DESPUBLICADA: 'Notícia despublicada',
  NOTICIA_EXCLUIDA: 'Notícia excluída',
  BANNER_CRIADO: 'Banner criado',
  BANNER_ALTERADO: 'Banner alterado',
  BANNER_REORDENADO: 'Banners reordenados',
  BANNER_EXCLUIDO: 'Banner excluído',
  USUARIO_DESATIVADO: 'Usuário desativado',
  USUARIO_REATIVADO: 'Usuário reativado',
  CARGO_ALTERADO: 'Cargo alterado',
  CONTA_EXCLUIDA: 'Conta excluída',
  AVISO_ENVIADO: 'Aviso enviado',
}

export const ROTULOS_ENTIDADE: Readonly<Record<EntidadeAuditoria, string>> = {
  Modalidade: 'Modalidade',
  Atletica: 'Atlética adversária',
  Time: 'Time',
  MembroTime: 'Membro do time',
  SolicitacaoEntrada: 'Solicitação de entrada',
  Evento: 'Evento',
  SerieRecorrencia: 'Treino recorrente',
  Participacao: 'Presenças',
  Noticia: 'Notícia',
  Banner: 'Banner',
  VinculoAtletica: 'Usuário',
  Usuario: 'Conta',
  Aviso: 'Aviso',
}

/** Campo sem rótulo aparece com o código cru. */
export const ROTULOS_CAMPO: Readonly<Record<string, string>> = {
  nome: 'Nome',
  sigla: 'Sigla',
  curso: 'Curso',
  icone: 'Ícone',
  ativa: 'Ativa',
  ativo: 'Ativo',
  modalidadeId: 'Modalidade',
  atleticaId: 'Atlética',
  capitaoId: 'Capitão',
  timeId: 'Time',
  timeIds: 'Times',
  usuarioId: 'Usuário',
  usuarioIds: 'Usuários',
  eventoId: 'Evento',
  entradaEm: 'Entrada em',
  saidaEm: 'Saída em',
  status: 'Status',
  tipo: 'Tipo',
  timeAdversarioId: 'Adversário',
  serieId: 'Treino recorrente',
  novaSerieId: 'Novo treino recorrente',
  inicio: 'Início',
  local: 'Local',
  observacoes: 'Observações',
  placarTime: 'Placar da atlética',
  placarAdversario: 'Placar do adversário',
  resultado: 'Resultado',
  diasSemana: 'Dias da semana',
  horario: 'Horário',
  dataInicio: 'Data de início',
  dataFim: 'Data de término',
  canceladaEm: 'Cancelada em',
  titulo: 'Título',
  conteudoAlterado: 'Conteúdo alterado',
  capaAlterada: 'Capa alterada',
  publicadaEm: 'Publicada em',
  primeiraPublicacao: 'Primeira publicação',
  papel: 'Cargo',
  solicitacaoId: 'Solicitação',
  jaEraMembro: 'Já era membro',
  capitaniaRemovida: 'Capitania removida',
  participacoesRemovidas: 'Participações removidas',
  escopo: 'Alcance',
  totalOcorrencias: 'Total de treinos',
  substituidoPor: 'Substituído por',
  presente: 'Presente',
  presentes: 'Presentes',
  ausentes: 'Ausentes',
  link: 'Link',
  ordem: 'Ordem',
  imagemAlterada: 'Imagem alterada',
}

/** Só os campos de enum têm o valor traduzido: texto livre aparece como foi gravado. */
const ROTULOS_VALOR_ENUM: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  status: {
    AGENDADO: 'Agendado',
    EM_ANDAMENTO: 'Em andamento',
    FINALIZADO: 'Finalizado',
    CANCELADO: 'Cancelado',
    RASCUNHO: 'Rascunho',
    PUBLICADA: 'Publicada',
    PENDENTE: 'Pendente',
    APROVADA: 'Aprovada',
    REJEITADA: 'Rejeitada',
    CANCELADA: 'Cancelada',
  },
  tipo: { JOGO: 'Jogo', TREINO: 'Treino' },
  resultado: { VITORIA: 'Vitória', EMPATE: 'Empate', DERROTA: 'Derrota' },
  papel: ROTULO_PAPEL,
  escopo: { ESTA: 'Somente este treino', ESTA_E_SEGUINTES: 'Este e os seguintes' },
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

const INSTANTE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

export function rotuloAcao(acao: string): string {
  return (ROTULOS_ACAO as Record<string, string>)[acao] ?? acao
}

export function rotuloEntidade(entidade: string): string {
  return (ROTULOS_ENTIDADE as Record<string, string>)[entidade] ?? entidade
}

export function rotuloCampo(campo: string): string {
  return ROTULOS_CAMPO[campo] ?? campo
}

/** Id → nome resolvido pela API (`referencias` do detalhe). */
export type Referencias = Readonly<Record<string, string>>

/** Valor de `dados` pronto para exibir: datas no fuso padrão, enums e booleanos legíveis. */
export function formatarValorAuditoria(
  campo: string,
  valor: unknown,
  referencias: Referencias = {},
): string {
  if (valor === null || valor === undefined) return VALOR_VAZIO
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  if (typeof valor === 'number') {
    return campo === 'diasSemana' ? (DIAS_SEMANA[valor] ?? String(valor)) : String(valor)
  }
  if (Array.isArray(valor)) {
    if (valor.length === 0) return VALOR_VAZIO
    return valor.map((item) => formatarValorAuditoria(campo, item, referencias)).join(', ')
  }
  if (typeof valor === 'string') return formatarTexto(campo, valor, referencias)
  return JSON.stringify(valor)
}

function formatarTexto(campo: string, valor: string, referencias: Referencias): string {
  const enumerado = ROTULOS_VALOR_ENUM[campo]?.[valor]
  if (enumerado) return enumerado
  if (referencias[valor]) return referencias[valor]
  if (DATA_LOCAL.test(valor)) return formatarDataLocal(valor)
  if (INSTANTE_ISO.test(valor)) {
    try {
      return formatarDataHora(valor)
    } catch {
      return valor
    }
  }
  return valor
}

export interface AlteracaoCampo {
  campo: string
  rotulo: string
  antes: string
  depois: string
}

export interface ItemContexto {
  campo: string
  rotulo: string
  valor: string
}

export interface AlteracoesAuditoria {
  alteracoes: AlteracaoCampo[]
  contexto: ItemContexto[]
}

type Campos = Record<string, unknown>

function ehCampos(valor: unknown): valor is Campos {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function camposOuNulo(valor: unknown): valor is Campos | null {
  return valor === null || ehCampos(valor)
}

/** Tabela Campo · Antes · Depois; `null` quando `dados` não segue `{ antes, depois, contexto? }`. */
export function alteracoesDaAuditoria(
  dados: unknown,
  referencias: Referencias = {},
): AlteracoesAuditoria | null {
  if (!ehCampos(dados) || !('antes' in dados) || !('depois' in dados)) return null
  const { antes, depois, contexto, ...resto } = dados
  if (!camposOuNulo(antes) || !camposOuNulo(depois) || Object.keys(resto).length > 0) return null
  if (contexto !== undefined && !ehCampos(contexto)) return null

  const campos = [...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})])]
  return {
    alteracoes: campos.map((campo) => ({
      campo,
      rotulo: rotuloCampo(campo),
      antes: antes ? formatarValorAuditoria(campo, antes[campo], referencias) : VALOR_VAZIO,
      depois: depois ? formatarValorAuditoria(campo, depois[campo], referencias) : VALOR_VAZIO,
    })),
    contexto: Object.entries(contexto ?? {}).map(([campo, valor]) => ({
      campo,
      rotulo: rotuloCampo(campo),
      valor: formatarValorAuditoria(campo, valor, referencias),
    })),
  }
}
