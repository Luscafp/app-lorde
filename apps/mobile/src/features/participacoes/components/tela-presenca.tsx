import {
  aceitaPresenca,
  formatarDataHora,
  RespostaPresenca,
  type EventoDto,
  type ItemPresenca,
  type ListaPresencaDto,
} from '@atletica/shared'
import { useMemo, useState } from 'react'
import { FlatList, View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { Imagem } from '@/components/imagem'
import { AvisoOffline, Botao, CaixaSelecao, Selo, Texto, toast } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { ROTULO_TIPO, STATUS, tituloEvento, useEventoPainel } from '@/features/eventos'
import { useAvisoAlteracoes } from '@/infra/navegacao/use-aviso-alteracoes'
import { usePresencas, useRegistrarPresencas } from '../hooks'

export const MENSAGEM_PRESENCA_BLOQUEADA =
  'A presença só pode ser registrada em eventos em andamento ou finalizados.'
export const MENSAGEM_ELENCO_VAZIO = 'O time não tinha atletas no elenco no início do evento.'

const RESPOSTA: Record<RespostaPresenca, { rotulo: string; cor: string }> = {
  [RespostaPresenca.CONFIRMOU]: { rotulo: 'Confirmou', cor: paleta.sucesso },
  [RespostaPresenca.RECUSOU]: { rotulo: 'Recusou', cor: paleta.erro },
  [RespostaPresenca.SEM_RESPOSTA]: { rotulo: 'Sem resposta', cor: paleta['texto-suave'] },
}

function presentesDe(itens: readonly ItemPresenca[]): Set<string> {
  return new Set(itens.filter(({ presente }) => presente).map(({ usuarioId }) => usuarioId))
}

function mesmoConjunto(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id))
}

function Cabecalho({ evento }: { evento: EventoDto }) {
  const status = STATUS[evento.status]
  return (
    <View className="gap-2">
      <Texto variante="titulo">{tituloEvento(evento)}</Texto>
      <View className="flex-row gap-2">
        <Selo texto={ROTULO_TIPO[evento.tipo]} />
        <Selo texto={status.rotulo} cor={status.cor} />
      </View>
      <Texto variante="legenda">{`${evento.time.nome} · ${formatarDataHora(evento.inicio)}`}</Texto>
    </View>
  )
}

type PropsItem = {
  item: ItemPresenca
  marcado: boolean
  aoAlternar: (usuarioId: string, marcado: boolean) => void
}

function LinhaPresenca({ item, marcado, aoAlternar }: PropsItem) {
  const resposta = RESPOSTA[item.resposta]
  return (
    <CaixaSelecao
      marcada={marcado}
      rotulo={item.nome}
      aoAlternar={(valor) => aoAlternar(item.usuarioId, valor)}
    >
      <View className="flex-row items-center gap-3">
        <Imagem uri={item.fotoUrl} nome={item.nome} className="h-10 w-10 rounded-full" />
        <View className="flex-1 gap-1">
          <Texto className="font-semibold">{item.nome}</Texto>
          <View className="flex-row">
            <Selo texto={resposta.rotulo} cor={resposta.cor} />
          </View>
        </View>
      </View>
    </CaixaSelecao>
  )
}

type PropsLista = {
  lista: ListaPresencaDto
  evento: EventoDto | undefined
  aoSalvar: () => void
}

/** Sem chamada registrada, salvar a lista pré-preenchida já é uma alteração. */
function ListaPresenca({ lista, evento, aoSalvar }: PropsLista) {
  const registrar = useRegistrarPresencas(lista.eventoId)
  const inicial = useMemo(() => presentesDe(lista.itens), [lista])
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(inicial)
  const alterado = !mesmoConjunto(marcados, inicial)
  const liberarSaida = useAvisoAlteracoes(alterado)
  const podeSalvar = (alterado || !lista.registrada) && registrar.online

  const alternar = (usuarioId: string, marcado: boolean) =>
    setMarcados((atual) => {
      const proximo = new Set(atual)
      if (marcado) proximo.add(usuarioId)
      else proximo.delete(usuarioId)
      return proximo
    })

  const salvar = () =>
    registrar.mutate([...marcados], {
      onSuccess: () => {
        toast.sucesso('Presenças salvas')
        liberarSaida()
        aoSalvar()
      },
    })

  const todos = lista.itens.map(({ usuarioId }) => usuarioId)

  return (
    <View className="flex-1">
      <FlatList
        data={lista.itens}
        keyExtractor={({ usuarioId }) => usuarioId}
        extraData={marcados}
        contentContainerClassName="gap-2 p-4"
        ListHeaderComponent={
          <View className="gap-4 pb-2">
            {evento && <Cabecalho evento={evento} />}
            <View className="flex-row gap-2">
              <Botao
                titulo="Marcar todos"
                variante="secundaria"
                className="flex-1"
                onPress={() => setMarcados(new Set(todos))}
              />
              <Botao
                titulo="Desmarcar todos"
                variante="secundaria"
                className="flex-1"
                onPress={() => setMarcados(new Set())}
              />
            </View>
          </View>
        }
        ListEmptyComponent={<EstadoVazio mensagem={MENSAGEM_ELENCO_VAZIO} />}
        renderItem={({ item }) => (
          <LinhaPresenca item={item} marcado={marcados.has(item.usuarioId)} aoAlternar={alternar} />
        )}
      />
      <View className="gap-2 border-t border-borda bg-superficie p-4">
        <AvisoOffline online={registrar.online} />
        <Texto className="text-center" accessibilityLiveRegion="polite">
          {`${marcados.size} de ${lista.itens.length} presentes`}
        </Texto>
        <Botao
          titulo="Salvar presenças"
          carregando={registrar.isPending}
          disabled={!podeSalvar}
          onPress={salvar}
        />
      </View>
    </View>
  )
}

type Props = {
  eventoId: string
  aoSalvar: () => void
}

/** UC18: a chave por `registradaEm` reinicia as marcações só quando uma nova chamada é salva. */
export function TelaPresenca({ eventoId, aoSalvar }: Props) {
  const consulta = usePresencas(eventoId)
  const { data: evento } = useEventoPainel(eventoId)

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="lista">
        {(lista) =>
          aceitaPresenca(lista.status) ? (
            <ListaPresenca
              key={lista.registradaEm ?? 'sem-registro'}
              lista={lista}
              evento={evento}
              aoSalvar={aoSalvar}
            />
          ) : (
            <EstadoVazio mensagem={MENSAGEM_PRESENCA_BLOQUEADA} />
          )
        }
      </TelaDados>
    </View>
  )
}
