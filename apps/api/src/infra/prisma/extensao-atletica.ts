import { Prisma } from '../../generated/prisma/client'
import type { ContextoAtletica } from '../contexto/contexto-atletica.service'
import { ErroAtleticaContextoAusente, ErroAtleticaDivergente } from '../contexto/erros'
import { MODELOS_COM_ESCOPO } from './modelos-com-escopo'

type Objeto = Record<string, unknown>

/** Exceção do épico #3 §3 item 6: inclui times de adversárias sem app e não confere `data`. */
const MODELO_TIME = 'Time'

const OPERACOES_WHERE = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
])

/** O filtro entra no `AND` do `where` único (Prisma 5+): outra atlética = "não encontrado". */
const OPERACOES_WHERE_UNICO = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
  'upsert',
])

const OPERACOES_CRIACAO = new Set(['create', 'createMany', 'createManyAndReturn'])

const OPERACOES_ALTERACAO = new Set(['update', 'updateMany', 'updateManyAndReturn'])

const ESCRITAS_DE_RELACAO = ['connect', 'connectOrCreate', 'create']

function ehObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function filtroAtletica(modelo: string, atleticaId: string): Objeto {
  if (modelo === MODELO_TIME) {
    return { OR: [{ atleticaId }, { atletica: { usaAplicativo: false } }] }
  }
  return { atleticaId }
}

function comFiltro(where: unknown, filtro: Objeto): Objeto {
  return where === undefined ? filtro : { AND: [where, filtro] }
}

function comFiltroUnico(where: unknown, filtro: Objeto): Objeto {
  const original = ehObjeto(where) ? where : {}
  const and = original.AND
  const condicoes: unknown[] = and === undefined ? [] : Array.isArray(and) ? and : [and]
  return { ...original, AND: [...condicoes, filtro] }
}

interface Alvo {
  modelo: string
  operacao: string
  atleticaId: string
}

function divergente(alvo: Alvo): ErroAtleticaDivergente {
  return new ErroAtleticaDivergente(alvo.modelo, alvo.operacao)
}

/** Forma com relações (input "checked"): o Prisma não aceita `atleticaId` escalar junto. */
function usaFormaComRelacao(dados: Objeto): boolean {
  return Object.values(dados).some(
    (valor) => ehObjeto(valor) && ESCRITAS_DE_RELACAO.some((chave) => chave in valor),
  )
}

/** Só aceita `connect`; sem `id`, o `id` do contexto vira filtro e outra atlética não é achada. */
function restringirRelacaoAtletica(relacao: unknown, alvo: Alvo): Objeto {
  if (!ehObjeto(relacao) || Object.keys(relacao).some((chave) => chave !== 'connect')) {
    throw divergente(alvo)
  }
  const { connect } = relacao
  if (!ehObjeto(connect)) throw divergente(alvo)
  if (connect.id !== undefined && connect.id !== alvo.atleticaId) throw divergente(alvo)
  return { connect: { ...connect, id: alvo.atleticaId } }
}

function preencherAtletica(dados: unknown, alvo: Alvo): unknown {
  if (!ehObjeto(dados)) return dados
  if (dados.atletica !== undefined) {
    return { ...dados, atletica: restringirRelacaoAtletica(dados.atletica, alvo) }
  }
  if (dados.atleticaId === undefined) {
    return usaFormaComRelacao(dados)
      ? { ...dados, atletica: { connect: { id: alvo.atleticaId } } }
      : { ...dados, atleticaId: alvo.atleticaId }
  }
  if (dados.atleticaId !== alvo.atleticaId) throw divergente(alvo)
  return dados
}

/** Impede mover o registro para outra atlética. */
function restringirAlteracao(dados: unknown, alvo: Alvo): unknown {
  if (!ehObjeto(dados)) return dados
  const valor = dados.atleticaId
  const novo = ehObjeto(valor) ? valor.set : valor
  if (novo !== undefined && novo !== alvo.atleticaId) throw divergente(alvo)
  if (dados.atletica === undefined) return dados
  return { ...dados, atletica: restringirRelacaoAtletica(dados.atletica, alvo) }
}

/** Restringe os `args` de um modelo com escopo à atlética do contexto, sem alterá-los. */
export function aplicarEscopo(
  modelo: string,
  operacao: string,
  args: unknown,
  atleticaId: string,
): Objeto {
  const original: Objeto = ehObjeto(args) ? args : {}
  const alvo: Alvo = { modelo, operacao, atleticaId }
  const filtro = filtroAtletica(modelo, atleticaId)
  const resultado: Objeto = { ...original }

  if (OPERACOES_WHERE.has(operacao)) {
    resultado.where = comFiltro(original.where, filtro)
  } else if (OPERACOES_WHERE_UNICO.has(operacao)) {
    resultado.where = comFiltroUnico(original.where, filtro)
  } else if (!OPERACOES_CRIACAO.has(operacao)) {
    throw new Error(`Operação ${modelo}.${operacao} não suportada pela extensão multi-atlética.`)
  }

  if (modelo === MODELO_TIME) return resultado

  if (OPERACOES_CRIACAO.has(operacao)) {
    const { data } = original
    resultado.data = Array.isArray(data)
      ? data.map((item) => preencherAtletica(item, alvo))
      : preencherAtletica(data, alvo)
  }
  if (OPERACOES_ALTERACAO.has(operacao)) resultado.data = restringirAlteracao(original.data, alvo)
  if (operacao === 'upsert') {
    resultado.create = preencherAtletica(original.create, alvo)
    resultado.update = restringirAlteracao(original.update, alvo)
  }

  return resultado
}

/** Filtro por atlética (RNF20) com falha fechada; vale também dentro de `$transaction`. */
export function extensaoAtletica(contexto: Pick<ContextoAtletica, 'atleticaId'>) {
  return Prisma.defineExtension({
    name: 'atletica',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!MODELOS_COM_ESCOPO.has(model)) return query(args)
          const atleticaId = contexto.atleticaId()
          if (!atleticaId) throw new ErroAtleticaContextoAusente(model, operation)
          return query(aplicarEscopo(model, operation, args, atleticaId))
        },
      },
    },
  })
}
