import { rotaNotificacao } from '@atletica/shared'
import { randomUUID } from 'node:crypto'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import type { FakeExpoPush } from '../../src/modules/notificacoes/envio/fake-expo-push'
import {
  NotificacoesService,
  type EntradaNotificacao,
} from '../../src/modules/notificacoes/notificacoes.service'
import { criarAtletica } from '../fabricas/atletica'
import { criarDispositivo, criarPreferencias, fakeExpo } from '../fabricas/notificacoes'
import { criarUsuario, type DadosUsuario } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { processarFilas } from '../setup/fila'
import { prismaTeste } from '../setup/prisma-teste'

describe('Envio push: notificar → fila → Expo (#87)', () => {
  let contexto: AppDeTeste
  let padraoId: string
  let expo: FakeExpoPush
  let notificacoes: NotificacoesService

  const entrada = (usuarioIds: string[], extra: Partial<EntradaNotificacao> = {}) => ({
    atleticaId: padraoId,
    categoria: 'NOTICIAS' as const,
    usuarioIds,
    titulo: 'LRD publicou uma notícia',
    corpo: 'Inscrições abertas para o Intercursos',
    url: rotaNotificacao({ tela: 'inicio' }),
    chave: `teste:${randomUUID()}`,
    ...extra,
  })

  /** Usuário da atlética padrão com um aparelho. */
  async function comAparelho(dados: DadosUsuario = {}) {
    const usuario = await criarUsuario({ atleticaId: padraoId, ...dados })
    const dispositivo = await criarDispositivo(usuario)
    return { ...usuario, dispositivo }
  }

  const tokensEnviados = () => expo.enviadas().map(({ to }) => to)
  const existe = async (id: string) =>
    (await prismaTeste.dispositivoPush.count({ where: { id } })) === 1

  beforeAll(async () => {
    contexto = await criarApp()
    padraoId = contexto.app.get(AtleticaPadraoService).id()
    expo = fakeExpo(contexto.app)
    notificacoes = contexto.app.get(NotificacoesService)
  })

  beforeEach(async () => {
    expo.limpar()
    await criarAtletica({ id: padraoId, nome: 'Atlética Lorde' })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  describe('elegibilidade', () => {
    it('5 usuários: notícias desligadas, sem aparelho e vínculo desativado ficam de fora', async () => {
      const a = await comAparelho()
      const b = await comAparelho()
      const semNoticias = await comAparelho()
      await criarPreferencias(semNoticias, { noticias: false })
      const semAparelho = await criarUsuario({ atleticaId: padraoId })
      const desativado = await comAparelho({ vinculoAtivo: false })
      const ids = [a, b, semNoticias, semAparelho, desativado].map(({ id }) => id)

      expect(await notificacoes.contarElegiveis(entrada(ids))).toBe(2)
      expect(await notificacoes.notificar(entrada(ids))).toEqual({ destinatarios: 2 })
      await processarFilas(contexto.app)

      expect(tokensEnviados().sort()).toEqual(
        [a.dispositivo.tokenPush, b.dispositivo.tokenPush].sort(),
      )
    })

    it('conta inativa, excluída, fora da atlética ou com pushAtivo = false não recebe', async () => {
      const ok = await comAparelho()
      const inativa = await comAparelho({ ativo: false })
      const excluida = await comAparelho()
      await prismaTeste.usuario.update({
        where: { id: excluida.id },
        data: { excluidoEm: new Date() },
      })
      const outraAtletica = await criarUsuario()
      await criarDispositivo(outraAtletica)
      const semPush = await comAparelho()
      await criarPreferencias(semPush, { pushAtivo: false })
      const ids = [ok, inativa, excluida, outraAtletica, semPush].map(({ id }) => id)

      expect(await notificacoes.contarElegiveis(entrada(ids))).toBe(1)
    })

    it('CARGO ignora pushAtivo; outras categorias não (critério 11 do épico)', async () => {
      const semPush = await comAparelho()
      await criarPreferencias(semPush, { pushAtivo: false, avisos: true })

      const cargo = await notificacoes.notificar(entrada([semPush.id], { categoria: 'CARGO' }))
      const aviso = await notificacoes.notificar(entrada([semPush.id], { categoria: 'AVISOS' }))
      await processarFilas(contexto.app)

      expect(cargo).toEqual({ destinatarios: 1 })
      expect(aviso).toEqual({ destinatarios: 0 })
      expect(tokensEnviados()).toEqual([semPush.dispositivo.tokenPush])
    })

    it('usuário com 2 aparelhos recebe 2 mensagens, uma por token, com o conteúdo', async () => {
      const atleta = await comAparelho()
      const tablet = await criarDispositivo(atleta)
      const dados = entrada([atleta.id, atleta.id])

      expect(await notificacoes.notificar(dados)).toEqual({ destinatarios: 1 })
      await processarFilas(contexto.app)

      expect(expo.requisicoes()).toHaveLength(1)
      expect(tokensEnviados().sort()).toEqual(
        [atleta.dispositivo.tokenPush, tablet.tokenPush].sort(),
      )
      expect(expo.enviadas()[0]).toEqual({
        to: expect.any(String) as string,
        title: dados.titulo,
        body: dados.corpo,
        data: { url: '/', tipo: 'NOTICIAS', id: dados.chave },
        channelId: 'padrao',
        sound: 'default',
        priority: 'high',
      })
    })
  })

  it('250 destinatários → 3 requisições ao Expo (100, 100, 50) (critério 15)', async () => {
    const usuarioIds = Array.from({ length: 250 }, () => randomUUID())
    await prismaTeste.usuario.createMany({
      data: usuarioIds.map((id) => ({
        id,
        nome: 'Atleta',
        email: `${id}@teste.local`,
        senhaHash: 'x',
      })),
    })
    await prismaTeste.vinculoAtletica.createMany({
      data: usuarioIds.map((usuarioId) => ({ usuarioId, atleticaId: padraoId })),
    })
    await prismaTeste.dispositivoPush.createMany({
      data: usuarioIds.map((usuarioId) => ({
        usuarioId,
        tokenPush: `ExponentPushToken[${usuarioId}]`,
        plataforma: 'android',
      })),
    })

    expect(await notificacoes.notificar(entrada(usuarioIds))).toEqual({ destinatarios: 250 })
    await processarFilas(contexto.app)

    expect(
      expo
        .requisicoes()
        .map((lote) => lote.length)
        .sort(),
    ).toEqual([100, 100, 50].sort())
    expect(new Set(tokensEnviados()).size).toBe(250)
  })

  it('503 no lote: o pg-boss repete e cada aparelho recebe uma vez (critério 16)', async () => {
    const a = await comAparelho()
    const b = await comAparelho()
    expo.simularIndisponibilidade(1)

    await notificacoes.notificar(entrada([a.id, b.id]))
    await processarFilas(contexto.app, { esperaMs: 30_000 })

    expect(expo.requisicoes()).toHaveLength(1)
    expect(tokensEnviados().sort()).toEqual(
      [a.dispositivo.tokenPush, b.dispositivo.tokenPush].sort(),
    )
  }, 40_000)

  describe('tokens inválidos (critério 14)', () => {
    it('DeviceNotRegistered no ticket apaga o dispositivo', async () => {
      const valido = await comAparelho()
      const invalido = await comAparelho()
      expo.simularErroTicket(invalido.dispositivo.tokenPush, 'DeviceNotRegistered')

      await notificacoes.notificar(entrada([valido.id, invalido.id]))
      await processarFilas(contexto.app)

      expect(await existe(invalido.dispositivo.id)).toBe(false)
      expect(await existe(valido.dispositivo.id)).toBe(true)
    })

    it('DeviceNotRegistered no recibo (15 min depois) apaga o dispositivo', async () => {
      const valido = await comAparelho()
      const invalido = await comAparelho()
      expo.simularErroRecibo(invalido.dispositivo.tokenPush, 'DeviceNotRegistered')

      await notificacoes.notificar(entrada([valido.id, invalido.id]))
      await processarFilas(contexto.app)

      const [recibos] = await prismaTeste.$queryRaw<{ total: number; minutos: number }[]>`
        SELECT count(*)::int AS total,
          min(extract(epoch FROM start_after - created_on) / 60)::float AS minutos
        FROM pgboss.job WHERE name = 'notificacao.recibos' AND state = 'created'`
      expect(recibos?.total).toBe(1)
      expect(recibos?.minutos).toBeGreaterThanOrEqual(14.9)
      expect(await existe(invalido.dispositivo.id)).toBe(true)

      await prismaTeste.$executeRaw`
        UPDATE pgboss.job SET start_after = now() WHERE name = 'notificacao.recibos'`
      await processarFilas(contexto.app)

      expect(await existe(invalido.dispositivo.id)).toBe(false)
      expect(await existe(valido.dispositivo.id)).toBe(true)
    })
  })
})
