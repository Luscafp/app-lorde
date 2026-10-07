import {
  avaliarResposta,
  formatarDataHora,
  MotivoBloqueioResposta,
  StatusEvento,
  type EventoDetalheDto,
} from '@atletica/shared'
import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Botao, Texto, toast } from '@/components/ui'
import { useResponderParticipacao } from '../hooks'

export const MENSAGEM_SO_ELENCO = 'Apenas membros do elenco podem confirmar participação'
export const MENSAGEM_SEM_RESPOSTA = 'Você ainda não respondeu'
export const MENSAGEM_SEM_CONEXAO_RESPOSTA = 'Sem conexão'
export const INTERVALO_RELOGIO_MS = 30_000

const TOAST_RESPOSTA = { true: 'Participação confirmada', false: 'Você marcou que não vai' }

function bloqueio(motivo: MotivoBloqueioResposta, status: StatusEvento): string {
  if (motivo === MotivoBloqueioResposta.EVENTO_CANCELADO) return 'Evento cancelado'
  if (
    motivo === MotivoBloqueioResposta.EVENTO_NAO_AGENDADO &&
    status !== StatusEvento.EM_ANDAMENTO
  ) {
    return 'Evento finalizado'
  }
  return 'O evento já começou'
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
  const resposta = useResponderParticipacao(evento.id)
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
  const desabilitado = Boolean(motivo) || !resposta.online || resposta.isPending

  const legenda = !resposta.online
    ? MENSAGEM_SEM_CONEXAO_RESPOSTA
    : motivo
      ? bloqueio(motivo, evento.status)
      : atual
        ? `Respondido em ${formatarDataHora(atual.respondidoEm)} · você pode alterar até o início`
        : MENSAGEM_SEM_RESPOSTA

  function responder(confirmado: boolean) {
    if (enviando.current || atual?.confirmado === confirmado) return
    enviando.current = true
    resposta.mutate(confirmado, {
      onSuccess: () => toast.sucesso(TOAST_RESPOSTA[`${confirmado}`]),
      onSettled: () => {
        enviando.current = false
      },
    })
  }

  const opcao = (confirmado: boolean) => {
    const ativa = atual?.confirmado === confirmado
    const destaque = confirmado ? 'sucesso' : 'perigo'
    const carregando = resposta.isPending && resposta.variables === confirmado
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
