import { EscopoTimes, type EventoDto, type TimeDto } from '@atletica/shared'
import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Botao, CampoBusca, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { OpcaoRadio, useTimes } from '@/features/times'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { useValorAtrasado } from '@/infra/use-valor-atrasado'
import { rotuloAdversario } from '../formatacao'
import { AdversarioRapidoSheet } from './adversario-rapido-sheet'

type Adversario = NonNullable<EventoDto['timeAdversario']>

const ATRASO_BUSCA_MS = 300

const paraAdversario = ({ id, nome, atletica }: TimeDto): Adversario => ({
  id,
  nome,
  atletica: { id: atletica.id, nome: atletica.nome, sigla: atletica.sigla },
})

function ListaAdversarios({
  modalidadeId,
  selecionado,
  aoEscolher,
}: {
  modalidadeId: string
  selecionado: Adversario | null
  aoEscolher: (adversario: Adversario) => void
}) {
  const [termo, setTermo] = useState('')
  const q = useValorAtrasado(termo.trim(), ATRASO_BUSCA_MS) || undefined
  const consulta = useTimes({ escopo: EscopoTimes.ADVERSARIOS, modalidadeId, q })
  const encontrados = juntarPaginas(consulta.data?.pages ?? []).map(paraAdversario)
  const opcoes =
    selecionado && !encontrados.some(({ id }) => id === selecionado.id)
      ? [selecionado, ...encontrados]
      : encontrados

  return (
    <View className="gap-2">
      <CampoBusca rotulo="Buscar adversário" valor={termo} aoMudar={setTermo} />
      {consulta.isPending && <ActivityIndicator color={paleta['texto-suave']} />}
      {consulta.isError && (
        <Texto variante="legenda">Não foi possível carregar os adversários.</Texto>
      )}
      {consulta.isSuccess && opcoes.length === 0 && (
        <Texto variante="legenda">Nenhum adversário desta modalidade.</Texto>
      )}
      <View accessibilityRole="radiogroup" className="gap-2">
        {opcoes.map((adversario) => (
          <OpcaoRadio
            key={adversario.id}
            rotulo={rotuloAdversario(adversario)}
            marcada={adversario.id === selecionado?.id}
            aoEscolher={() => aoEscolher(adversario)}
          />
        ))}
      </View>
      {consulta.hasNextPage && (
        <Botao
          titulo="Carregar mais"
          variante="secundaria"
          carregando={consulta.isFetchingNextPage}
          onPress={() => void consulta.fetchNextPage()}
        />
      )}
    </View>
  )
}

type Props = {
  valor: string | null
  aoMudar: (id: string | null) => void
  /** Do time da atlética escolhido; sem ela não há o que listar. */
  modalidade?: EventoDto['modalidade']
  /** Adversário do evento em edição, para exibir o nome. */
  inicial?: Adversario | null
  desabilitado?: boolean
  erro?: string
}

export function SeletorAdversario({
  valor,
  aoMudar,
  modalidade,
  inicial,
  desabilitado,
  erro,
}: Props) {
  const [escolhido, setEscolhido] = useState<Adversario | null>(inicial ?? null)
  const [cadastrando, setCadastrando] = useState(false)
  const selecionado = escolhido?.id === valor ? escolhido : null

  function escolher(adversario: Adversario) {
    setEscolhido(adversario)
    aoMudar(adversario.id)
  }

  return (
    <View className="gap-2">
      <Texto variante="rotulo">Adversário</Texto>
      {desabilitado && selecionado && (
        <Texto variante="legenda">{rotuloAdversario(selecionado)}</Texto>
      )}
      {!desabilitado && !modalidade && (
        <Texto variante="legenda">Escolha o time da atlética para ver os adversários.</Texto>
      )}
      {!desabilitado && modalidade && (
        <>
          <ListaAdversarios
            modalidadeId={modalidade.id}
            selecionado={selecionado}
            aoEscolher={escolher}
          />
          <Botao
            titulo="+ Cadastrar adversário"
            variante="secundaria"
            onPress={() => setCadastrando(true)}
          />
        </>
      )}
      {erro && (
        <Texto variante="erro" accessibilityLiveRegion="polite">
          {erro}
        </Texto>
      )}
      {cadastrando && modalidade && (
        <AdversarioRapidoSheet
          modalidade={modalidade}
          aoFechar={() => setCadastrando(false)}
          aoCriar={(time) => {
            setCadastrando(false)
            escolher(paraAdversario(time))
          }}
        />
      )}
    </View>
  )
}
