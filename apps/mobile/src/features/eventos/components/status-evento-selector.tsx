import {
  formatarDataHora,
  StatusEvento,
  transicaoPermitida,
  type EventoDto,
} from '@atletica/shared'
import { Pressable, Text, View } from 'react-native'
import { confirmar, Texto, toast } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { useAlterarStatus } from '../hooks'
import { STATUS } from '../rotulos'

export const MENSAGEM_CANCELADO_SEM_STATUS = 'Eventos cancelados não podem mudar de status.'

const AVISAM_DATA_FUTURA: StatusEvento[] = [StatusEvento.EM_ANDAMENTO, StatusEvento.FINALIZADO]

function mensagemConfirmacao(destino: StatusEvento, inicio: string): string {
  const mensagem = `O evento ficará como ${STATUS[destino].rotulo}`
  if (AVISAM_DATA_FUTURA.includes(destino) && Date.parse(inicio) > Date.now())
    return `${mensagem}, mas está previsto para ${formatarDataHora(inicio)}.`
  return `${mensagem}.`
}

type Props = {
  evento: Pick<EventoDto, 'id' | 'status' | 'inicio'>
  /** `CANCELADO` segue o fluxo de cancelamento do detalhe (escopo em série). */
  aoCancelar: () => void
}

export function StatusEventoSelector({ evento, aoCancelar }: Props) {
  const alterar = useAlterarStatus()
  const ocupado = !alterar.online || alterar.isPending

  const escolher = (destino: StatusEvento) => {
    if (destino === StatusEvento.CANCELADO) return aoCancelar()
    const { rotulo } = STATUS[destino]
    confirmar({
      titulo: `Marcar como ${rotulo}?`,
      mensagem: mensagemConfirmacao(destino, evento.inicio),
      acao: 'Confirmar',
      cancelar: 'Voltar',
      destrutiva: false,
      aoConfirmar: () =>
        alterar.mutate(
          { id: evento.id, status: destino },
          { onSuccess: () => toast.sucesso(`Status alterado para ${rotulo}`) },
        ),
    })
  }

  return (
    <View className="gap-2">
      <Texto variante="rotulo">Status</Texto>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
        {Object.values(StatusEvento).map((status) => {
          const { rotulo, cor } = STATUS[status]
          const atual = status === evento.status
          const desabilitado = !atual && (ocupado || !transicaoPermitida(evento.status, status))
          return (
            <Pressable
              key={status}
              accessibilityRole="radio"
              accessibilityLabel={rotulo}
              accessibilityState={{ selected: atual, disabled: desabilitado }}
              disabled={atual || desabilitado}
              onPress={() => escolher(status)}
              className="min-h-[44px] justify-center rounded-full border px-4"
              style={{
                borderColor: atual ? cor : paleta.borda,
                backgroundColor: atual ? `${cor}22` : 'transparent',
                opacity: desabilitado ? 0.4 : 1,
              }}
            >
              <Text
                className={`text-sm ${atual ? 'font-semibold' : ''}`}
                style={{ color: atual ? cor : paleta.texto }}
              >
                {rotulo}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {evento.status === StatusEvento.CANCELADO && (
        <Texto variante="legenda">{MENSAGEM_CANCELADO_SEM_STATUS}</Texto>
      )}
    </View>
  )
}
