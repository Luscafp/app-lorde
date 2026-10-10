import { EventEmitter2 } from '@nestjs/event-emitter'
import type { Time, Usuario } from '../../src/generated/prisma/client'
import type { EventosDominio } from '../../src/infra/eventos/eventos-dominio'
import { AtleticaPadraoService } from '../../src/modules/atleticas/atletica-padrao.service'
import type { FakeExpoPush } from '../../src/modules/notificacoes/envio/fake-expo-push'
import { LembretesService } from '../../src/modules/notificacoes/lembretes/lembretes.service'
import { criarAtletica } from '../fabricas/atletica'
import { criarSerie, criarTreino, type DadosParticipacao } from '../fabricas/eventos'
import { criarDispositivo, criarPreferencias, fakeExpo } from '../fabricas/notificacoes'
import { adicionarMembro, criarTime } from '../fabricas/times'
import { criarUsuario } from '../fabricas/usuario'
import { criarApp, type AppDeTeste } from '../setup/criar-app'
import { aguardarCondicao, processarFilas } from '../setup/fila'
import { prismaTeste } from '../setup/prisma-teste'

const HORA_MS = 60 * 60 * 1000

interface JobAgendado {
  name: string
  singleton_key: string
}

/** Jobs de lembrete e de confirmação pendente ainda não executados, por horário. */
function jobsAgendados(): Promise<JobAgendado[]> {
  return prismaTeste.$queryRaw<JobAgendado[]>`
    SELECT name, singleton_key FROM pgboss.job
    WHERE name IN ('notificacao.lembrete', 'notificacao.confirmacao-pendente')
      AND state = 'created'
    ORDER BY start_after, name`
}

/** Faz os jobs agendados vencerem agora, como se o relógio tivesse chegado ao horário. */
async function anteciparJobs(): Promise<void> {
  await prismaTeste.$executeRaw`
    UPDATE pgboss.job SET start_after = now()
    WHERE name IN ('notificacao.lembrete', 'notificacao.confirmacao-pendente')
      AND state = 'created'`
}

describe('Lembretes e confirmação pendente (#90)', () => {
  let contexto: AppDeTeste
  let padraoId: string
  let expo: FakeExpoPush
  let lembretes: LembretesService
  let emissor: EventEmitter2

  const emHoras = (horas: number) => new Date(Date.now() + horas * HORA_MS)

  async function atleta(time: Time, preferencias?: Parameters<typeof criarPreferencias>[1]) {
    const usuario = await criarUsuario({ atleticaId: padraoId })
    const dispositivo = await criarDispositivo(usuario)
    await adicionarMembro(time, usuario)
    if (preferencias) await criarPreferencias(usuario, preferencias)
    return { ...usuario, token: dispositivo.tokenPush }
  }

  const titulos = ({ token }: { token: string }) =>
    expo
      .enviadas()
      .filter(({ to }) => to === token)
      .map(({ title }) => title)

  const confirmou = (usuario: Pick<Usuario, 'id'>, confirmado: boolean | null = true) =>
    ({ usuarioId: usuario.id, confirmado }) satisfies DadosParticipacao

  async function executarTudo(): Promise<void> {
    await anteciparJobs()
    await processarFilas(contexto.app)
  }

  beforeAll(async () => {
    contexto = await criarApp()
    padraoId = contexto.app.get(AtleticaPadraoService).id()
    expo = fakeExpo(contexto.app)
    lembretes = contexto.app.get(LembretesService)
    emissor = contexto.app.get(EventEmitter2)
  })

  beforeEach(async () => {
    expo.limpar()
    await criarAtletica({ id: padraoId, nome: 'Atlética Lorde' })
  })

  afterAll(async () => {
    await contexto.app.close()
  })

  describe('agendamento', () => {
    it('evento criado para daqui a 3 h: só os lembretes de 1 h e 2 h', async () => {
      const time = await criarTime({ atleticaId: padraoId })
      const evento = await criarTreino({
        atleticaId: padraoId,
        timeId: time.id,
        inicio: emHoras(3),
      })
      const inicio = evento.inicio.toISOString()

      emissor.emit('evento.criado', {
        atleticaId: padraoId,
        eventoId: evento.id,
        timeId: time.id,
        autorId: evento.criadoPorId,
      } satisfies EventosDominio['evento.criado'])
      await aguardarCondicao(async () => (await jobsAgendados()).length >= 2)

      expect(await jobsAgendados()).toEqual([
        { name: 'notificacao.lembrete', singleton_key: `lembrete:${evento.id}:2:${inicio}` },
        { name: 'notificacao.lembrete', singleton_key: `lembrete:${evento.id}:1:${inicio}` },
      ])
    })

    it('reconciliação rodando duas vezes não duplica jobs', async () => {
      const time = await criarTime({ atleticaId: padraoId })
      await criarTreino({ atleticaId: padraoId, timeId: time.id, inicio: emHoras(30) })
      await criarTreino({ atleticaId: padraoId, timeId: time.id, inicio: emHoras(60) })

      expect(await lembretes.reconciliar()).toBe(5)
      expect(await lembretes.reconciliar()).toBe(0)

      const jobs = await jobsAgendados()
      expect(jobs).toHaveLength(5)
      expect(new Set(jobs.map(({ singleton_key }) => singleton_key)).size).toBe(5)
    })

    it('série criada agenda as ocorrências das próximas 48 h', async () => {
      const time = await criarTime({ atleticaId: padraoId })
      const serie = await criarSerie({ atleticaId: padraoId, timeId: time.id })
      const ocorrencia = (horas: number) =>
        criarTreino({
          atleticaId: padraoId,
          timeId: time.id,
          serieId: serie.id,
          inicio: emHoras(horas),
        })
      const primeira = await ocorrencia(10)
      const segunda = await ocorrencia(30)
      const fora = await ocorrencia(60)

      emissor.emit('evento.criado', {
        atleticaId: padraoId,
        eventoId: primeira.id,
        timeId: time.id,
        serieId: serie.id,
        autorId: serie.criadoPorId,
      } satisfies EventosDominio['evento.criado'])
      await aguardarCondicao(async () => (await jobsAgendados()).length >= 8)

      const chaves = (await jobsAgendados()).map(({ singleton_key }) => singleton_key)
      expect(chaves.filter((chave) => chave.includes(primeira.id))).toHaveLength(3)
      expect(chaves.filter((chave) => chave.includes(segunda.id))).toHaveLength(5)
      expect(chaves.some((chave) => chave.includes(fora.id))).toBe(false)
    })
  })

  describe('execução', () => {
    it('cada atleta recebe uma vez, na antecedência lida na execução (critério 7)', async () => {
      const time = await criarTime({ atleticaId: padraoId })
      const padrao = await atleta(time)
      const vinteQuatro = await atleta(time, { antecedenciaLembreteHoras: 24 })
      const mudou = await atleta(time, { antecedenciaLembreteHoras: 2 })
      const evento = await criarTreino({
        atleticaId: padraoId,
        timeId: time.id,
        inicio: emHoras(30),
        participantes: [confirmou(padrao), confirmou(vinteQuatro), confirmou(mudou)],
      })
      await lembretes.reconciliar()
      await prismaTeste.preferenciaNotificacao.update({
        where: { usuarioId: mudou.id },
        data: { antecedenciaLembreteHoras: 24 },
      })

      await executarTudo()

      expect(titulos(padrao)).toEqual(['Lembrete: treino em 2 h'])
      expect(titulos(vinteQuatro)).toEqual(['Lembrete: treino em 24 h'])
      expect(titulos(mudou)).toEqual(['Lembrete: treino em 24 h'])
      const [mensagem] = expo.enviadas().filter(({ to }) => to === padrao.token)
      expect(mensagem?.data).toMatchObject({ url: `/eventos/${evento.id}`, tipo: 'LEMBRETES' })
      expect(mensagem?.ttl).toBeGreaterThan(29 * 3600)
    })

    it('"Você vai?" só para o elenco atual sem resposta e com lembretes ativos (critério 9)', async () => {
      const time = await criarTime({ atleticaId: padraoId })
      const vou = await atleta(time)
      const naoVou = await atleta(time)
      const semParticipacao = await atleta(time)
      const respostaNula = await atleta(time)
      const desligado = await atleta(time, { lembretes: false })
      const confirmadoDesligado = await atleta(time, { lembretes: false })
      const exMembro = await criarUsuario({ atleticaId: padraoId })
      const tokenExMembro = (await criarDispositivo(exMembro)).tokenPush
      await adicionarMembro(time, exMembro, { saidaEm: new Date() })
      await criarTreino({
        atleticaId: padraoId,
        timeId: time.id,
        inicio: emHoras(30),
        participantes: [
          confirmou(vou),
          confirmou(naoVou, false),
          confirmou(respostaNula, null),
          confirmou(confirmadoDesligado),
        ],
      })
      await lembretes.reconciliar()

      await executarTudo()

      const vaiVoce = expo.enviadas().filter(({ title }) => title === 'Você vai?')
      expect(vaiVoce.map(({ to }) => to).sort()).toEqual(
        [semParticipacao.token, respostaNula.token].sort(),
      )
      expect(titulos(vou)).toEqual(['Lembrete: treino em 2 h'])
      expect(titulos(naoVou)).toEqual([])
      expect(titulos(desligado)).toEqual([])
      expect(titulos(confirmadoDesligado)).toEqual([])
      expect(titulos({ token: tokenExMembro })).toEqual([])
    })

    it('evento adiado: o horário antigo não envia e o novo envia (critério 8)', async () => {
      const time = await criarTime({ atleticaId: padraoId })
      const confirmado = await atleta(time)
      const evento = await criarTreino({
        atleticaId: padraoId,
        timeId: time.id,
        inicio: emHoras(5),
        participantes: [confirmou(confirmado)],
      })
      await lembretes.reconciliar()
      await prismaTeste.evento.update({
        where: { id: evento.id },
        data: { inicio: new Date(evento.inicio.getTime() + 24 * HORA_MS) },
      })

      await executarTudo()
      expect(expo.enviadas()).toEqual([])

      await lembretes.reconciliar()
      await executarTudo()
      expect(titulos(confirmado)).toEqual(['Lembrete: treino em 2 h'])
    })

    it('evento cancelado: nenhum lembrete nem "Você vai?" é enviado (critério 6)', async () => {
      const time = await criarTime({ atleticaId: padraoId })
      const confirmado = await atleta(time)
      await atleta(time)
      const evento = await criarTreino({
        atleticaId: padraoId,
        timeId: time.id,
        inicio: emHoras(30),
        participantes: [confirmou(confirmado)],
      })
      await lembretes.reconciliar()
      await prismaTeste.evento.update({
        where: { id: evento.id },
        data: { status: 'CANCELADO' },
      })

      await executarTudo()

      expect(expo.enviadas()).toEqual([])
    })
  })
})
