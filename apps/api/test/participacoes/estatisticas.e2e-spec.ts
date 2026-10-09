import { estatisticasAtletaSchema, usuarioDetalheSchema } from '@atletica/shared'
import request from 'supertest'
import type { RespostaErro } from '../../src/common/erros/erro-negocio'
import type { Time } from '../../src/generated/prisma/client'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { ESTATISTICAS_SEM_CHAMADA } from '../fabricas/estatisticas'
import { criarJogo, criarTreino, type DadosEvento } from '../fabricas/eventos'
import { adicionarMembro, criarTime } from '../fabricas/times'
import { criarUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'

const HORA_MS = 60 * 60 * 1000
const INICIO = new Date(Date.now() - 2 * HORA_MS)

describe('Estatísticas do atleta (#85)', () => {
  let contexto: AppDeTeste
  let atleticaId: string
  let time: Time
  let ana: UsuarioCriado

  beforeAll(async () => {
    contexto = await criarApp()
  })

  beforeEach(async () => {
    atleticaId = (await criarAtletica()).id
    time = await criarTime({ atleticaId })
    ana = await criarUsuario({ atleticaId, nome: 'Ana' })
    await adicionarMembro(time, ana, { entradaEm: new Date(INICIO.getTime() - HORA_MS) })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  async function autenticado(usuario: UsuarioCriado) {
    const auth = `Bearer ${await tokenPara(usuario)}`
    return {
      estatisticas: () =>
        request(contexto.http).get('/api/v1/me/estatisticas').set('Authorization', auth),
      registrarPresencas: (eventoId: string, presentes: string[]) =>
        request(contexto.http)
          .put(`/api/v1/eventos/${eventoId}/presencas`)
          .set('Authorization', auth)
          .send({ presentes }),
      detalharUsuario: (id: string) =>
        request(contexto.http).get(`/api/v1/usuarios/${id}`).set('Authorization', auth),
    }
  }

  const evento = (presente: boolean | null, dados: Partial<DadosEvento> = {}) => ({
    atleticaId,
    timeId: time.id,
    inicio: INICIO,
    status: 'EM_ANDAMENTO' as const,
    participantes: [{ usuarioId: ana.id, confirmado: true, presente }],
    ...dados,
  })

  async function estatisticasDaAna() {
    const resposta = await (await autenticado(ana)).estatisticas()
    expect(resposta.status).toBe(200)
    expect(resposta.headers['cache-control']).toBe('no-store')
    return estatisticasAtletaSchema.parse(resposta.body)
  }

  describe('GET /me/estatisticas', () => {
    it('sem token → 401 UNAUTHENTICATED (critério 15)', async () => {
      const resposta = await request(contexto.http).get('/api/v1/me/estatisticas')

      expect(resposta.status).toBe(401)
      expect((resposta.body as RespostaErro).code).toBe('UNAUTHENTICATED')
    })

    it('só confirmou, sem chamada: não conta e taxa null (RN32, critério 12)', async () => {
      await criarTreino(evento(null))

      await expect(estatisticasDaAna()).resolves.toEqual(ESTATISTICAS_SEM_CHAMADA)
    })

    it('2 presenças em 3 chamadas → jogo e treino separados, taxa 67', async () => {
      await criarJogo(evento(true))
      await criarTreino(evento(true))
      await criarTreino(evento(false))

      await expect(estatisticasDaAna()).resolves.toEqual({
        jogosParticipados: 1,
        treinosPresentes: 1,
        eventosComChamada: 3,
        taxaPresenca: 67,
      })
    })

    it('cancelados, excluídos e outra atlética não contam (critério 13)', async () => {
      const outra = await criarAtletica()
      await criarTreino(evento(true))
      await criarTreino(evento(true, { status: 'CANCELADO' }))
      await criarJogo(evento(true, { excluidoEm: new Date() }))
      await criarTreino(evento(true, { atleticaId: outra.id, timeId: undefined }))

      await expect(estatisticasDaAna()).resolves.toEqual({
        jogosParticipados: 0,
        treinosPresentes: 1,
        eventosComChamada: 1,
        taxaPresenca: 100,
      })
    })

    it('reflete as chamadas feitas pela diretoria', async () => {
      const diretor = await criarUsuario({ papel: 'DIRETOR', atleticaId })
      const primeiro = await criarTreino(evento(null))
      const segundo = await criarTreino(evento(null))
      const comoDiretor = await autenticado(diretor)

      expect((await comoDiretor.registrarPresencas(primeiro.id, [ana.id])).status).toBe(200)
      expect((await comoDiretor.registrarPresencas(segundo.id, [])).status).toBe(200)

      await expect(estatisticasDaAna()).resolves.toEqual({
        jogosParticipados: 0,
        treinosPresentes: 1,
        eventosComChamada: 2,
        taxaPresenca: 50,
      })
    })
  })

  describe('GET /usuarios/:id', () => {
    it('preenche as estatísticas do usuário consultado (critério 14)', async () => {
      const presidente = await criarUsuario({ papel: 'PRESIDENTE', atleticaId })
      await criarJogo(evento(true))
      await criarTreino(evento(false))

      const resposta = await (await autenticado(presidente)).detalharUsuario(ana.id)

      expect(resposta.status).toBe(200)
      expect(usuarioDetalheSchema.parse(resposta.body).estatisticas).toEqual({
        jogosParticipados: 1,
        treinosPresentes: 0,
        eventosComChamada: 2,
        taxaPresenca: 50,
      })
    })

    it('sem nenhuma chamada: zeros e taxa null', async () => {
      const presidente = await criarUsuario({ papel: 'PRESIDENTE', atleticaId })

      const resposta = await (await autenticado(presidente)).detalharUsuario(ana.id)

      expect(usuarioDetalheSchema.parse(resposta.body).estatisticas).toEqual(
        ESTATISTICAS_SEM_CHAMADA,
      )
    })
  })
})
