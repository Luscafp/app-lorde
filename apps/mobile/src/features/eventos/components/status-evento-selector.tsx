import {
  formatarDataHora,
  StatusEvento,
  transicaoPermitida,
  type EventoDto,
} from '@atletica/shared'
import { View } from 'react-native'
import { AvisoOffline, confirmar, Pilula, Texto, toast } from '@/components/ui'
import { useAlterarStatus } from '../hooks'
import { STATUS } from '../rotulos'

export const MENSAGEM_CANCELADO_SEM_STATUS = 'Eventos cancelados não podem mudar de status.'
export const MENSAGEM_COM_RESULTADO_SEM_STATUS =
  'Jogos com resultado registrado não podem mudar de status.'

const AVISAM_DATA_FUTURA: StatusEvento[] = [StatusEvento.EM_ANDAMENTO, StatusEvento.FINALIZADO]

function mensagemConfirmacao(destino: StatusEvento, inicio: string): string {
  const mensagem = `O evento ficará como ${STATUS[destino].rotulo}`
  if (AVISAM_DATA_FUTURA.includes(destino) && Date.parse(inicio) > Date.now())
    return `${mensagem}, mas está previsto para ${formatarDataHora(inicio)}.`
  return `${mensagem}.`
}

function motivoSemTransicao({ status, resultado }: Props['evento']): string | null {
  if (status === StatusEvento.CANCELADO) return MENSAGEM_CANCELADO_SEM_STATUS
  if (status === StatusEvento.FINALIZADO && resultado !== null)
    return MENSAGEM_COM_RESULTADO_SEM_STATUS
  return null
}

type Props = {
  evento: Pick<EventoDto, 'id' | 'status' | 'inicio' | 'resultado'>
  /** Outra ação do detalhe (cancelar, excluir) em andamento. */
  bloqueado: boolean
  /** `CANCELADO` segue o fluxo de cancelamento do detalhe (escopo em série). */
  aoCancelar: () => void
}

export function StatusEventoSelector({ evento, bloqueado, aoCancelar }: Props) {
  const alterar = useAlterarStatus()
  const motivo = motivoSemTransicao(evento)
  const ocupado = bloqueado || !alterar.online || alterar.isPending

  const escolher = (destino: StatusEvento) => {
    if (destino === evento.status) return
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
          const permitido = !motivo && transicaoPermitida(evento.status, status)
          return (
            <Pilula
              key={status}
              rotulo={rotulo}
              ativa={atual}
              cor={cor}
              desabilitada={!atual && (ocupado || !permitido)}
              aoPressionar={() => escolher(status)}
            />
          )
        })}
      </View>
      {motivo ? (
        <Texto variante="legenda">{motivo}</Texto>
      ) : (
        <AvisoOffline online={alterar.online} />
      )}
    </View>
  )
}
