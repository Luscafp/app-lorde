import {
  formatarDataHora,
  StatusEvento,
  type EventoDetalheDto,
  type EventoResumoDto,
} from '@atletica/shared'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Imagem } from '@/components/imagem'
import { Botao, Cartao, CartaoLinha, Selo, Texto } from '@/components/ui'
import { useAtletica } from '@/features/atletica'
import { contar, porNome } from '@/features/times/formatacao'
import { useVePainel } from '@/infra/sessao/use-ve-painel'
import { ehDetalhe, type EventoEmTela } from '../consultas'
import { tituloEvento } from '../formatacao'
import { RESULTADO, ROTULO_TIPO, siglaOuNome, STATUS } from '../rotulos'
import { ParticipacaoAcoes } from './participacao-acoes'

export const MENSAGEM_RESULTADO_PENDENTE = 'Resultado pendente'
export const MENSAGEM_NINGUEM_CONFIRMOU = 'Ninguém confirmou ainda'

type Confirmado = EventoDetalheDto['confirmados'][number]

export function resumoContagem({
  confirmados,
  recusados,
  semResposta,
}: EventoDetalheDto['contagem']) {
  return [
    contar(confirmados, 'vai', 'vão'),
    contar(recusados, 'não vai', 'não vão'),
    `${semResposta} sem resposta`,
  ].join(' · ')
}

function Chips({ evento }: { evento: EventoResumoDto }) {
  const status = STATUS[evento.status]
  return (
    <View className="flex-row flex-wrap gap-2">
      <Selo texto={ROTULO_TIPO[evento.tipo]} />
      <Selo texto={evento.modalidade.nome} />
      <Selo texto={status.rotulo} cor={status.cor} />
      {evento.serieId && <Selo texto="↺ Recorrente" />}
    </View>
  )
}

function CartaoPlacar({ evento }: { evento: EventoResumoDto }) {
  const { timeAdversario, placarTime, placarAdversario, resultado } = evento
  if (!timeAdversario) return null
  const temPlacar = placarTime !== null && placarAdversario !== null
  const pendente = !temPlacar && evento.status === StatusEvento.FINALIZADO

  return (
    <Cartao testID="cartao-placar" className="items-center">
      <View className="flex-row items-center gap-3">
        <Texto variante="rotulo" className="flex-1 text-center">
          {evento.time.nome}
        </Texto>
        <Texto variante="titulo">{temPlacar ? `${placarTime} × ${placarAdversario}` : 'VS'}</Texto>
        <Texto variante="rotulo" className="flex-1 text-center">
          {siglaOuNome(timeAdversario.atletica)}
        </Texto>
      </View>
      {temPlacar && resultado && (
        <Selo texto={RESULTADO[resultado].rotulo} cor={RESULTADO[resultado].cor} />
      )}
      {pendente && <Texto variante="legenda">{MENSAGEM_RESULTADO_PENDENTE}</Texto>}
    </Cartao>
  )
}

function Informacao({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View className="gap-0.5">
      <Texto variante="legenda">{rotulo}</Texto>
      <Texto>{valor}</Texto>
    </View>
  )
}

function Informacoes({ evento }: { evento: EventoEmTela }) {
  const observacoes = ehDetalhe(evento) ? evento.observacoes : null
  return (
    <Cartao>
      <Informacao rotulo="Data e hora" valor={formatarDataHora(evento.inicio)} />
      <Informacao rotulo="Local" valor={evento.local} />
      <Informacao rotulo="Modalidade" valor={evento.modalidade.nome} />
      {observacoes && <Informacao rotulo="Observações" valor={observacoes} />}
    </Cartao>
  )
}

const capitaoPrimeiro = (a: Confirmado, b: Confirmado) =>
  Number(b.capitao) - Number(a.capitao) || porNome(a, b)

function QuemVai({ confirmados }: { confirmados: Confirmado[] }) {
  const { corPrimaria } = useAtletica()
  return (
    <View className="gap-2">
      <Texto variante="subtitulo">Quem vai</Texto>
      {confirmados.length === 0 ? (
        <Texto variante="legenda">{MENSAGEM_NINGUEM_CONFIRMOU}</Texto>
      ) : (
        [...confirmados].sort(capitaoPrimeiro).map((atleta) => (
          <CartaoLinha key={atleta.id} className="min-h-[44px]">
            <Imagem uri={atleta.fotoUrl} nome={atleta.nome} className="h-10 w-10 rounded-full" />
            <Texto testID="nome-confirmado" className="flex-1">
              {atleta.nome}
            </Texto>
            {atleta.capitao && (
              <View accessible accessibilityLabel="Capitão">
                <Selo texto="CAPITÃO" cor={corPrimaria} />
              </View>
            )}
          </CartaoLinha>
        ))
      )}
    </View>
  )
}

/** Seção com estado próprio: enquanto só há o card, o detalhe pode estar carregando ou offline. */
function Participacao({
  evento,
  aoTentarNovamente,
}: {
  evento: EventoEmTela
  aoTentarNovamente: () => Promise<unknown>
}) {
  const cancelado = evento.status === StatusEvento.CANCELADO
  const consulta = {
    data: ehDetalhe(evento) ? evento : undefined,
    isError: false,
    dataUpdatedAt: 0,
    refetch: aoTentarNovamente,
  }

  return (
    <TelaDados consulta={consulta} esqueleto="cartao" faixaOffline={false}>
      {(detalhe) => (
        <View className="gap-6">
          <View className="gap-2">
            <Texto variante="subtitulo">Participação</Texto>
            <Texto testID="contagem">{resumoContagem(detalhe.contagem)}</Texto>
            {!cancelado && (
              <View testID="slot-participacao">
                <ParticipacaoAcoes evento={detalhe} />
              </View>
            )}
          </View>
          <QuemVai confirmados={detalhe.confirmados} />
        </View>
      )}
    </TelaDados>
  )
}

type Props = {
  evento: EventoEmTela
  aoGerenciar: () => void
  aoTentarNovamente: () => Promise<unknown>
}

export function EventoDetalhe({ evento, aoGerenciar, aoTentarNovamente }: Props) {
  const vePainel = useVePainel()
  const cancelado = evento.status === StatusEvento.CANCELADO

  return (
    <View className="gap-6">
      <View className="gap-3">
        <Chips evento={evento} />
        <Texto
          variante="titulo"
          testID="titulo-evento"
          className={cancelado ? 'line-through' : undefined}
        >
          {tituloEvento(evento)}
        </Texto>
      </View>
      <CartaoPlacar evento={evento} />
      <Informacoes evento={evento} />
      <Participacao evento={evento} aoTentarNovamente={aoTentarNovamente} />
      {vePainel && <Botao titulo="Gerenciar" variante="secundaria" onPress={aoGerenciar} />}
    </View>
  )
}
