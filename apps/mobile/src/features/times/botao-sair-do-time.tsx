import { LIMITE_MAXIMO, StatusEvento, type TimeDto } from '@atletica/shared'
import { Botao, confirmar } from '@/components/ui'
import { useProximosEventos } from '@/features/eventos'
import { useSessao } from '@/infra/sessao/store'
import { useSairDoTime } from './hooks'

type Props = {
  time: Pick<TimeDto, 'id' | 'nome'>
  souCapitao: boolean
  temConfirmacoesFuturas?: boolean
}

function mensagemSaida({ time, souCapitao, temConfirmacoesFuturas }: Props): string {
  return [
    `Sair do ${time.nome}? Para voltar, será preciso enviar uma nova solicitação.`,
    souCapitao && 'Você é o capitão; o time ficará sem capitão.',
    temConfirmacoesFuturas && 'Suas confirmações nos próximos eventos deste time serão removidas.',
  ]
    .filter(Boolean)
    .join(' ')
}

export function BotaoSairDoTime(props: Props) {
  const saida = useSairDoTime(props.time.id)

  return (
    <Botao
      titulo="Sair do time"
      variante="perigo"
      carregando={saida.isPending}
      disabled={!saida.online}
      onPress={() =>
        confirmar({
          titulo: 'Sair do time',
          mensagem: mensagemSaida(props),
          acao: 'Sair',
          aoConfirmar: () => saida.mutate(),
        })
      }
    />
  )
}

/** As respostas apagadas pela API são as dos eventos agendados futuros (#34 §14). */
export function BotaoSairDoTimeNaTela({ time }: { time: TimeDto }) {
  const meuId = useSessao((estado) => estado.usuario?.id)
  const proximos = useProximosEventos({ timeId: time.id }, LIMITE_MAXIMO)
  const temConfirmacoesFuturas = proximos.data?.items.some(
    (evento) => evento.status === StatusEvento.AGENDADO && evento.minhaParticipacao !== null,
  )

  return (
    <BotaoSairDoTime
      time={time}
      souCapitao={!!meuId && time.capitao?.id === meuId}
      temConfirmacoesFuturas={temConfirmacoesFuturas}
    />
  )
}
