import { mapearExcecao } from '../../src/common/filtros/excecao-global.filter'
import { Prisma } from '../../src/generated/prisma/client'
import * as enumsPrisma from '../../src/generated/prisma/enums'
import { criarAtletica } from '../fabricas/atletica'
import { criarEvento as criarEventoDaFabrica } from '../fabricas/eventos'
import { criarModalidade } from '../fabricas/modalidades'
import { criarAtleticaAdversaria, criarTime } from '../fabricas/times'
import { criarUsuario } from '../fabricas/usuario'
import { listarTabelas } from '../setup/limpar-banco'
import { prismaTeste } from '../setup/prisma-teste'

/**
 * Constraints da migration `init` (épico #3, seções 4 e 8.3): um caso aceito e um rejeitado para
 * cada uma — critérios 1, 9 a 14 e 16 do épico #3. Os casos rejeitados conferem o nome da
 * constraint violada, para não passarem por outro motivo.
 */

const SQLSTATE_UNICO = '23505'
const SQLSTATE_CHECK = '23514'

interface Violacao {
  sqlstate: string
  constraint: string | undefined
}

/**
 * Lê SQLSTATE e nome da constraint do erro do Prisma com o adapter `pg`. Falha alto se o formato
 * do erro mudar (outra versão do Prisma), em vez de comparar com `undefined`.
 */
function lerViolacao(erro: unknown): Violacao {
  const causa = (erro as { meta?: { driverAdapterError?: { cause?: Record<string, unknown> } } })
    .meta?.driverAdapterError?.cause
  if (typeof causa?.originalCode !== 'string') {
    throw new Error('erro sem SQLSTATE em meta.driverAdapterError.cause.originalCode', {
      cause: erro,
    })
  }
  const indice = (causa.constraint as { index?: string } | undefined)?.index
  const mensagem = typeof causa.originalMessage === 'string' ? causa.originalMessage : ''
  return {
    sqlstate: causa.originalCode,
    constraint: indice ?? /constraint "([^"]+)"/.exec(mensagem)?.[1],
  }
}

/** Espera que o banco rejeite a operação pela constraint `nome` e que a API a mapeie (§4.1). */
async function esperarViolacao(operacao: Promise<unknown>, nome: string): Promise<void> {
  const erro: unknown = await operacao.then(
    () => {
      throw new Error(`esperava violação de "${nome}", mas a operação foi aceita`)
    },
    (e: unknown) => e,
  )
  const violacao = lerViolacao(erro)
  expect(violacao.constraint).toBe(nome)
  if (violacao.sqlstate === SQLSTATE_CHECK) {
    expect(mapearExcecao(erro)).toMatchObject({ statusCode: 422, code: 'ESTADO_INVALIDO' })
  } else {
    expect(violacao.sqlstate).toBe(SQLSTATE_UNICO)
    expect(erro).toMatchObject({ code: 'P2002' })
    expect(mapearExcecao(erro)).toMatchObject({ statusCode: 409, code: 'REGISTRO_DUPLICADO' })
  }
}

/** Atlética com app, adversária, um time de cada (mesma modalidade) e um diretor. */
async function montarCenario() {
  const atletica = await criarAtletica()
  const adversaria = await criarAtleticaAdversaria()
  const modalidade = await criarModalidade()
  const time = await criarTime({ atleticaId: atletica.id, modalidadeId: modalidade.id })
  const timeAdversario = await criarTime({ atleticaId: adversaria.id, modalidadeId: modalidade.id })
  const diretor = await criarUsuario({ atleticaId: atletica.id, papel: 'DIRETOR' })
  return { atletica, adversaria, modalidade, time, timeAdversario, diretor }
}
type Cenario = Awaited<ReturnType<typeof montarCenario>>

/** JOGO por padrão; os valores informados vão direto para o banco. */
function criarEvento(cenario: Cenario, dados: Partial<Prisma.EventoUncheckedCreateInput> = {}) {
  return criarEventoDaFabrica({
    atleticaId: cenario.atletica.id,
    tipo: 'JOGO',
    timeId: cenario.time.id,
    criadoPorId: cenario.diretor.id,
    ...dados,
  })
}

function dadosSerie(
  cenario: Cenario,
  dados: Partial<Prisma.SerieRecorrenciaUncheckedCreateInput> = {},
): Prisma.SerieRecorrenciaUncheckedCreateInput {
  return {
    atleticaId: cenario.atletica.id,
    timeId: cenario.time.id,
    diasSemana: [1, 3],
    horario: '19:30',
    dataInicio: new Date('2026-11-01'),
    dataFim: new Date('2027-05-01'),
    local: 'Ginásio',
    criadoPorId: cenario.diretor.id,
    ...dados,
  }
}

describe('Constraints do schema (épico #3 §8.3)', () => {
  describe('estrutura da migration init (critério 1)', () => {
    const INDICES_PARCIAIS = [
      'vinculo_presidente_unico',
      'vinculo_vice_unico',
      'membro_time_ativo_unico',
      'solicitacao_pendente_unica',
    ]
    const INDICES_NAO_PARCIAIS = ['modalidade_nome_unico', 'time_nome_unico']
    const CHECKS = [
      'usuario_email_minusculo',
      'atletica_dados_app',
      'atletica_cores_hex',
      'preferencia_antecedencia',
      'membro_saida_apos_entrada',
      'solicitacao_avaliacao_coerente',
      'evento_tipo_coerente',
      'evento_times_distintos',
      'evento_placar_completo',
      'evento_placar_nao_negativo',
      'evento_resultado_finalizado',
      'evento_placar_faixa',
      'evento_resultado_coerente',
      'serie_dias_validos',
      'serie_horario_formato',
      'serie_periodo_valido',
      'serie_limite_6_meses',
      'participacao_resposta_coerente',
      'participacao_presenca_coerente',
      'noticia_publicada_com_data',
      'banner_link_https',
      'banner_ordem_nao_negativa',
    ]

    it('cria uma tabela para cada modelo do schema', async () => {
      expect(await listarTabelas()).toEqual(expect.arrayContaining(Object.values(Prisma.ModelName)))
    })

    it('cria os enums do schema com os mesmos valores', async () => {
      const linhas = await prismaTeste.$queryRaw<{ nome: string; valores: string[] }[]>`
        SELECT t.typname::text AS nome,
          array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS valores
        FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace AND n.nspname = 'public'
        GROUP BY t.typname`
      const noBanco = Object.fromEntries(linhas.map(({ nome, valores }) => [nome, valores]))
      const noSchema = Object.fromEntries(
        Object.entries(enumsPrisma).map(([nome, valores]) => [nome, Object.values(valores)]),
      )
      expect(noBanco).toEqual(noSchema)
    })

    it('cria a extensão unaccent', async () => {
      const linhas = await prismaTeste.$queryRaw<{ extname: string }[]>`
        SELECT extname FROM pg_extension WHERE extname = 'unaccent'`
      expect(linhas).toHaveLength(1)
    })

    it('cria os índices únicos parciais e os por expressão (não parciais)', async () => {
      const linhas = await prismaTeste.$queryRaw<{ indexname: string; indexdef: string }[]>`
        SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`
      const definicoes = new Map(linhas.map(({ indexname, indexdef }) => [indexname, indexdef]))

      for (const nome of [...INDICES_PARCIAIS, ...INDICES_NAO_PARCIAIS]) {
        expect(definicoes.get(nome)).toMatch(/^CREATE UNIQUE INDEX /)
      }
      for (const nome of INDICES_PARCIAIS) expect(definicoes.get(nome)).toMatch(/ WHERE /)
      for (const nome of INDICES_NAO_PARCIAIS) {
        expect(definicoes.get(nome)).not.toMatch(/ WHERE /)
        expect(definicoes.get(nome)).toMatch(/lower\(/)
      }
    })

    it('Time: índice de listagem (atleticaId, modalidadeId, ativo) e sem `excluidoEm` (#43)', async () => {
      const [indice] = await prismaTeste.$queryRaw<{ indexdef: string }[]>`
        SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'Time_atleticaId_modalidadeId_ativo_idx'`
      expect(indice?.indexdef).toMatch(/\("atleticaId", "modalidadeId", ativo\)/)

      const colunas = await prismaTeste.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Time'`
      expect(colunas.map(({ column_name }) => column_name)).not.toContain('excluidoEm')
    })

    it('cria todos os CHECK', async () => {
      const linhas = await prismaTeste.$queryRaw<{ conname: string }[]>`
        SELECT conname FROM pg_constraint
        WHERE contype = 'c' AND connamespace = 'public'::regnamespace`
      expect(linhas.map(({ conname }) => conname)).toEqual(expect.arrayContaining(CHECKS))
    })

    it('não duplica CHECKs com sufixo _chk (#73)', async () => {
      const linhas = await prismaTeste.$queryRaw<{ conname: string }[]>`
        SELECT conname FROM pg_constraint
        WHERE contype = 'c' AND connamespace = 'public'::regnamespace AND right(conname, 4) = '_chk'`
      expect(linhas).toEqual([])
    })
  })

  describe('Usuario', () => {
    it('aceita e-mail minúsculo e rejeita maiúsculas (usuario_email_minusculo)', async () => {
      const dados = { nome: 'Ana', senhaHash: 'x' }
      await prismaTeste.usuario.create({ data: { ...dados, email: 'ana@ex.com' } })
      await esperarViolacao(
        prismaTeste.usuario.create({ data: { ...dados, email: 'Bia@ex.com' } }),
        'usuario_email_minusculo',
      )
    })

    it('rejeita e-mail repetido (RN01)', async () => {
      await criarUsuario({ email: 'ana@ex.com' })
      await esperarViolacao(criarUsuario({ email: 'ana@ex.com' }), 'Usuario_email_key')
    })
  })

  describe('Atletica', () => {
    it('atlética com app exige slug, sigla e cores; adversária não (atletica_dados_app)', async () => {
      await prismaTeste.atletica.create({ data: { nome: 'Adversária', usaAplicativo: false } })
      await prismaTeste.atletica.create({
        data: {
          nome: 'Lorde',
          usaAplicativo: true,
          slug: 'lorde',
          sigla: 'AAL',
          corPrimaria: '#000000',
          corSecundaria: '#FFFFFF',
        },
      })
      await esperarViolacao(
        prismaTeste.atletica.create({
          data: {
            nome: 'Sem sigla',
            usaAplicativo: true,
            slug: 'sem-sigla',
            corPrimaria: '#000000',
            corSecundaria: '#FFFFFF',
          },
        }),
        'atletica_dados_app',
      )
    })

    it('cores no formato #RRGGBB (atletica_cores_hex)', async () => {
      await criarAtletica({ corPrimaria: '#a1B2c3' })
      await esperarViolacao(criarAtletica({ corPrimaria: 'red' }), 'atletica_cores_hex')
      await esperarViolacao(
        criarAtletica({ usaAplicativo: false, corSecundaria: '#12345G' }),
        'atletica_cores_hex',
      )
    })
  })

  describe('VinculoAtletica — RN07 (critério 13)', () => {
    it.each([
      ['PRESIDENTE', 'vinculo_presidente_unico'],
      ['VICE_PRESIDENTE', 'vinculo_vice_unico'],
    ] as const)('um %s por atlética, mesmo desativado (%s)', async (papel, indice) => {
      const atletica = await criarAtletica()
      const outra = await criarAtletica()
      const atual = await criarUsuario({ atleticaId: atletica.id, papel, vinculoAtivo: false })
      await criarUsuario({ atleticaId: outra.id, papel })

      await esperarViolacao(criarUsuario({ atleticaId: atletica.id, papel }), indice)

      await prismaTeste.vinculoAtletica.update({
        where: { id: atual.vinculo.id },
        data: { papel: 'ATLETA' },
      })
      await expect(criarUsuario({ atleticaId: atletica.id, papel })).resolves.toBeDefined()
    })

    it('vários diretores e atletas na mesma atlética são aceitos', async () => {
      const atletica = await criarAtletica()
      for (const papel of ['DIRETOR', 'DIRETOR', 'ATLETA', 'ATLETA'] as const) {
        await criarUsuario({ atleticaId: atletica.id, papel })
      }
      expect(await prismaTeste.vinculoAtletica.count()).toBe(4)
    })
  })

  describe('PreferenciaNotificacao', () => {
    it('antecedência só 1, 2, 6 ou 24 horas (preferencia_antecedencia)', async () => {
      for (const horas of [1, 2, 6, 24]) {
        const { id } = await criarUsuario()
        await prismaTeste.preferenciaNotificacao.create({
          data: { usuarioId: id, antecedenciaLembreteHoras: horas },
        })
      }
      const { id } = await criarUsuario()
      await esperarViolacao(
        prismaTeste.preferenciaNotificacao.create({
          data: { usuarioId: id, antecedenciaLembreteHoras: 3 },
        }),
        'preferencia_antecedencia',
      )
    })
  })

  describe('Modalidade e Time — nomes únicos não parciais (critério 16)', () => {
    it('modalidade: Futsal e futsal colidem, mesmo inativa (modalidade_nome_unico)', async () => {
      await criarModalidade({ nome: 'Futsal', ativa: false })
      await criarModalidade({ nome: 'Vôlei' })
      await esperarViolacao(criarModalidade({ nome: 'futsal' }), 'modalidade_nome_unico')
    })

    it('time: nome único por atlética e modalidade, sem diferenciar maiúsculas (time_nome_unico)', async () => {
      const atletica = await criarAtletica()
      const outra = await criarAtletica()
      const futsal = await criarModalidade({ nome: 'Futsal' })
      const volei = await criarModalidade({ nome: 'Vôlei' })
      const time = await criarTime({
        atleticaId: atletica.id,
        modalidadeId: futsal.id,
        nome: 'Lorde A',
      })
      await prismaTeste.time.update({ where: { id: time.id }, data: { ativo: false } })

      await criarTime({ atleticaId: atletica.id, modalidadeId: volei.id, nome: 'Lorde A' })
      await criarTime({ atleticaId: outra.id, modalidadeId: futsal.id, nome: 'Lorde A' })
      await esperarViolacao(
        criarTime({ atleticaId: atletica.id, modalidadeId: futsal.id, nome: 'LORDE a' }),
        'time_nome_unico',
      )
    })
  })

  describe('MembroTime', () => {
    it('um vínculo ativo por usuário e time (membro_time_ativo_unico, critério 10)', async () => {
      const cenario = await montarCenario()
      const atleta = await criarUsuario({ atleticaId: cenario.atletica.id })
      const dados = {
        atleticaId: cenario.atletica.id,
        timeId: cenario.time.id,
        usuarioId: atleta.id,
      }
      const vinculo = await prismaTeste.membroTime.create({ data: dados })

      await esperarViolacao(
        prismaTeste.membroTime.create({ data: dados }),
        'membro_time_ativo_unico',
      )

      await prismaTeste.membroTime.update({
        where: { id: vinculo.id },
        data: { saidaEm: new Date() },
      })
      await expect(prismaTeste.membroTime.create({ data: dados })).resolves.toBeDefined()
    })

    it('saída não antes da entrada (membro_saida_apos_entrada)', async () => {
      const cenario = await montarCenario()
      const entradaEm = new Date('2026-10-01T12:00:00Z')
      const dados = { atleticaId: cenario.atletica.id, timeId: cenario.time.id, entradaEm }
      await prismaTeste.membroTime.create({
        data: { ...dados, usuarioId: (await criarUsuario()).id, saidaEm: entradaEm },
      })
      await esperarViolacao(
        prismaTeste.membroTime.create({
          data: {
            ...dados,
            usuarioId: (await criarUsuario()).id,
            saidaEm: new Date('2026-09-30T12:00:00Z'),
          },
        }),
        'membro_saida_apos_entrada',
      )
    })
  })

  describe('SolicitacaoEntrada', () => {
    it('uma PENDENTE por usuário e time (solicitacao_pendente_unica, critério 9)', async () => {
      const cenario = await montarCenario()
      const atleta = await criarUsuario({ atleticaId: cenario.atletica.id })
      const dados = {
        atleticaId: cenario.atletica.id,
        timeId: cenario.time.id,
        usuarioId: atleta.id,
      }
      const primeira = await prismaTeste.solicitacaoEntrada.create({ data: dados })

      await esperarViolacao(
        prismaTeste.solicitacaoEntrada.create({ data: dados }),
        'solicitacao_pendente_unica',
      )

      await prismaTeste.solicitacaoEntrada.update({
        where: { id: primeira.id },
        data: { status: 'REJEITADA', avaliadaEm: new Date(), avaliadoPorId: cenario.diretor.id },
      })
      await expect(prismaTeste.solicitacaoEntrada.create({ data: dados })).resolves.toBeDefined()
    })

    it.each(['APROVADA', 'REJEITADA'] as const)(
      '%s exige avaliadaEm (solicitacao_avaliacao_coerente)',
      async (status) => {
        const cenario = await montarCenario()
        const base = { atleticaId: cenario.atletica.id, timeId: cenario.time.id, status }
        await prismaTeste.solicitacaoEntrada.create({
          data: { ...base, usuarioId: (await criarUsuario()).id, avaliadaEm: new Date() },
        })
        await esperarViolacao(
          prismaTeste.solicitacaoEntrada.create({
            data: { ...base, usuarioId: (await criarUsuario()).id },
          }),
          'solicitacao_avaliacao_coerente',
        )
      },
    )
  })

  describe('Evento', () => {
    let cenario: Cenario
    beforeEach(async () => {
      cenario = await montarCenario()
    })

    it('JOGO com adversário e TREINO sem adversário nem placar são aceitos', async () => {
      await criarEvento(cenario)
      await criarEvento(cenario, { tipo: 'TREINO' })
      expect(await prismaTeste.evento.count()).toBe(2)
    })

    type DadosEvento = Partial<Prisma.EventoUncheckedCreateInput>
    it.each<[string, () => DadosEvento | Promise<DadosEvento>]>([
      [
        'TREINO com time adversário',
        () => ({ tipo: 'TREINO', timeAdversarioId: cenario.timeAdversario.id }),
      ],
      [
        'TREINO com placar',
        () => ({
          tipo: 'TREINO',
          status: 'FINALIZADO',
          placarTime: 1,
          placarAdversario: 0,
          resultado: 'VITORIA',
        }),
      ],
      ['JOGO sem time adversário', () => ({ tipo: 'JOGO', timeAdversarioId: null })],
      [
        'JOGO de uma série',
        async () => ({
          tipo: 'JOGO',
          serieId: (await prismaTeste.serieRecorrencia.create({ data: dadosSerie(cenario) })).id,
        }),
      ],
    ])('rejeita %s (evento_tipo_coerente, critério 11)', async (_caso, montar) => {
      await esperarViolacao(criarEvento(cenario, await montar()), 'evento_tipo_coerente')
    })

    it('times distintos (evento_times_distintos)', async () => {
      await expect(
        criarEvento(cenario, { timeAdversarioId: cenario.timeAdversario.id }),
      ).resolves.toBeDefined()
      await esperarViolacao(
        criarEvento(cenario, { timeAdversarioId: cenario.time.id }),
        'evento_times_distintos',
      )
    })

    it('placar das duas equipes e resultado juntos (evento_placar_completo, critério 12)', async () => {
      const finalizado = { status: 'FINALIZADO' } as const
      await criarEvento(cenario, {
        ...finalizado,
        placarTime: 2,
        placarAdversario: 1,
        resultado: 'VITORIA',
      })
      await esperarViolacao(
        criarEvento(cenario, { ...finalizado, placarTime: 2, resultado: 'VITORIA' }),
        'evento_placar_completo',
      )
      await esperarViolacao(
        criarEvento(cenario, { ...finalizado, placarTime: 2, placarAdversario: 1 }),
        'evento_placar_completo',
      )
    })

    it('placar não negativo (a faixa, checada antes por ordem alfabética, também o cobre)', async () => {
      await criarEvento(cenario, {
        status: 'FINALIZADO',
        placarTime: 0,
        placarAdversario: 0,
        resultado: 'EMPATE',
      })
      await esperarViolacao(
        criarEvento(cenario, {
          status: 'FINALIZADO',
          placarTime: -1,
          placarAdversario: 0,
          resultado: 'DERROTA',
        }),
        'evento_placar_faixa',
      )
    })

    it('placar até 999 em UPDATE direto (evento_placar_faixa, #73)', async () => {
      const evento = await criarEvento(cenario, {
        status: 'FINALIZADO',
        placarTime: 999,
        placarAdversario: 0,
        resultado: 'VITORIA',
      })
      await esperarViolacao(
        prismaTeste.evento.update({ where: { id: evento.id }, data: { placarTime: 1000 } }),
        'evento_placar_faixa',
      )
    })

    it('resultado coerente com o placar em UPDATE direto (evento_resultado_coerente, #73)', async () => {
      const evento = await criarEvento(cenario, {
        status: 'FINALIZADO',
        placarTime: 1,
        placarAdversario: 2,
        resultado: 'DERROTA',
      })
      for (const resultado of ['VITORIA', 'EMPATE'] as const) {
        await esperarViolacao(
          prismaTeste.evento.update({ where: { id: evento.id }, data: { resultado } }),
          'evento_resultado_coerente',
        )
      }
    })

    it('resultado só com status FINALIZADO (evento_resultado_finalizado)', async () => {
      await expect(
        criarEvento(cenario, {
          status: 'FINALIZADO',
          placarTime: 1,
          placarAdversario: 0,
          resultado: 'VITORIA',
        }),
      ).resolves.toBeDefined()
      await esperarViolacao(
        criarEvento(cenario, {
          status: 'EM_ANDAMENTO',
          placarTime: 1,
          placarAdversario: 0,
          resultado: 'VITORIA',
        }),
        'evento_resultado_finalizado',
      )
    })
  })

  describe('SerieRecorrencia', () => {
    let cenario: Cenario
    beforeEach(async () => {
      cenario = await montarCenario()
    })

    it('série válida de exatamente 6 meses é aceita', async () => {
      await prismaTeste.serieRecorrencia.create({
        data: dadosSerie(cenario, {
          diasSemana: [0, 1, 2, 3, 4, 5, 6],
          horario: '23:59',
          dataInicio: new Date('2026-11-01'),
          dataFim: new Date('2027-05-01'),
        }),
      })
      expect(await prismaTeste.serieRecorrencia.count()).toBe(1)
    })

    it.each<[string, Partial<Prisma.SerieRecorrenciaUncheckedCreateInput>, string]>([
      ['sem dias', { diasSemana: [] }, 'serie_dias_validos'],
      ['dia 7', { diasSemana: [1, 7] }, 'serie_dias_validos'],
      ['horário 24:00', { horario: '24:00' }, 'serie_horario_formato'],
      ['horário 7:30', { horario: '7:30' }, 'serie_horario_formato'],
      [
        'fim antes do início',
        { dataInicio: new Date('2026-11-10'), dataFim: new Date('2026-11-09') },
        'serie_periodo_valido',
      ],
      [
        'mais de 6 meses (RN13)',
        { dataInicio: new Date('2026-11-01'), dataFim: new Date('2027-05-02') },
        'serie_limite_6_meses',
      ],
    ])('rejeita %s (%s)', async (_caso, dados, constraint) => {
      await esperarViolacao(
        prismaTeste.serieRecorrencia.create({ data: dadosSerie(cenario, dados) }),
        constraint,
      )
    })
  })

  describe('Participacao', () => {
    it('resposta e presença acompanhadas da data (participacao_*_coerente)', async () => {
      const cenario = await montarCenario()
      const evento = await criarEvento(cenario)
      const base = { atleticaId: cenario.atletica.id, eventoId: evento.id }
      const agora = new Date()

      await prismaTeste.participacao.createMany({
        data: [
          { ...base, usuarioId: (await criarUsuario()).id },
          {
            ...base,
            usuarioId: (await criarUsuario()).id,
            confirmado: false,
            respondidoEm: agora,
            presente: true,
            presencaRegistradaEm: agora,
          },
        ],
      })
      await esperarViolacao(
        prismaTeste.participacao.create({
          data: { ...base, usuarioId: (await criarUsuario()).id, confirmado: true },
        }),
        'participacao_resposta_coerente',
      )
      await esperarViolacao(
        prismaTeste.participacao.create({
          data: { ...base, usuarioId: (await criarUsuario()).id, presencaRegistradaEm: agora },
        }),
        'participacao_presenca_coerente',
      )
    })
  })

  describe('Noticia', () => {
    it('PUBLICADA exige publicadaEm (noticia_publicada_com_data)', async () => {
      const autor = await criarUsuario({ papel: 'DIRETOR' })
      const base = { atleticaId: autor.atleticaId, autorId: autor.id, titulo: 'Título' }
      await prismaTeste.noticia.create({ data: base })
      await prismaTeste.noticia.create({
        data: { ...base, status: 'PUBLICADA', conteudo: 'Texto', publicadaEm: new Date() },
      })
      await esperarViolacao(
        prismaTeste.noticia.create({ data: { ...base, status: 'PUBLICADA', conteudo: 'Texto' } }),
        'noticia_publicada_com_data',
      )
    })
  })

  describe('Banner', () => {
    let atleticaId: string
    const criarBanner = (dados: { link?: string | null; ordem?: number } = {}) =>
      prismaTeste.banner.create({
        data: { atleticaId, titulo: 'Banner', imagemKey: 'atleticas/x/banners/y/z.webp', ...dados },
      })

    beforeEach(async () => {
      atleticaId = (await criarAtletica()).id
    })

    it('link só HTTPS (banner_link_https, critério 14)', async () => {
      await criarBanner({ link: null })
      await criarBanner({ link: 'https://x.com' })
      await esperarViolacao(criarBanner({ link: 'http://x.com' }), 'banner_link_https')
    })

    it('ordem não negativa (banner_ordem_nao_negativa)', async () => {
      await criarBanner({ ordem: 0 })
      await esperarViolacao(criarBanner({ ordem: -1 }), 'banner_ordem_nao_negativa')
    })
  })
})
