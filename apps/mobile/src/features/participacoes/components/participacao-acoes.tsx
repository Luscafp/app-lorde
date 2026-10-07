import {
  avaliarResposta,
  formatarDataHora,
  MotivoBloqueioResposta,
  StatusEvento,
  type EventoDetalheDto,
  type MinhaParticipacao,
} from '@atletica/shared'
import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Botao, Texto, toast } from '@/components/ui'
import { useResponderParticipacao } from '../hooks'

export const MENSAGEM_SO_ELENCO = 'Apenas membros do elenco podem confirmar participação'
export const MENSAGEM_SEM_RESPOSTA = 'Você ainda não respondeu'
export const MENSAGEM_SEM_CONEXAO_RESPOSTA = 'Sem conexão'
export const INTERVALO_RELOGIO_MS = 30_000

function rotuloBloqueio(motivo: MotivoBloqueioResposta, status: StatusEvento): string {
  if (motivo === MotivoBloqueioResposta.EVENTO_CANCELADO) return 'Evento cancelado'
  if (
    motivo === MotivoBloqueioResposta.EVENTO_NAO_AGENDADO &&
    status !== StatusEvento.EM_ANDAMENTO
  ) {
    return 'Evento finalizado'
  }
  return 'O evento já começou'
}

/** O motivo de bloqueio vence a falta de conexão: a resposta não seria aceita nem online. */
function legendaParticipacao(
  motivo: MotivoBloqueioResposta | null,
  status: StatusEvento,
  online: boolean,
  atual: MinhaParticipacao,
): string {
  if (motivo) return rotuloBloqueio(motivo, status)
  if (!online) return MENSAGEM_SEM_CONEXAO_RESPOSTA
  if (!atual) return MENSAGEM_SEM_RESPOSTA
  return `Respondido em ${formatarDataHora(atual.respondidoEm)} · você pode alterar até o início`
}

/** Desabilita os botões quando o início passa com a tela aberta, sem esperar o servidor. */
function useAgora(): Date {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), INTERVALO_RELOGIO_MS)
    return () => clearInterval(id)
  }, [])
  return agora
}

type Props = { evento: EventoDetalheDto; aoAbrirTime: (timeId: string) => void }

/** Botões "Vou"/"Não vou" do detalhe (#24, UC15). */
export function ParticipacaoAcoes({ evento, aoAbrirTime }: Props) {
  const agora = useAgora()
  const mutacao = useResponderParticipacao(evento.id)
  const enviando = useRef(false)

  if (!evento.souMembro) {
    if (evento.status === StatusEvento.CANCELADO) return null
    return (
      <View className="gap-1">
        <Texto variante="legenda">{MENSAGEM_SO_ELENCO}</Texto>
        <Pressable
          accessibilityRole="link"
          onPress={() => aoAbrirTime(evento.time.id)}
          className="min-h-[44px] justify-center self-start"
        >
          <Texto className="font-semibold underline">Ver time</Texto>
        </Pressable>
      </View>
    )
  }

  const local = avaliarResposta(evento, evento.souMembro, agora)
  const motivo = evento.motivoBloqueioResposta ?? local.motivoBloqueioResposta
  const atual = evento.minhaParticipacao
  const desabilitado = Boolean(motivo) || !mutacao.online || mutacao.isPending
  const legenda = legendaParticipacao(motivo, evento.status, mutacao.online, atual)

  function responder(confirmado: boolean) {
    if (enviando.current || atual?.confirmado === confirmado) return
    enviando.current = true
    mutacao.mutate(confirmado, {
      onSuccess: () =>
        toast.sucesso(confirmado ? 'Participação confirmada' : 'Você marcou que não vai'),
      onSettled: () => {
        enviando.current = false
      },
    })
  }

  const opcao = (confirmado: boolean) => {
    const ativa = atual?.confirmado === confirmado
    const destaque = confirmado ? 'sucesso' : 'perigo'
    const carregando = mutacao.isPending && mutacao.variables === confirmado
    return {
      variante: !atual || ativa ? destaque : 'secundaria',
      carregando,
      disabled: desabilitado,
      accessibilityState: { selected: ativa, disabled: desabilitado, busy: carregando },
      className: 'flex-1',
      onPress: () => responder(confirmado),
    } as const
  }

  return (
    <View testID="participacao-acoes" className="gap-2">
      <View className="flex-row gap-3">
        <Botao titulo="Vou" testID="botao-vou" {...opcao(true)} />
        <Botao titulo="Não vou" testID="botao-nao-vou" {...opcao(false)} />
      </View>
      <Texto variante="legenda" testID="legenda-participacao" accessibilityLiveRegion="polite">
        {legenda}
      </Texto>
    </View>
  )
}
