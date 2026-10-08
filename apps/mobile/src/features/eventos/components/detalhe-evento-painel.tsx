import {
  EscopoOcorrencia,
  ehEstaESeguintes,
  formatarDataHora,
  Papel,
  StatusEvento,
  TipoEvento,
  type EventoDto,
} from '@atletica/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Botao, Cartao, confirmar, Selo, Texto, toast } from '@/components/ui'
import type { ApiErro } from '@/infra/api/cliente'
import { mostrarErroDaMutacao } from '@/infra/query/query-client'
import { useOnline } from '@/infra/rede/online'
import { useTemNivelMinimo } from '@/infra/sessao/use-tem-nivel-minimo'
import { aceitaResultado, contarTreinos, rotuloAdversario, tituloEvento } from '../formatacao'
import { CodigoEvento, useAgendadosDaSerie, useCancelarEvento, useExcluirEvento } from '../hooks'
import { ROTULO_TIPO, STATUS } from '../rotulos'
import { EscopoSheet } from './escopo-sheet'
import { useResultadoLabel } from './placar/use-resultado-label'
import { StatusEventoSelector } from './status-evento-selector'

const MENSAGEM_COM_DEPENDENCIAS =
  'Este evento tem respostas, presenças ou resultado. Cancele-o em vez de excluir.'

const CANCELAVEIS: StatusEvento[] = [StatusEvento.AGENDADO, StatusEvento.EM_ANDAMENTO]

type Acao = 'editar' | 'cancelar'

const TITULO_ESCOPO: Record<Acao, string> = {
  editar: 'Editar treino recorrente',
  cancelar: 'Cancelar treino recorrente',
}

function mensagemCancelarSeguintes(agendados?: number): string {
  if (agendados === undefined)
    return 'Os treinos agendados a partir deste serão cancelados e continuarão visíveis como Cancelado até a data.'
  const verbos =
    agendados === 1
      ? 'será cancelado e continuará visível'
      : 'serão cancelados e continuarão visíveis'
  return `${contarTreinos(agendados, 'agendado')} ${verbos} como Cancelado até a data.`
}

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
  aoEditar: (escopo: EscopoOcorrencia) => void
  aoExcluir: () => void
  aoRegistrarResultado: () => void
}

export function DetalheEventoPainel({ evento, aoEditar, aoExcluir, aoRegistrarResultado }: Props) {
  const online = useOnline()
  const ehPresidencia = useTemNivelMinimo(Papel.PRESIDENTE)
  const cancelar = useCancelarEvento()
  const excluir = useExcluirEvento()
  const [escolhendo, setEscolhendo] = useState<Acao | null>(null)
  const agendados = useAgendadosDaSerie(escolhendo ? evento.serieId : null, evento.inicio)
  const ocupado = !online || cancelar.isPending || excluir.isPending
  const resultado = useResultadoLabel(evento.resultado)
  const jogo = evento.tipo === TipoEvento.JOGO
  const finalizado = evento.status === StatusEvento.FINALIZADO

  const pedirCancelamento = (escopo: EscopoOcorrencia) => {
    const seguintes = ehEstaESeguintes(escopo)
    confirmar({
      titulo: seguintes ? 'Cancelar treinos?' : 'Cancelar evento?',
      mensagem: seguintes
        ? mensagemCancelarSeguintes(agendados.data)
        : 'O evento ficará como Cancelado e continuará visível na agenda até a data prevista.',
      acao: seguintes ? 'Cancelar treinos' : 'Cancelar evento',
      cancelar: 'Voltar',
      aoConfirmar: () =>
        cancelar.mutate(
          { id: evento.id, escopo: seguintes ? escopo : undefined },
          {
            onSuccess: ({ eventoIds }) =>
              toast.sucesso(
                seguintes && eventoIds.length > 1
                  ? contarTreinos(eventoIds.length, 'cancelado')
                  : 'Evento cancelado',
              ),
          },
        ),
    })
  }

  const iniciar = (acao: Acao) => {
    if (evento.serieId) return setEscolhendo(acao)
    if (acao === 'editar') aoEditar(EscopoOcorrencia.ESTA)
    else pedirCancelamento(EscopoOcorrencia.ESTA)
  }

  const escolher = (escopo: EscopoOcorrencia) => {
    const acao = escolhendo
    setEscolhendo(null)
    if (acao === 'editar') aoEditar(escopo)
    else if (acao === 'cancelar') pedirCancelamento(escopo)
  }

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
          {evento.serieId && <Selo texto="↺ Recorrente" />}
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
        {jogo && finalizado && (
          <Linha
            rotulo="Placar"
            valor={
              evento.resultado
                ? resultado.descrever(`${evento.placarTime} × ${evento.placarAdversario}`)
                : resultado.frase
            }
          />
        )}
      </Cartao>
      <StatusEventoSelector
        evento={evento}
        bloqueado={cancelar.isPending || excluir.isPending}
        aoCancelar={() => iniciar('cancelar')}
      />
      {aceitaResultado(evento) && (
        <Botao
          titulo={evento.resultado ? 'Corrigir resultado' : 'Registrar resultado'}
          onPress={aoRegistrarResultado}
        />
      )}
      {evento.status !== StatusEvento.CANCELADO && (
        <Botao titulo="Editar" variante="secundaria" onPress={() => iniciar('editar')} />
      )}
      {CANCELAVEIS.includes(evento.status) && (
        <Botao
          titulo="Cancelar evento"
          variante="secundaria"
          carregando={cancelar.isPending}
          disabled={ocupado}
          onPress={() => iniciar('cancelar')}
        />
      )}
      {ehPresidencia && (
        <Botao
          titulo="Ver histórico"
          variante="secundaria"
          onPress={() =>
            router.push({
              pathname: '/painel/auditoria',
              params: { entidade: 'Evento', entidadeId: evento.id },
            })
          }
        />
      )}
      {ehPresidencia && (
        <Botao
          titulo="Excluir"
          variante="perigo"
          carregando={excluir.isPending}
          disabled={ocupado}
          onPress={pedirExclusao}
        />
      )}
      {escolhendo && (
        <EscopoSheet
          titulo={TITULO_ESCOPO[escolhendo]}
          agendados={agendados.data}
          aoEscolher={escolher}
          aoFechar={() => setEscolhendo(null)}
        />
      )}
    </ScrollView>
  )
}
