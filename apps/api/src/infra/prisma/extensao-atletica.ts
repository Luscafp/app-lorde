import { Prisma } from '../../generated/prisma/client'
import type { ContextoAtletica } from '../contexto/contexto-atletica.service'
import { AtleticaContextoAusenteError, ErroAtleticaDivergente } from '../contexto/erros'
import { MODELOS_COM_ESCOPO } from './modelos-com-escopo'

type Objeto = Record<string, unknown>

/** Operações com `where` comum: o filtro entra num `AND` com o `where` original. */
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

/**
 * Operações com `where` único: o filtro entra no `AND` do próprio `where`, mantendo os campos
 * únicos no topo (`extendedWhereUnique`, Prisma 5+). Registro de outra atlética = "não encontrado".
 */
const OPERACOES_WHERE_UNICO = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'delete',
  'upsert',
])

const OPERACOES_CRIACAO = new Set(['create', 'createMany', 'createManyAndReturn'])

/** Operações com `data` de alteração (em `upsert`, o `update`). */
const OPERACOES_ALTERACAO = new Set(['update', 'updateMany', 'updateManyAndReturn'])

function ehObjeto(valor: unknown): valor is Objeto {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** `Time`: times próprios e de adversárias sem app ficam visíveis (épico #3 §3 item 6). */
function filtroAtletica(modelo: string, atleticaId: string): Objeto {
  if (modelo === 'Time') return { OR: [{ atleticaId }, { atletica: { usaAplicativo: false } }] }
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

/** Forma com relação (`atletica: { connect: { id } }`): só aceita a atlética do contexto. */
function conferirRelacaoAtletica(dados: Objeto, alvo: Alvo): void {
  const relacao = dados.atletica
  const connect = ehObjeto(relacao) ? relacao.connect : undefined
  if (!ehObjeto(connect) || connect.id !== alvo.atleticaId) {
    throw new ErroAtleticaDivergente(alvo.modelo, alvo.operacao)
  }
}

/** Criação: preenche `atleticaId` ausente; diferente do contexto é bug de programação. */
function preencherAtletica(dados: unknown, alvo: Alvo): unknown {
  if (!ehObjeto(dados)) return dados
  if ('atletica' in dados) {
    conferirRelacaoAtletica(dados, alvo)
    return dados
  }
  if (dados.atleticaId === undefined) return { ...dados, atleticaId: alvo.atleticaId }
  if (dados.atleticaId !== alvo.atleticaId) {
    throw new ErroAtleticaDivergente(alvo.modelo, alvo.operacao)
  }
  return dados
}

/** Alteração: impede mover o registro para outra atlética. */
function conferirAlteracao(dados: unknown, alvo: Alvo): void {
  if (!ehObjeto(dados)) return
  if ('atletica' in dados) conferirRelacaoAtletica(dados, alvo)
  const valor = dados.atleticaId
  const novo = ehObjeto(valor) ? valor.set : valor
  if (novo !== undefined && novo !== alvo.atleticaId) {
    throw new ErroAtleticaDivergente(alvo.modelo, alvo.operacao)
  }
}

/**
 * Devolve os argumentos de uma operação sobre um modelo **com escopo** restritos à atlética do
 * contexto (tabela do épico #3 §3 item 5). Não altera `args`. Operação desconhecida é rejeitada
 * (falha fechada).
 *
 * `Time` (item 6): o filtro de leitura/escrita por `where` inclui times de adversárias sem app, e
 * `create`/`data` não são preenchidos nem conferidos — o service da #16 valida a atlética.
 */
export function aplicarEscopo(
  modelo: string,
  operacao: string,
  args: unknown,
  atleticaId: string,
): Objeto {
  const original: Objeto = ehObjeto(args) ? args : {}
  const alvo: Alvo = { modelo, operacao, atleticaId }
  const filtro = filtroAtletica(modelo, atleticaId)
  const conferirDados = modelo !== 'Time'
  const resultado: Objeto = { ...original }

  if (OPERACOES_WHERE.has(operacao)) {
    resultado.where = comFiltro(original.where, filtro)
  } else if (OPERACOES_WHERE_UNICO.has(operacao)) {
    resultado.where = comFiltroUnico(original.where, filtro)
  } else if (!OPERACOES_CRIACAO.has(operacao)) {
    throw new Error(`Operação ${modelo}.${operacao} não suportada pela extensão multi-atlética.`)
  }

  if (conferirDados) {
    if (OPERACOES_CRIACAO.has(operacao)) {
      const { data } = original
      resultado.data = Array.isArray(data)
        ? data.map((item) => preencherAtletica(item, alvo))
        : preencherAtletica(data, alvo)
    }
    if (OPERACOES_ALTERACAO.has(operacao)) conferirAlteracao(original.data, alvo)
    if (operacao === 'upsert') {
      resultado.create = preencherAtletica(original.create, alvo)
      conferirAlteracao(original.update, alvo)
    }
  }

  return resultado
}

/**
 * Extensão do Prisma que aplica o filtro por atlética (RNF20) aos modelos com escopo, com falha
 * fechada: sem atlética no contexto, lança `AtleticaContextoAusenteError` antes de ir ao banco.
 * Também vale dentro de `$transaction`. Não filtra `include`, escritas aninhadas nem `$queryRaw`
 * (limitações no README).
 */
export function extensaoAtletica(contexto: Pick<ContextoAtletica, 'atleticaId'>) {
  return Prisma.defineExtension({
    name: 'atletica',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!MODELOS_COM_ESCOPO.has(model)) return query(args)
          const atleticaId = contexto.atleticaId()
          if (!atleticaId) throw new AtleticaContextoAusenteError(model, operation)
          return query(aplicarEscopo(model, operation, args, atleticaId))
        },
      },
    },
  })
}
