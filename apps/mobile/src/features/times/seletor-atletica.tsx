import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native'
import { Botao, Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { useValorAtrasado } from '@/infra/use-valor-atrasado'
import { SheetAtleticaAdversaria } from './form-atletica-adversaria'
import { useAtleticasAdversarias } from './hooks'

const ATRASO_BUSCA_MS = 300

export type AtleticaEscolhida = { id: string; nome: string; sigla: string | null }

export const rotuloAtletica = ({ nome, sigla }: Omit<AtleticaEscolhida, 'id'>) =>
  sigla ? `${nome} (${sigla})` : nome

function Opcao({
  rotulo,
  marcada,
  desabilitada,
  aoEscolher,
}: {
  rotulo: string
  marcada: boolean
  desabilitada?: boolean
  aoEscolher: () => void
}) {
  const { corPrimaria } = useAtletica()
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={rotulo}
      accessibilityState={{ selected: marcada, disabled: !!desabilitada }}
      disabled={desabilitada}
      onPress={aoEscolher}
      className="min-h-[44px] flex-row items-center gap-2 rounded-xl border-2 bg-superficie px-3 py-2"
      style={{ borderColor: marcada ? corPrimaria : paleta.borda, opacity: desabilitada ? 0.5 : 1 }}
    >
      <Ionicons
        name={marcada ? 'radio-button-on' : 'radio-button-off'}
        size={18}
        color={marcada ? corPrimaria : paleta['texto-suave']}
      />
      <Texto className="flex-1">{rotulo}</Texto>
    </Pressable>
  )
}

function BuscaAdversaria({
  selecionada,
  aoSelecionar,
}: {
  selecionada: AtleticaEscolhida | null
  aoSelecionar: (atletica: AtleticaEscolhida) => void
}) {
  const [termo, setTermo] = useState('')
  const [cadastrando, setCadastrando] = useState(false)
  const busca = useValorAtrasado(termo.trim(), ATRASO_BUSCA_MS)
  const consulta = useAtleticasAdversarias(busca || undefined)
  const encontradas = juntarPaginas(consulta.data?.pages ?? [])
  const opcoes =
    selecionada && !encontradas.some(({ id }) => id === selecionada.id)
      ? [selecionada, ...encontradas]
      : encontradas

  return (
    <View className="gap-2">
      <TextInput
        value={termo}
        onChangeText={setTermo}
        accessibilityLabel="Buscar atlética adversária"
        placeholder="Buscar atlética adversária"
        placeholderTextColor={paleta['texto-suave']}
        autoCorrect={false}
        returnKeyType="search"
        className="min-h-[44px] rounded-xl border border-borda bg-superficie px-3 py-2 text-base text-texto"
      />
      {consulta.isPending && <ActivityIndicator color={paleta['texto-suave']} />}
      {consulta.isError && (
        <Texto variante="legenda">Não foi possível carregar as atléticas adversárias.</Texto>
      )}
      {consulta.isSuccess && opcoes.length === 0 && (
        <Texto variante="legenda">Nenhuma atlética adversária encontrada.</Texto>
      )}
      <View accessibilityRole="radiogroup" className="gap-2">
        {opcoes.map((atletica) => (
          <Opcao
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
  adversaria: boolean
  aoMudarTipo: (adversaria: boolean) => void
  selecionada: AtleticaEscolhida | null
  aoSelecionar: (atletica: AtleticaEscolhida) => void
  /** Na edição a atlética do time é imutável. */
  desabilitado?: boolean
  erro?: string
}

export function SeletorAtletica({
  adversaria,
  aoMudarTipo,
  selecionada,
  aoSelecionar,
  desabilitado,
  erro,
}: Props) {
  const propria = useAtletica()

  return (
    <View className="gap-2">
      <Texto variante="rotulo">Atlética</Texto>
      <View accessibilityRole="radiogroup" className="flex-row gap-2">
        <View className="flex-1">
          <Opcao
            rotulo={propria.sigla ?? propria.nome}
            marcada={!adversaria}
            desabilitada={desabilitado}
            aoEscolher={() => aoMudarTipo(false)}
          />
        </View>
        <View className="flex-1">
          <Opcao
            rotulo="Adversária"
            marcada={adversaria}
            desabilitada={desabilitado}
            aoEscolher={() => aoMudarTipo(true)}
          />
        </View>
      </View>
      {adversaria && desabilitado && selecionada && (
        <Texto variante="legenda">{rotuloAtletica(selecionada)}</Texto>
      )}
      {adversaria && !desabilitado && (
        <BuscaAdversaria selecionada={selecionada} aoSelecionar={aoSelecionar} />
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
