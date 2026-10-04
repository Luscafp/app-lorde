import { ErroAtleticaDivergente } from '../contexto/erros'
import { aplicarEscopo } from './extensao-atletica'
import { MODELOS_COM_ESCOPO } from './modelos-com-escopo'

const A = 'atletica-a'
const B = 'atletica-b'
const FILTRO_TIME = { OR: [{ atleticaId: A }, { atletica: { usaAplicativo: false } }] }

describe('MODELOS_COM_ESCOPO', () => {
  it('contém exatamente os modelos com escopo do épico #3 §3 item 5', () => {
    expect([...MODELOS_COM_ESCOPO].sort()).toEqual(
      [
        'VinculoAtletica',
        'MembroTime',
        'SolicitacaoEntrada',
        'Evento',
        'SerieRecorrencia',
        'Participacao',
        'Noticia',
        'Tag',
        'Banner',
        'RegistroAuditoria',
        'Time',
      ].sort(),
    )
  })
})

describe('aplicarEscopo', () => {
  describe.each([
    'findMany',
    'findFirst',
    'findFirstOrThrow',
    'count',
    'aggregate',
    'groupBy',
    'updateMany',
    'updateManyAndReturn',
    'deleteMany',
  ])('%s', (operacao) => {
    it('sem where → usa só o filtro da atlética', () => {
      expect(aplicarEscopo('Evento', operacao, {}, A).where).toEqual({ atleticaId: A })
    })

    it('preserva o where original num AND', () => {
      const where = { status: 'AGENDADO' }
      expect(aplicarEscopo('Evento', operacao, { where }, A).where).toEqual({
        AND: [where, { atleticaId: A }],
      })
    })
  })

  it('where com OR não é sobrescrito pelo filtro', () => {
    const where = { OR: [{ status: 'AGENDADO' }, { status: 'EM_ANDAMENTO' }] }
    expect(aplicarEscopo('Evento', 'findMany', { where }, A).where).toEqual({
      AND: [where, { atleticaId: A }],
    })
  })

  it('where com AND e atleticaId de outra atlética continua exigindo a do contexto', () => {
    const where = { AND: [{ tipo: 'JOGO' }], atleticaId: B }
    expect(aplicarEscopo('Evento', 'findMany', { where }, A).where).toEqual({
      AND: [where, { atleticaId: A }],
    })
  })

  it('preserva os demais argumentos e não altera o objeto recebido', () => {
    const args = { where: { tipo: 'JOGO' }, orderBy: { inicio: 'asc' }, take: 10 }
    const copia = structuredClone(args)
    const resultado = aplicarEscopo('Evento', 'findMany', args, A)
    expect(resultado).toMatchObject({ orderBy: { inicio: 'asc' }, take: 10 })
    expect(args).toEqual(copia)
  })

  describe.each(['findUnique', 'findUniqueOrThrow', 'update', 'delete', 'upsert'])(
    '%s (where único)',
    (operacao) => {
      it('mantém os campos únicos no topo e acrescenta o filtro no AND', () => {
        expect(aplicarEscopo('Evento', operacao, { where: { id: 'x' } }, A).where).toEqual({
          id: 'x',
          AND: [{ atleticaId: A }],
        })
      })

      it('preserva AND existente (objeto ou lista) e OR', () => {
        const condicao = { excluidoEm: null }
        const or = [{ tipo: 'JOGO' }, { tipo: 'TREINO' }]
        expect(
          aplicarEscopo('Evento', operacao, { where: { id: 'x', AND: condicao, OR: or } }, A).where,
        ).toEqual({ id: 'x', OR: or, AND: [condicao, { atleticaId: A }] })
        expect(
          aplicarEscopo('Evento', operacao, { where: { id: 'x', AND: [condicao] } }, A).where,
        ).toEqual({ id: 'x', AND: [condicao, { atleticaId: A }] })
      })
    },
  )

  describe('create', () => {
    it('preenche atleticaId ausente', () => {
      expect(aplicarEscopo('Evento', 'create', { data: { local: 'x' } }, A).data).toEqual({
        local: 'x',
        atleticaId: A,
      })
    })

    it('aceita atleticaId igual ao do contexto', () => {
      const data = { local: 'x', atleticaId: A }
      expect(aplicarEscopo('Evento', 'create', { data }, A).data).toEqual(data)
    })

    it('atleticaId diferente → ErroAtleticaDivergente', () => {
      expect(() =>
        aplicarEscopo('Evento', 'create', { data: { local: 'x', atleticaId: B } }, A),
      ).toThrow(ErroAtleticaDivergente)
    })

    it('forma com relação: aceita connect da atlética do contexto, rejeita outra', () => {
      const data = { local: 'x', atletica: { connect: { id: A } } }
      expect(aplicarEscopo('Evento', 'create', { data }, A).data).toEqual(data)
      expect(() =>
        aplicarEscopo('Evento', 'create', { data: { atletica: { connect: { id: B } } } }, A),
      ).toThrow(ErroAtleticaDivergente)
      expect(() =>
        aplicarEscopo('Evento', 'create', { data: { atletica: { create: { nome: 'x' } } } }, A),
      ).toThrow(ErroAtleticaDivergente)
    })
  })

  describe.each(['createMany', 'createManyAndReturn'])('%s', (operacao) => {
    it('preenche cada item da lista e aceita um único objeto', () => {
      expect(aplicarEscopo('Tag', operacao, { data: [{ nome: 'a' }, { nome: 'b' }] }, A)).toEqual({
        data: [
          { nome: 'a', atleticaId: A },
          { nome: 'b', atleticaId: A },
        ],
      })
      expect(aplicarEscopo('Tag', operacao, { data: { nome: 'a' } }, A).data).toEqual({
        nome: 'a',
        atleticaId: A,
      })
    })

    it('qualquer item com atleticaId diferente → ErroAtleticaDivergente', () => {
      expect(() =>
        aplicarEscopo('Tag', operacao, { data: [{ nome: 'a' }, { nome: 'b', atleticaId: B }] }, A),
      ).toThrow(ErroAtleticaDivergente)
    })
  })

  describe('upsert', () => {
    it('filtra o where, preenche o create e confere o update', () => {
      const args = { where: { id: 'x' }, create: { nome: 'a' }, update: { nome: 'b' } }
      expect(aplicarEscopo('Tag', 'upsert', args, A)).toEqual({
        where: { id: 'x', AND: [{ atleticaId: A }] },
        create: { nome: 'a', atleticaId: A },
        update: { nome: 'b' },
      })
    })

    it('create com atleticaId diferente → ErroAtleticaDivergente', () => {
      const args = { where: { id: 'x' }, create: { atleticaId: B }, update: {} }
      expect(() => aplicarEscopo('Tag', 'upsert', args, A)).toThrow(ErroAtleticaDivergente)
    })

    it('update movendo para outra atlética → ErroAtleticaDivergente', () => {
      const args = { where: { id: 'x' }, create: {}, update: { atleticaId: B } }
      expect(() => aplicarEscopo('Tag', 'upsert', args, A)).toThrow(ErroAtleticaDivergente)
    })
  })

  describe.each(['update', 'updateMany', 'updateManyAndReturn'])('%s — data', (operacao) => {
    it('rejeita mover o registro para outra atlética (valor direto, set ou connect)', () => {
      for (const data of [
        { atleticaId: B },
        { atleticaId: { set: B } },
        { atletica: { connect: { id: B } } },
      ]) {
        expect(() => aplicarEscopo('Evento', operacao, { where: { id: 'x' }, data }, A)).toThrow(
          ErroAtleticaDivergente,
        )
      }
    })

    it('aceita data sem atleticaId ou com a atlética do contexto', () => {
      for (const data of [{ local: 'y' }, { atleticaId: A }, { atleticaId: { set: A } }]) {
        expect(aplicarEscopo('Evento', operacao, { where: { id: 'x' }, data }, A).data).toEqual(
          data,
        )
      }
    })
  })

  describe('Time (regra especial)', () => {
    it.each(['findMany', 'count', 'updateMany', 'deleteMany'])(
      '%s → times próprios ou de adversárias sem app',
      (operacao) => {
        expect(aplicarEscopo('Time', operacao, {}, A).where).toEqual(FILTRO_TIME)
        expect(aplicarEscopo('Time', operacao, { where: { ativo: true } }, A).where).toEqual({
          AND: [{ ativo: true }, FILTRO_TIME],
        })
      },
    )

    it.each(['findUnique', 'update', 'delete', 'upsert'])(
      '%s → filtro no AND do where único',
      (op) => {
        expect(aplicarEscopo('Time', op, { where: { id: 'x' } }, A).where).toEqual({
          id: 'x',
          AND: [FILTRO_TIME],
        })
      },
    )

    it('where com OR próprio não colide com o OR da regra', () => {
      const where = { OR: [{ nome: 'a' }, { nome: 'b' }] }
      expect(aplicarEscopo('Time', 'findMany', { where }, A).where).toEqual({
        AND: [where, FILTRO_TIME],
      })
    })

    it('create não preenche nem rejeita atleticaId', () => {
      for (const data of [{ nome: 'x' }, { nome: 'x', atleticaId: B }]) {
        expect(aplicarEscopo('Time', 'create', { data }, A).data).toEqual(data)
      }
      const createMany = { data: [{ nome: 'x', atleticaId: B }] }
      expect(aplicarEscopo('Time', 'createMany', createMany, A)).toEqual(createMany)
    })

    it('upsert filtra o where e não toca no create', () => {
      const args = { where: { id: 'x' }, create: { atleticaId: B }, update: {} }
      expect(aplicarEscopo('Time', 'upsert', args, A)).toEqual({
        ...args,
        where: { id: 'x', AND: [FILTRO_TIME] },
      })
    })
  })

  it('operação desconhecida é rejeitada (falha fechada)', () => {
    expect(() => aplicarEscopo('Evento', 'findRaw', {}, A)).toThrow(/não suportada/)
  })
})
