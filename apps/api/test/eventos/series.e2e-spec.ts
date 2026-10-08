import {
  chaveDiaLocal,
  diaDaSemana,
  eventoCanceladoDtoSchema,
  gerarDatasSerie,
  hojeLocal,
  ocorrenciasAlteradasDtoSchema,
  serieCriadaDtoSchema,
  somarDias,
  somarMeses,
  type Papel,
  type Recorrencia,
} from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import type { Evento, Time } from '../../src/generated/prisma/client'
import { AuditoriaService } from '../../src/modules/auditoria/auditoria.service'
import { aguardarOuvintes, espiarEventos, type EspiaoEventos } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarEvento, criarParticipacoes, criarTreino } from '../fabricas/eventos'
import { criarTime } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { prismaTeste } from '../setup/prisma-teste'

const ROTA = '/api/v1/eventos'
const SEGUNDA = 1
const erro = (resposta: { body: unknown }) => resposta.body as RespostaErro

/** A primeira segunda-feira depois de hoje (local), para a série não depender do relógio. */
function proximaSegunda(): string {
  let dia = somarDias(hojeLocal(), 1)
  while (diaDaSemana(dia) !== SEGUNDA) dia = somarDias(dia, 1)
  return dia
}

describe('/eventos — treino recorrente (#20)', () => {
  let contexto: AppDeTeste
  let eventos: EspiaoEventos
  let atleticaId: string
  let time: Time
  let inicioSerie: string
  let auditoriaAnterior: string[]

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica()).id
    time = await criarTime({ atleticaId, nome: 'Vôlei Masculino' })
    eventos = espiarEventos(contexto.app)
    inicioSerie = proximaSegunda()
    auditoriaAnterior = []
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  const usuario = (papel: Papel = 'ATLETA') => criarUsuario({ papel, atleticaId })

  async function como(papel: Papel | UsuarioCriado) {
    const alvo = typeof papel === 'string' ? await usuario(papel) : papel
    const auth = `Bearer ${await tokenPara(alvo)}`
    const http = contexto.http
    return {
      post: (corpo: object) => request(http).post(ROTA).set('Authorization', auth).send(corpo),
      patch: (id: string, corpo: object) =>
        request(http).patch(`${ROTA}/${id}`).set('Authorization', auth).send(corpo),
      cancelar: (id: string, corpo?: object) =>
        request(http).post(`${ROTA}/${id}/cancelar`).set('Authorization', auth).send(corpo),
    }
  }

  const recorrencia = (dados: Partial<Recorrencia> = {}): Recorrencia => ({
    dataInicio: inicioSerie,
    horario: '18:30',
    diasSemana: [1, 3],
    dataFim: somarMeses(inicioSerie, 6),
    ...dados,
  })

  const corpo = (dados: Partial<Recorrencia> = {}, extra: object = {}) => ({
    tipo: 'TREINO',
    timeId: time.id,
    local: 'Quadra do CCET',
    observacoes: 'Trazer colete',
    recorrencia: recorrencia(dados),
    ...extra,
  })

  const ocorrencias = (serieId?: string) =>
    prismaTeste.evento.findMany({
      where: { atleticaId, ...(serieId && { serieId }) },
      orderBy: { inicio: 'asc' },
    })

  const registros = (entidade?: string) =>
    prismaTeste.registroAuditoria.findMany({
      where: { atleticaId, id: { notIn: auditoriaAnterior }, ...(entidade && { entidade }) },
      orderBy: { criadoEm: 'asc' },
    })

  async function emitidos() {
    await aguardarOuvintes()
    return eventos.emitidos().filter(({ nome }) => nome.startsWith('evento.'))
  }

  /** Dez segundas seguidas às 18:30; devolve as ocorrências em ordem. */
  async function serieDeDez(): Promise<Evento[]> {
    const dataFim = somarDias(inicioSerie, 63)
    const resposta = await (
      await como('DIRETOR')
    ).post(corpo({ diasSemana: [SEGUNDA], dataFim }, { observacoes: null }))
    expect(resposta.status).toBe(201)
    const lista = await ocorrencias()
    expect(lista).toHaveLength(10)
    eventos = espiarEventos(contexto.app)
    auditoriaAnterior = (await registros()).map(({ id }) => id)
    return lista
  }

  describe('POST /eventos com recorrencia', () => {
    it('cria a série e uma ocorrência por data, auditoria única e um evento.criado (critérios 1 e 2)', async () => {
      const diretor = await usuario('DIRETOR')
      const resposta = await (await como(diretor)).post(corpo())

      expect(resposta.status).toBe(201)
      const dto = serieCriadaDtoSchema.parse(resposta.body)
      const esperado = gerarDatasSerie(recorrencia())
      expect(dto.totalOcorrencias).toBe(esperado.length)
      expect(dto.serie).toEqual({
        id: expect.any(String) as string,
        timeId: time.id,
        diasSemana: [1, 3],
        horario: '18:30',
        dataInicio: inicioSerie,
        dataFim: somarMeses(inicioSerie, 6),
      })

      const lista = await ocorrencias(dto.serie.id)
      expect(lista.map(({ inicio }) => inicio)).toEqual(esperado)
      expect(lista.every(({ inicio }) => inicio.toISOString().endsWith('T21:30:00.000Z'))).toBe(
        true,
      )
      for (const evento of lista) {
        expect(evento).toMatchObject({
          tipo: 'TREINO',
          status: 'AGENDADO',
          timeId: time.id,
          local: 'Quadra do CCET',
          observacoes: 'Trazer colete',
          criadoPorId: diretor.id,
        })
      }
      expect(dto.primeiraOcorrencia).toEqual({
        id: lista[0]?.id,
        inicio: lista[0]?.inicio.toISOString(),
      })
      expect(dto.ultimaOcorrencia.id).toBe(lista.at(-1)?.id)

      await expect(
        prismaTeste.serieRecorrencia.findUniqueOrThrow({ where: { id: dto.serie.id } }),
      ).resolves.toMatchObject({
        atleticaId,
        local: 'Quadra do CCET',
        observacoes: 'Trazer colete',
        criadoPorId: diretor.id,
        canceladaEm: null,
      })

      const auditados = await registros()
      expect(auditados).toHaveLength(1)
      expect(auditados[0]).toMatchObject({
        acao: 'SERIE_CRIADA',
        entidade: 'SerieRecorrencia',
        entidadeId: dto.serie.id,
        usuarioId: diretor.id,
        dados: { antes: null, contexto: { totalOcorrencias: esperado.length } },
      })
      await expect(emitidos()).resolves.toEqual([
        {
          nome: 'evento.criado',
          payload: {
            atleticaId,
            eventoId: lista[0]?.id,
            timeId: time.id,
            serieId: dto.serie.id,
            autorId: diretor.id,
          },
        },
      ])
    })

    it('todos os dias por 6 meses fica dentro do teto de 185 ocorrências', async () => {
      const dados = { diasSemana: [0, 1, 2, 3, 4, 5, 6] }
      const resposta = await (await como('DIRETOR')).post(corpo(dados))

      expect(resposta.status).toBe(201)
      const { totalOcorrencias } = serieCriadaDtoSchema.parse(resposta.body)
      expect(totalOcorrencias).toBe(gerarDatasSerie(recorrencia(dados)).length)
      expect(totalOcorrencias).toBeLessThanOrEqual(185)
    })

    it('6 meses é aceito; 6 meses + 1 dia → 400 em recorrencia.dataFim (critério 3)', async () => {
      const api = await como('DIRETOR')
      const dataFim = somarDias(somarMeses(inicioSerie, 6), 1)
      const resposta = await api.post(corpo({ dataFim }))

      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      expect(erro(resposta).details.map(({ field }) => field)).toEqual(['recorrencia.dataFim'])
      await expect(prismaTeste.serieRecorrencia.count({ where: { atleticaId } })).resolves.toBe(0)
    })

    it('nenhuma data gerada → 422 SERIE_SEM_OCORRENCIAS e nada gravado (critério 4)', async () => {
      const resposta = await (
        await como('DIRETOR')
      ).post(corpo({ dataFim: inicioSerie, diasSemana: [2] }))

      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('SERIE_SEM_OCORRENCIAS')
      await expect(prismaTeste.serieRecorrencia.count({ where: { atleticaId } })).resolves.toBe(0)
      await expect(ocorrencias()).resolves.toHaveLength(0)
      await expect(registros()).resolves.toHaveLength(0)
      await expect(emitidos()).resolves.toEqual([])
    })

    it.each<[string, () => object]>([
      ['JOGO com recorrência (critério 5)', () => corpo({}, { tipo: 'JOGO' })],
      ['inicio junto da recorrência', () => corpo({}, { inicio: new Date().toISOString() })],
      ['diasSemana vazio (critério 6)', () => corpo({ diasSemana: [] })],
      ['diasSemana com 7 (critério 6)', () => corpo({ diasSemana: [7] })],
      ['diasSemana repetido (critério 6)', () => corpo({ diasSemana: [1, 1] })],
      ['horário inválido', () => corpo({ horario: '25:00' })],
      [
        'dataInicio no passado (critério 7)',
        () => corpo({ dataInicio: somarDias(hojeLocal(), -1) }),
      ],
    ])('%s → 400 VALIDATION_ERROR', async (_caso, montar) => {
      const resposta = await (await como('DIRETOR')).post(montar())
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
      await expect(prismaTeste.serieRecorrencia.count({ where: { atleticaId } })).resolves.toBe(0)
    })

    it('time inativo → 422 TIME_INATIVO sem gravar', async () => {
      const inativo = await criarTime({ atleticaId, ativo: false })
      const resposta = await (await como('DIRETOR')).post(corpo({}, { timeId: inativo.id }))
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('TIME_INATIVO')
      await expect(ocorrencias()).resolves.toHaveLength(0)
    })

    it('falha depois da auditoria desfaz a série inteira e não emite eventos', async () => {
      const auditoria = contexto.app.get(AuditoriaService)
      const original = auditoria.registrar.bind(auditoria)
      const espiao = jest.spyOn(auditoria, 'registrar').mockImplementationOnce(async (...args) => {
        await original(...args)
        throw new Error('falha depois da auditoria')
      })

      const resposta = await (await como('DIRETOR')).post(corpo())
      espiao.mockRestore()

      expect(resposta.status).toBe(500)
      await expect(ocorrencias()).resolves.toHaveLength(0)
      await expect(prismaTeste.serieRecorrencia.count({ where: { atleticaId } })).resolves.toBe(0)
      await expect(registros()).resolves.toHaveLength(0)
      await expect(emitidos()).resolves.toEqual([])
    })
  })

  describe('PATCH /eventos/:id com escopo ESTA_E_SEGUINTES', () => {
    it('da 4ª em diante: divide a série, mantém as anteriores e pula as canceladas (critérios 8, 11, 12, 16)', async () => {
      const lista = await serieDeDez()
      const [quarta, sexta] = [lista[3], lista[5]]
      if (!quarta || !sexta) throw new Error('série incompleta')
      const serieOriginal = quarta.serieId
      await prismaTeste.evento.update({ where: { id: sexta.id }, data: { status: 'CANCELADO' } })
      const atleta = await usuario('ATLETA')
      await criarParticipacoes(quarta, [{ usuarioId: atleta.id, confirmado: true }])
      const diretor = await usuario('DIRETOR')

      const resposta = await (
        await como(diretor)
      ).patch(quarta.id, { escopo: 'ESTA_E_SEGUINTES', horario: '19:00', local: 'Quadra 2' })

      expect(resposta.status).toBe(200)
      const dto = ocorrenciasAlteradasDtoSchema.parse(resposta.body)
      const alteradas = lista.slice(3).filter(({ id }) => id !== sexta.id)
      expect(dto.serieDividida).toBe(true)
      expect(dto.eventoIds).toEqual(alteradas.map(({ id }) => id))
      expect(dto.serieId).not.toBe(serieOriginal)

      const depois = await ocorrencias()
      depois.forEach((evento, i) => {
        const antes = lista[i]
        if (!antes) throw new Error('ocorrência ausente')
        expect(chaveDiaLocal(evento.inicio)).toBe(chaveDiaLocal(antes.inicio))
        if (i < 3) {
          expect(evento).toEqual(antes)
        } else if (evento.id === sexta.id) {
          expect(evento).toMatchObject({
            status: 'CANCELADO',
            inicio: antes.inicio,
            local: antes.local,
          })
          expect(evento.serieId).toBe(dto.serieId)
        } else {
          expect(evento.inicio.toISOString()).toMatch(/T22:00:00\.000Z$/)
          expect(evento).toMatchObject({ local: 'Quadra 2', serieId: dto.serieId })
        }
      })

      const diaQuarta = chaveDiaLocal(quarta.inicio)
      await expect(
        prismaTeste.serieRecorrencia.findUniqueOrThrow({ where: { id: dto.serieId } }),
      ).resolves.toMatchObject({
        horario: '19:00',
        local: 'Quadra 2',
        diasSemana: [SEGUNDA],
        dataInicio: new Date(diaQuarta),
        dataFim: new Date(somarDias(inicioSerie, 63)),
        criadoPorId: diretor.id,
      })
      await expect(
        prismaTeste.serieRecorrencia.findUniqueOrThrow({ where: { id: serieOriginal ?? '' } }),
      ).resolves.toMatchObject({ horario: '18:30', dataFim: new Date(somarDias(diaQuarta, -1)) })
      await expect(
        prismaTeste.participacao.count({ where: { eventoId: quarta.id, confirmado: true } }),
      ).resolves.toBe(1)

      const auditados = await registros()
      expect(auditados.filter(({ acao }) => acao === 'EVENTO_ALTERADO')).toHaveLength(
        alteradas.length,
      )
      expect(auditados.find(({ acao }) => acao === 'EVENTO_ALTERADO')?.dados).toMatchObject({
        contexto: { serieId: dto.serieId, escopo: 'ESTA_E_SEGUINTES' },
      })
      expect(auditados.find(({ acao }) => acao === 'SERIE_DIVIDIDA')).toMatchObject({
        entidadeId: serieOriginal,
        dados: { contexto: { novaSerieId: dto.serieId } },
      })
      await expect(emitidos()).resolves.toEqual([
        {
          nome: 'evento.alterado',
          payload: {
            atleticaId,
            eventoIds: dto.eventoIds,
            timeId: time.id,
            campos: ['inicio', 'local'],
            autorId: diretor.id,
          },
        },
      ])
    })

    it('da 1ª: não divide e atualiza a série em vigor (critério 9)', async () => {
      const [primeira] = await serieDeDez()
      if (!primeira) throw new Error('série vazia')
      const resposta = await (
        await como('DIRETOR')
      ).patch(primeira.id, { escopo: 'ESTA_E_SEGUINTES', horario: '19:00', local: 'Quadra 2' })

      expect(resposta.status).toBe(200)
      expect(resposta.body).toMatchObject({ serieId: primeira.serieId, serieDividida: false })
      expect(ocorrenciasAlteradasDtoSchema.parse(resposta.body).eventoIds).toHaveLength(10)
      await expect(prismaTeste.serieRecorrencia.count({ where: { atleticaId } })).resolves.toBe(1)
      await expect(
        prismaTeste.serieRecorrencia.findUniqueOrThrow({ where: { id: primeira.serieId ?? '' } }),
      ).resolves.toMatchObject({ horario: '19:00', local: 'Quadra 2' })
      const serieAlterada = await registros('SerieRecorrencia')
      expect(serieAlterada.map(({ acao }) => acao)).toEqual(['SERIE_ALTERADA'])
    })

    it('só local a partir do meio: nenhuma série criada ou alterada (critério 10)', async () => {
      const lista = await serieDeDez()
      const quarta = lista[3]
      if (!quarta) throw new Error('série incompleta')
      const serieAntes = await prismaTeste.serieRecorrencia.findUniqueOrThrow({
        where: { id: quarta.serieId ?? '' },
      })

      const resposta = await (
        await como('DIRETOR')
      ).patch(quarta.id, { escopo: 'ESTA_E_SEGUINTES', local: 'Quadra 2' })

      expect(resposta.status).toBe(200)
      expect(ocorrenciasAlteradasDtoSchema.parse(resposta.body).eventoIds).toHaveLength(7)
      await expect(prismaTeste.serieRecorrencia.count({ where: { atleticaId } })).resolves.toBe(1)
      await expect(
        prismaTeste.serieRecorrencia.findUniqueOrThrow({ where: { id: serieAntes.id } }),
      ).resolves.toEqual(serieAntes)
      await expect(registros('SerieRecorrencia')).resolves.toHaveLength(0)
    })

    it.each([
      ['inicio', () => ({ inicio: new Date().toISOString() })],
      ['timeId', () => ({ timeId: time.id })],
    ])('com %s → 400 VALIDATION_ERROR (critério 13)', async (_campo, extra) => {
      const [primeira] = await serieDeDez()
      const resposta = await (
        await como('DIRETOR')
      ).patch(primeira?.id ?? '', { escopo: 'ESTA_E_SEGUINTES', local: 'Quadra 2', ...extra() })
      expect(resposta.status).toBe(400)
      expect(erro(resposta).code).toBe('VALIDATION_ERROR')
    })

    it('escopo ESTA continua editando só a ocorrência', async () => {
      const lista = await serieDeDez()
      const quarta = lista[3]
      const resposta = await (
        await como('DIRETOR')
      ).patch(quarta?.id ?? '', { escopo: 'ESTA', local: 'Quadra 3' })

      expect(resposta.status).toBe(200)
      expect(resposta.body).toMatchObject({
        id: quarta?.id,
        local: 'Quadra 3',
        serieId: quarta?.serieId,
      })
      const locais = (await ocorrencias()).map(({ local }) => local)
      expect(locais.filter((local) => local === 'Quadra 3')).toHaveLength(1)
    })
  })

  describe('POST /eventos/:id/cancelar com escopo ESTA_E_SEGUINTES', () => {
    it('da 4ª: cancela 4 a 10, um evento.cancelado e a série segue ativa (critério 15)', async () => {
      const lista = await serieDeDez()
      const quarta = lista[3]
      if (!quarta) throw new Error('série incompleta')
      const diretor = await usuario('DIRETOR')
      const resposta = await (
        await como(diretor)
      ).cancelar(quarta.id, { escopo: 'ESTA_E_SEGUINTES' })

      expect(resposta.status).toBe(200)
      const ids = lista.slice(3).map(({ id }) => id)
      expect(resposta.body).toEqual({ eventoIds: ids, status: 'CANCELADO' })
      expect((await ocorrencias()).map(({ status }) => status)).toEqual([
        ...Array<string>(3).fill('AGENDADO'),
        ...Array<string>(7).fill('CANCELADO'),
      ])
      await expect(
        prismaTeste.serieRecorrencia.findUniqueOrThrow({ where: { id: quarta.serieId ?? '' } }),
      ).resolves.toMatchObject({ canceladaEm: null })

      const auditados = await registros()
      expect(auditados).toHaveLength(7)
      expect(auditados[0]).toMatchObject({
        acao: 'EVENTO_CANCELADO',
        dados: { contexto: { serieId: quarta.serieId, escopo: 'ESTA_E_SEGUINTES' } },
      })
      await expect(emitidos()).resolves.toEqual([
        {
          nome: 'evento.cancelado',
          payload: { atleticaId, eventoIds: ids, timeId: time.id, autorId: diretor.id },
        },
      ])
    })

    it('da 1ª: a série fica sem agendados e recebe canceladaEm (SERIE_ALTERADA)', async () => {
      const [primeira] = await serieDeDez()
      const resposta = await (
        await como('DIRETOR')
      ).cancelar(primeira?.id ?? '', { escopo: 'ESTA_E_SEGUINTES' })

      expect(resposta.status).toBe(200)
      expect(eventoCanceladoDtoSchema.parse(resposta.body).eventoIds).toHaveLength(10)
      const serie = await prismaTeste.serieRecorrencia.findUniqueOrThrow({
        where: { id: primeira?.serieId ?? '' },
      })
      expect(serie.canceladaEm).toBeInstanceOf(Date)
      const auditados = await registros('SerieRecorrencia')
      expect(auditados).toHaveLength(1)
      expect(auditados[0]).toMatchObject({
        acao: 'SERIE_ALTERADA',
        dados: { antes: { canceladaEm: null } },
      })
    })

    it('alvo já cancelada → 422 EVENTO_JA_CANCELADO e as seguintes seguem agendadas', async () => {
      const lista = await serieDeDez()
      const quarta = lista[3]
      if (!quarta) throw new Error('série incompleta')
      const diretor = await como('DIRETOR')
      await diretor.cancelar(quarta.id)

      const resposta = await diretor.cancelar(quarta.id, { escopo: 'ESTA_E_SEGUINTES' })

      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('EVENTO_JA_CANCELADO')
      expect((await ocorrencias()).filter(({ status }) => status === 'CANCELADO')).toHaveLength(1)
    })

    it('respostas "Vou" são mantidas no cancelamento em lote (critério 16)', async () => {
      const lista = await serieDeDez()
      const quinta = lista[4]
      if (!quinta) throw new Error('série incompleta')
      const atleta = await usuario('ATLETA')
      await criarParticipacoes(quinta, [{ usuarioId: atleta.id, confirmado: true }])

      await (await como('DIRETOR')).cancelar(lista[3]?.id ?? '', { escopo: 'ESTA_E_SEGUINTES' })

      await expect(
        prismaTeste.participacao.count({ where: { eventoId: quinta.id } }),
      ).resolves.toBe(1)
    })
  })

  describe('concorrência na mesma série', () => {
    it('dois cancelamentos em lote simultâneos da mesma alvo: um cancela, o outro recebe 422', async () => {
      const quarta = (await serieDeDez())[3]
      if (!quarta) throw new Error('série incompleta')
      const diretor = await como('DIRETOR')
      const respostas = await Promise.all(
        [1, 2].map(() => diretor.cancelar(quarta.id, { escopo: 'ESTA_E_SEGUINTES' })),
      )

      expect(respostas.map(({ status }) => status).sort()).toEqual([200, 422])
      const canceladas = (await ocorrencias()).filter(({ status }) => status === 'CANCELADO')
      expect(canceladas).toHaveLength(7)
      await expect(registros('Evento')).resolves.toHaveLength(7)
      await expect(emitidos()).resolves.toHaveLength(1)
    })

    it('duas edições de horário simultâneas não deixam série vazia', async () => {
      const lista = await serieDeDez()
      const diretor = await como('DIRETOR')
      const respostas = await Promise.all([
        diretor.patch(lista[3]?.id ?? '', { escopo: 'ESTA_E_SEGUINTES', horario: '19:00' }),
        diretor.patch(lista[5]?.id ?? '', { escopo: 'ESTA_E_SEGUINTES', horario: '20:00' }),
      ])

      for (const { status } of respostas) expect([200, 409]).toContain(status)
      const series = await prismaTeste.serieRecorrencia.findMany({
        where: { atleticaId },
        include: { _count: { select: { eventos: true } } },
      })
      for (const serie of series) expect(serie._count.eventos).toBeGreaterThan(0)
    })
  })

  describe('evento avulso, autorização e escopo', () => {
    it('ESTA_E_SEGUINTES em evento avulso → 422 EVENTO_SEM_SERIE (critério 14)', async () => {
      const avulso = await criarTreino({ atleticaId, timeId: time.id })
      const api = await como('DIRETOR')
      const respostas = [
        await api.patch(avulso.id, { escopo: 'ESTA_E_SEGUINTES', local: 'Quadra 2' }),
        await api.cancelar(avulso.id, { escopo: 'ESTA_E_SEGUINTES' }),
      ]
      expect(respostas.map(({ status }) => status)).toEqual([422, 422])
      expect(respostas.every((resposta) => erro(resposta).code === 'EVENTO_SEM_SERIE')).toBe(true)
      await expect(
        prismaTeste.evento.findUniqueOrThrow({ where: { id: avulso.id } }),
      ).resolves.toEqual(avulso)
    })

    it('ATLETA → 403 ao criar série, editar e cancelar com escopo (critério 17)', async () => {
      const [primeira] = await serieDeDez()
      const api = await como('ATLETA')
      const respostas = [
        await api.post(corpo()),
        await api.patch(primeira?.id ?? '', { escopo: 'ESTA_E_SEGUINTES', local: 'Quadra 2' }),
        await api.cancelar(primeira?.id ?? '', { escopo: 'ESTA_E_SEGUINTES' }),
      ]
      expect(respostas.map(({ status }) => status)).toEqual([403, 403, 403])
    })

    it('sem token → 401 nas três operações', async () => {
      const [primeira] = await serieDeDez()
      const http = contexto.http
      const respostas = [
        await request(http).post(ROTA).send(corpo()),
        await request(http)
          .patch(`${ROTA}/${primeira?.id}`)
          .send({ escopo: 'ESTA_E_SEGUINTES', local: 'Quadra 2' }),
        await request(http)
          .post(`${ROTA}/${primeira?.id}/cancelar`)
          .send({ escopo: 'ESTA_E_SEGUINTES' }),
      ]
      expect(respostas.map(({ status }) => status)).toEqual([401, 401, 401])
    })

    it('ocorrência de outra atlética → 404 (critério 17)', async () => {
      const outra = await criarAtletica()
      const alheia = await criarEvento({ atleticaId: outra.id })
      const api = await como('DIRETOR')
      const respostas = [
        await api.patch(alheia.id, { escopo: 'ESTA_E_SEGUINTES', local: 'Quadra 2' }),
        await api.cancelar(alheia.id, { escopo: 'ESTA_E_SEGUINTES' }),
      ]
      expect(respostas.map(({ status }) => status)).toEqual([404, 404])
    })

    it('time de outra atlética → 422 TIME_INVALIDO', async () => {
      const alheio = await criarTime({ atleticaId: (await criarAtletica()).id })
      const resposta = await (await como('DIRETOR')).post(corpo({}, { timeId: alheio.id }))
      expect(resposta.status).toBe(422)
      expect(erro(resposta).code).toBe('TIME_INVALIDO')
    })
  })

  describe('banco (#43)', () => {
    it('CHECKs da série existem', async () => {
      const checks = await prismaTeste.$queryRaw<{ conname: string }[]>`
        SELECT conname FROM pg_constraint
        WHERE conrelid = '"SerieRecorrencia"'::regclass AND contype = 'c'`
      expect(checks.map(({ conname }) => conname).sort()).toEqual(
        expect.arrayContaining([
          'serie_dias_validos',
          'serie_horario_formato',
          'serie_limite_6_meses',
          'serie_periodo_valido',
        ]),
      )
    })
  })
})
