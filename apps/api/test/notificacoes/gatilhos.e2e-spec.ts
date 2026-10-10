import { EventEmitter2 } from '@nestjs/event-emitter'
import request from 'supertest'
import type { Time } from '../../src/generated/prisma/client'
import type { EventosDominio, NomeEventoDominio } from '../../src/infra/eventos/eventos-dominio'
import type { MensagemPush } from '../../src/infra/fila/filas-dominio'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import type { FakeExpoPush } from '../../src/modules/notificacoes/envio/fake-expo-push'
import { GatilhosService } from '../../src/modules/notificacoes/gatilhos/gatilhos.service'
import { aguardarOuvintes } from '../eventos'
import { criarAtletica } from '../fabricas/atletica'
import { tokenPara } from '../fabricas/auth'
import { criarEvento, criarJogo, criarSerie, criarTreino } from '../fabricas/eventos'
import { chaveDeCapa, criarNoticia } from '../fabricas/noticias'
import { criarDispositivo, criarPreferencias, fakeExpo } from '../fabricas/notificacoes'
import { criarSolicitacao } from '../fabricas/solicitacoes'
import {
  adicionarMembro,
  criarAtleticaAdversaria,
  criarTime,
  criarTimeAdversario,
} from '../fabricas/times'
import { simularArmazenamento } from '../fabricas/uploads'
import { criarUsuario, type DadosUsuario, type UsuarioCriado } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { processarFilas } from '../setup/fila'
import { prismaTeste } from '../setup/prisma-teste'

type ComAparelho = UsuarioCriado & { tokenPush: string }

const INICIO = new Date('2026-12-12T22:00:00.000Z')
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000

describe('Gatilhos imediatos de notificação (#89)', () => {
  let contexto: AppDeTeste
  let atleticaId: string
  let expo: FakeExpoPush
  let gatilhos: GatilhosService
  let emissor: EventEmitter2
  let time: Time

  /** Roda a ação, espera os gatilhos que ela disparou e esvazia as filas. */
  async function aguardarGatilhos(acao: () => Promise<unknown>) {
    const disparos = jest.spyOn(gatilhos, 'disparar')
    try {
      await acao()
      await aguardarOuvintes()
      await Promise.all(disparos.mock.results.map(({ value }) => value as Promise<void>))
    } finally {
      disparos.mockRestore()
    }
    await processarFilas(contexto.app)
  }

  /** Emite como o `EventosDominioService`. */
  const emitir = <K extends NomeEventoDominio>(nome: K, payload: EventosDominio[K]) =>
    aguardarGatilhos(() => Promise.resolve(emissor.emit(nome, payload)))

  async function comAparelho(dados: DadosUsuario = {}): Promise<ComAparelho> {
    const usuario = await criarUsuario({ atleticaId, ...dados })
    const { tokenPush } = await criarDispositivo(usuario)
    return { ...usuario, tokenPush }
  }

  async function membroComAparelho(dados: DadosUsuario = {}): Promise<ComAparelho> {
    const usuario = await comAparelho(dados)
    await adicionarMembro(time, usuario)
    return usuario
  }

  const recebidas = (usuario: ComAparelho): MensagemPush[] =>
    expo.enviadas().filter(({ to }) => to === usuario.tokenPush)

  const tokens = () =>
    expo
      .enviadas()
      .map(({ to }) => to)
      .sort()

  const tokensDe = (...usuarios: ComAparelho[]) => usuarios.map(({ tokenPush }) => tokenPush).sort()

  beforeAll(async () => {
    contexto = await criarApp({ ajustar: simularArmazenamento().ajustar })
    atleticaId = contexto.app.get(AtleticaPadraoService).id()
    expo = fakeExpo(contexto.app)
    gatilhos = contexto.app.get(GatilhosService)
    emissor = contexto.app.get(EventEmitter2)
  })

  beforeEach(async () => {
    expo.limpar()
    await criarAtletica({ id: atleticaId, nome: 'Atlética Lorde', sigla: 'LRD' })
    time = await criarTime({ atleticaId, nome: 'Futsal' })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  describe('evento.criado', () => {
    it('jogo: elenco elegível recebe "Novo jogo", o autor não (critérios 3 e 20)', async () => {
      const autor = await membroComAparelho({ papel: 'DIRETOR' })
      const a = await membroComAparelho()
      const b = await membroComAparelho()
      const c = await membroComAparelho()
      const semNovosEventos = await membroComAparelho()
      await criarPreferencias(semNovosEventos, { novosEventos: false })
      await adicionarMembro(time, await criarUsuario({ atleticaId }))
      await comAparelho()
      const adversaria = await criarAtleticaAdversaria({ nome: 'Medicina' })
      const adversario = await criarTimeAdversario({
        atleticaId: adversaria.id,
        modalidadeId: time.modalidadeId,
      })
      const jogo = await criarJogo({
        atleticaId,
        timeId: time.id,
        timeAdversarioId: adversario.id,
        inicio: INICIO,
        local: 'Ginásio Central',
        criadoPorId: autor.id,
      })

      await emitir('evento.criado', {
        atleticaId,
        eventoId: jogo.id,
        timeId: time.id,
        autorId: autor.id,
      })

      expect(tokens()).toEqual(tokensDe(a, b, c))
      expect(recebidas(a)[0]).toMatchObject({
        title: 'Novo jogo: Futsal',
        body: 'vs Medicina · 12/12 19:00 · Ginásio Central',
        data: { url: `/eventos/${jogo.id}`, tipo: 'NOVOS_EVENTOS' },
      })
    })

    it('série com 40 ocorrências: 1 mensagem por membro (critério 4)', async () => {
      const a = await membroComAparelho()
      const b = await membroComAparelho()
      const serie = await criarSerie({
        atleticaId,
        timeId: time.id,
        diasSemana: [1, 3],
        horario: '19:00',
        dataFim: new Date('2027-03-31'),
        local: 'Quadra 2',
      })
      const ocorrencias = await prismaTeste.evento.createManyAndReturn({
        data: Array.from({ length: 40 }, (_, i) => ({
          atleticaId,
          tipo: 'TREINO' as const,
          timeId: time.id,
          serieId: serie.id,
          inicio: new Date(INICIO.getTime() + i * SEMANA_MS),
          local: 'Quadra 2',
          criadoPorId: serie.criadoPorId,
        })),
      })
      const primeira = ocorrencias[0]!

      await emitir('evento.criado', {
        atleticaId,
        eventoId: primeira.id,
        timeId: time.id,
        serieId: serie.id,
        autorId: serie.criadoPorId,
      })

      expect(tokens()).toEqual(tokensDe(a, b))
      expect(recebidas(a)[0]).toMatchObject({
        title: 'Novo treino recorrente: Futsal',
        body: 'Seg e qua às 19:00, até 31/03/2027 · Quadra 2',
        data: { url: `/eventos/${primeira.id}` },
      })
    })
  })

  describe('evento.alterado', () => {
    it('local alterado: "Evento alterado" ao elenco com alteracoesEventos (critério 5)', async () => {
      const autor = await membroComAparelho({ papel: 'DIRETOR' })
      const a = await membroComAparelho()
      const semAlteracoes = await membroComAparelho()
      await criarPreferencias(semAlteracoes, { alteracoesEventos: false })
      const treino = await criarTreino({
        atleticaId,
        timeId: time.id,
        inicio: INICIO,
        local: 'Quadra Nova',
      })

      await emitir('evento.alterado', {
        atleticaId,
        eventoIds: [treino.id],
        timeId: time.id,
        campos: ['local'],
        autorId: autor.id,
      })

      expect(tokens()).toEqual(tokensDe(a))
      expect(recebidas(a)[0]).toMatchObject({
        title: 'Evento alterado: Treino de Futsal',
        body: 'Agora em 12/12 19:00 · Quadra Nova',
        data: { url: `/eventos/${treino.id}`, tipo: 'ALTERACOES_EVENTOS' },
      })
    })

    it('só status: nada é enviado (critério 21)', async () => {
      await membroComAparelho()
      const treino = await criarTreino({ atleticaId, timeId: time.id, status: 'EM_ANDAMENTO' })

      await emitir('evento.alterado', {
        atleticaId,
        eventoIds: [treino.id],
        timeId: time.id,
        campos: ['status'],
        autorId: treino.criadoPorId,
      })

      expect(expo.enviadas()).toEqual([])
    })

    it('"esta e seguintes" em 12 ocorrências: 1 mensagem por membro, link do time', async () => {
      const a = await membroComAparelho()
      const b = await membroComAparelho()
      const serie = await criarSerie({ atleticaId, timeId: time.id })
      const ocorrencias = await prismaTeste.evento.createManyAndReturn({
        data: Array.from({ length: 12 }, (_, i) => ({
          atleticaId,
          tipo: 'TREINO' as const,
          timeId: time.id,
          serieId: serie.id,
          inicio: new Date(INICIO.getTime() + i * SEMANA_MS),
          local: 'Quadra 3',
          criadoPorId: serie.criadoPorId,
        })),
      })

      await emitir('evento.alterado', {
        atleticaId,
        eventoIds: ocorrencias.map(({ id }) => id),
        timeId: time.id,
        campos: ['inicio', 'local'],
        autorId: serie.criadoPorId,
      })

      expect(tokens()).toEqual(tokensDe(a, b))
      expect(recebidas(b)[0]).toMatchObject({
        title: 'Treinos de Futsal alterados',
        body: '12 treinos a partir de 12/12 foram alterados.',
        data: { url: `/times/${time.id}` },
      })
    })
  })

  it('evento.cancelado: o elenco recebe "Evento cancelado" (critério 6)', async () => {
    const autor = await membroComAparelho({ papel: 'DIRETOR' })
    const a = await membroComAparelho()
    const treino = await criarTreino({
      atleticaId,
      timeId: time.id,
      inicio: INICIO,
      status: 'CANCELADO',
    })

    await emitir('evento.cancelado', {
      atleticaId,
      eventoIds: [treino.id],
      timeId: time.id,
      autorId: autor.id,
    })

    expect(tokens()).toEqual(tokensDe(a))
    expect(recebidas(a)[0]).toMatchObject({
      title: 'Evento cancelado',
      body: 'Treino de Futsal em 12/12 19:00 foi cancelado.',
      data: { url: `/eventos/${treino.id}`, tipo: 'ALTERACOES_EVENTOS' },
    })
  })

  it('evento.cancelado em várias ocorrências: 1 mensagem por membro, link do time', async () => {
    const a = await membroComAparelho()
    const serie = await criarSerie({ atleticaId, timeId: time.id })
    const ocorrencias = await prismaTeste.evento.createManyAndReturn({
      data: Array.from({ length: 3 }, (_, i) => ({
        atleticaId,
        tipo: 'TREINO' as const,
        timeId: time.id,
        serieId: serie.id,
        status: 'CANCELADO' as const,
        inicio: new Date(INICIO.getTime() + i * SEMANA_MS),
        local: 'Quadra 3',
        criadoPorId: serie.criadoPorId,
      })),
    })

    await emitir('evento.cancelado', {
      atleticaId,
      eventoIds: ocorrencias.map(({ id }) => id),
      timeId: time.id,
      autorId: serie.criadoPorId,
    })

    expect(tokens()).toEqual(tokensDe(a))
    expect(recebidas(a)[0]).toMatchObject({
      title: 'Treinos de Futsal cancelados',
      body: '3 treinos a partir de 12/12 foram cancelados.',
      data: { url: `/times/${time.id}`, tipo: 'ALTERACOES_EVENTOS' },
    })
  })

  it('evento.resultadoRegistrado: todos com resultados = true recebem o placar (critério 10)', async () => {
    const autor = await comAparelho({ papel: 'DIRETOR' })
    const membro = await membroComAparelho()
    const foraDoTime = await comAparelho()
    const semResultados = await comAparelho()
    await criarPreferencias(semResultados, { resultados: false })
    const adversaria = await criarAtleticaAdversaria({ nome: 'Medicina' })
    const adversario = await criarTimeAdversario({
      atleticaId: adversaria.id,
      modalidadeId: time.modalidadeId,
    })
    const jogo = await criarEvento({
      atleticaId,
      tipo: 'JOGO',
      timeId: time.id,
      timeAdversarioId: adversario.id,
      status: 'FINALIZADO',
      placarTime: 3,
      placarAdversario: 1,
      resultado: 'VITORIA',
    })

    await emitir('evento.resultadoRegistrado', { atleticaId, eventoId: jogo.id, autorId: autor.id })

    expect(tokens()).toEqual(tokensDe(membro, foraDoTime))
    expect(recebidas(foraDoTime)[0]).toMatchObject({
      title: 'Vitória da LRD',
      body: 'Futsal 3 x 1 Medicina',
      data: { url: `/eventos/${jogo.id}`, tipo: 'RESULTADOS' },
    })
  })

  it('noticia.publicada: todos os vínculos ativos menos o autor', async () => {
    const autor = await comAparelho({ papel: 'DIRETOR' })
    const a = await comAparelho()
    await comAparelho({ vinculoAtivo: false })
    const noticia = await criarNoticia({
      atleticaId,
      autorId: autor.id,
      titulo: 'Inscrições abertas para o Intercursos',
    })

    await emitir('noticia.publicada', { atleticaId, noticiaId: noticia.id, autorId: autor.id })

    expect(tokens()).toEqual(tokensDe(a))
    expect(recebidas(a)[0]).toMatchObject({
      title: 'LRD publicou uma notícia',
      body: 'Inscrições abertas para o Intercursos',
      data: { url: `/noticias/${noticia.id}`, tipo: 'NOTICIAS' },
    })
  })

  it('noticia.publicada: a republicação não envia de novo', async () => {
    const autor = await comAparelho({ papel: 'DIRETOR' })
    const a = await comAparelho()
    const noticia = await criarNoticia({
      atleticaId,
      autorId: autor.id,
      status: 'RASCUNHO',
      imagemCapaKey: chaveDeCapa(atleticaId, autor.id),
    })
    const auth = `Bearer ${await tokenPara(autor)}`
    const transicionar = (acao: 'publicar' | 'despublicar') =>
      request(contexto.http)
        .post(`/api/v1/painel/noticias/${noticia.id}/${acao}`)
        .set('Authorization', auth)
        .expect(200)

    await aguardarGatilhos(async () => {
      await transicionar('publicar')
      await transicionar('despublicar')
      await transicionar('publicar')
    })

    expect(tokens()).toEqual(tokensDe(a))
  })

  it('solicitacao.criada: diretoria com solicitacoes = true recebe', async () => {
    const diretor = await comAparelho({ papel: 'DIRETOR' })
    const presidente = await comAparelho({ papel: 'PRESIDENTE' })
    const semSolicitacoes = await comAparelho({ papel: 'DIRETOR' })
    await criarPreferencias(semSolicitacoes, { solicitacoes: false })
    const solicitante = await comAparelho({ nome: 'Ana Souza' })
    const solicitacao = await criarSolicitacao(time, solicitante)

    await emitir('solicitacao.criada', {
      atleticaId,
      solicitacaoId: solicitacao.id,
      timeId: time.id,
      autorId: solicitante.id,
    })

    expect(tokens()).toEqual(tokensDe(diretor, presidente))
    expect(recebidas(diretor)[0]).toMatchObject({
      title: 'Nova solicitação de entrada',
      body: 'Ana Souza quer entrar em Futsal.',
      data: { url: '/painel/solicitacoes', tipo: 'SOLICITACOES' },
    })
  })

  it('solicitacao.avaliada: o solicitante recebe, o diretor não', async () => {
    const diretor = await comAparelho({ papel: 'DIRETOR' })
    const solicitante = await comAparelho()
    const solicitacao = await criarSolicitacao(time, solicitante, {
      status: 'APROVADA',
      avaliadoPorId: diretor.id,
    })

    await emitir('solicitacao.avaliada', {
      atleticaId,
      solicitacaoId: solicitacao.id,
      timeId: time.id,
      usuarioId: solicitante.id,
      status: 'APROVADA',
      autorId: diretor.id,
    })

    expect(tokens()).toEqual(tokensDe(solicitante))
    expect(recebidas(solicitante)[0]).toMatchObject({
      title: 'Solicitação aprovada',
      body: 'Você agora faz parte de Futsal.',
      data: { url: `/times/${time.id}` },
    })
  })

  it('solicitacao.avaliada rejeitada: o solicitante recebe "Solicitação não aceita"', async () => {
    const diretor = await comAparelho({ papel: 'DIRETOR' })
    const solicitante = await comAparelho()
    const solicitacao = await criarSolicitacao(time, solicitante, {
      status: 'REJEITADA',
      avaliadoPorId: diretor.id,
    })

    await emitir('solicitacao.avaliada', {
      atleticaId,
      solicitacaoId: solicitacao.id,
      timeId: time.id,
      usuarioId: solicitante.id,
      status: 'REJEITADA',
      autorId: diretor.id,
    })

    expect(tokens()).toEqual(tokensDe(solicitante))
    expect(recebidas(solicitante)[0]).toMatchObject({
      title: 'Solicitação não aceita',
      body: 'Sua solicitação para Futsal não foi aceita.',
      data: { url: `/times/${time.id}`, tipo: 'SOLICITACOES' },
    })
  })

  it('usuario.papelAlterado: chega mesmo com pushAtivo = false; notícia não (critério 11)', async () => {
    const admin = await comAparelho({ papel: 'ADMINISTRADOR' })
    const semPush = await comAparelho({ papel: 'DIRETOR' })
    await criarPreferencias(semPush, { pushAtivo: false })
    const noticia = await criarNoticia({ atleticaId, autorId: admin.id })

    await emitir('usuario.papelAlterado', {
      atleticaId,
      usuarioId: semPush.id,
      papelAnterior: 'ATLETA',
      papelNovo: 'DIRETOR',
      autorId: admin.id,
    })
    await emitir('noticia.publicada', { atleticaId, noticiaId: noticia.id, autorId: admin.id })

    expect(recebidas(semPush)).toEqual([
      expect.objectContaining({
        title: 'Seu cargo foi alterado',
        body: 'Agora você é Diretor(a).',
        data: expect.objectContaining({ url: '/perfil', tipo: 'CARGO' }) as object,
      }),
    ])
  })
})
