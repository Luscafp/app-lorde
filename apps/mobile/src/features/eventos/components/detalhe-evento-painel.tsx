import { formatarDataHora, Papel, StatusEvento, type EventoDto } from '@atletica/shared'
import { ScrollView, View } from 'react-native'
import { Botao, Cartao, confirmar, Selo, Texto, toast } from '@/components/ui'
import type { ApiErro } from '@/infra/api/cliente'
import { mostrarErroDaMutacao } from '@/infra/query/query-client'
import { useOnline } from '@/infra/rede/online'
import { useTemNivelMinimo } from '@/infra/sessao/use-tem-nivel-minimo'
import { rotuloAdversario, tituloEvento } from '../formatacao'
import { CodigoEvento, useCancelarEvento, useExcluirEvento } from '../hooks'
import { ROTULO_TIPO, STATUS } from '../rotulos'

const MENSAGEM_COM_DEPENDENCIAS =
  'Este evento tem respostas, presenças ou resultado. Cancele-o em vez de excluir.'

const CANCELAVEIS: StatusEvento[] = [StatusEvento.AGENDADO, StatusEvento.EM_ANDAMENTO]

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View className="gap-0.5">
      <Texto variante="legenda">{rotulo}</Texto>
      <Texto>{valor}</Texto>
    </View>
  )
}

type Props = {
  evento: EventoDto
  aoEditar: () => void
  aoExcluir: () => void
}

export function DetalheEventoPainel({ evento, aoEditar, aoExcluir }: Props) {
  const online = useOnline()
  const podeExcluir = useTemNivelMinimo(Papel.PRESIDENTE)
  const cancelar = useCancelarEvento()
  const excluir = useExcluirEvento()
  const ocupado = !online || cancelar.isPending || excluir.isPending

  const pedirCancelamento = () =>
    confirmar({
      titulo: 'Cancelar evento?',
      mensagem:
        'O evento ficará como Cancelado e continuará visível na agenda até a data prevista.',
      acao: 'Cancelar evento',
      cancelar: 'Voltar',
      aoConfirmar: () =>
        cancelar.mutate(evento.id, { onSuccess: () => toast.sucesso('Evento cancelado') }),
    })

  const pedirExclusao = () =>
    confirmar({
      titulo: 'Excluir evento?',
      mensagem: 'Esta ação não pode ser desfeita.',
      acao: 'Excluir',
      aoConfirmar: () =>
        excluir.mutate(evento.id, {
          onSuccess: () => {
            toast.sucesso('Evento excluído')
            aoExcluir()
          },
          onError: (erro: ApiErro) => {
            if (erro.code === CodigoEvento.EVENTO_COM_DEPENDENCIAS)
              toast.erro(MENSAGEM_COM_DEPENDENCIAS)
            else mostrarErroDaMutacao(erro)
          },
        }),
    })

  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <View className="gap-2">
        <Texto variante="titulo">{tituloEvento(evento)}</Texto>
        <View className="flex-row gap-2">
          <Selo texto={ROTULO_TIPO[evento.tipo]} />
          <Selo texto={STATUS[evento.status].rotulo} />
        </View>
      </View>
      <Cartao className="gap-3">
        <Linha rotulo="Data e horário" valor={formatarDataHora(evento.inicio)} />
        <Linha rotulo="Local" valor={evento.local} />
        <Linha rotulo="Time" valor={evento.time.nome} />
        <Linha rotulo="Modalidade" valor={evento.modalidade.nome} />
        {evento.timeAdversario && (
          <Linha rotulo="Adversário" valor={rotuloAdversario(evento.timeAdversario)} />
        )}
        {evento.observacoes && <Linha rotulo="Observações" valor={evento.observacoes} />}
      </Cartao>
      {evento.status !== StatusEvento.CANCELADO && (
        <Botao titulo="Editar" variante="secundaria" onPress={aoEditar} />
      )}
      {CANCELAVEIS.includes(evento.status) && (
        <Botao
          titulo="Cancelar evento"
          variante="secundaria"
          carregando={cancelar.isPending}
          disabled={ocupado}
          onPress={pedirCancelamento}
        />
      )}
      {podeExcluir && (
        <Botao
          titulo="Excluir"
          variante="perigo"
          carregando={excluir.isPending}
          disabled={ocupado}
          onPress={pedirExclusao}
        />
      )}
    </ScrollView>
  )
}
