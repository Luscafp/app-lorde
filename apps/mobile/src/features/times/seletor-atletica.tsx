import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Botao, CampoBusca, Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { SheetAtleticaAdversaria } from './form-atletica-adversaria'
import { rotuloAtletica } from './formatacao'
import { useBuscaAdversarias } from './hooks'
import { OpcaoRadio } from './opcao-radio'

export type AtleticaEscolhida = { id: string; nome: string; sigla: string | null }

function BuscaAdversaria({
  selecionada,
  aoSelecionar,
}: {
  selecionada: AtleticaEscolhida | null
  aoSelecionar: (atletica: AtleticaEscolhida) => void
}) {
  const [cadastrando, setCadastrando] = useState(false)
  const { termo, setTermo, consulta } = useBuscaAdversarias()
  const encontradas = juntarPaginas(consulta.data?.pages ?? [])
  const opcoes =
    selecionada && !encontradas.some(({ id }) => id === selecionada.id)
      ? [selecionada, ...encontradas]
      : encontradas

  return (
    <View className="gap-2">
      <CampoBusca rotulo="Buscar atlética adversária" valor={termo} aoMudar={setTermo} />
      {consulta.isPending && <ActivityIndicator color={paleta['texto-suave']} />}
      {consulta.isError && (
        <Texto variante="legenda">Não foi possível carregar as atléticas adversárias.</Texto>
      )}
      {consulta.isSuccess && opcoes.length === 0 && (
        <Texto variante="legenda">Nenhuma atlética adversária encontrada.</Texto>
      )}
      <View accessibilityRole="radiogroup" className="gap-2">
        {opcoes.map((atletica) => (
          <OpcaoRadio
            key={atletica.id}
            rotulo={rotuloAtletica(atletica)}
            marcada={atletica.id === selecionada?.id}
            aoEscolher={() => aoSelecionar(atletica)}
          />
        ))}
      </View>
      <Botao
        titulo="Cadastrar nova atlética"
        variante="secundaria"
        onPress={() => setCadastrando(true)}
      />
      {cadastrando && (
        <SheetAtleticaAdversaria
          aoFechar={() => setCadastrando(false)}
          aoSalvar={(nova) => {
            setCadastrando(false)
            aoSelecionar(nova)
          }}
        />
      )}
    </View>
  )
}

type Props = {
  /** `null`: atlética própria; vazio: adversária ainda não escolhida. */
  valor: string | null | undefined
  aoMudar: (id: string | null) => void
  /** Adversária do time em edição, para exibir o nome. */
  inicial?: AtleticaEscolhida
  /** Na edição a atlética do time é imutável. */
  desabilitado?: boolean
  erro?: string
}

export function SeletorAtletica({ valor, aoMudar, inicial, desabilitado, erro }: Props) {
  const propria = useAtletica()
  const [escolhida, setEscolhida] = useState<AtleticaEscolhida | null>(inicial ?? null)
  const adversaria = valor !== null
  const selecionada = escolhida?.id === valor ? escolhida : null

  function selecionar(atletica: AtleticaEscolhida) {
    setEscolhida(atletica)
    aoMudar(atletica.id)
  }

  return (
    <View className="gap-2">
      <Texto variante="rotulo">Atlética</Texto>
      <View accessibilityRole="radiogroup" className="flex-row gap-2">
        <View className="flex-1">
          <OpcaoRadio
            rotulo={propria.sigla ?? propria.nome}
            marcada={!adversaria}
            desabilitada={desabilitado}
            aoEscolher={() => aoMudar(null)}
          />
        </View>
        <View className="flex-1">
          <OpcaoRadio
            rotulo="Adversária"
            marcada={adversaria}
            desabilitada={desabilitado}
            aoEscolher={() => {
              if (!adversaria) aoMudar(escolhida?.id ?? '')
            }}
          />
        </View>
      </View>
      {adversaria && desabilitado && selecionada && (
        <Texto variante="legenda">{rotuloAtletica(selecionada)}</Texto>
      )}
      {adversaria && !desabilitado && (
        <BuscaAdversaria selecionada={selecionada} aoSelecionar={selecionar} />
      )}
      {desabilitado && <Texto variante="legenda">A atlética do time não pode ser alterada.</Texto>}
      {erro && (
        <Texto variante="erro" accessibilityLiveRegion="polite">
          {erro}
        </Texto>
      )}
    </View>
  )
}
