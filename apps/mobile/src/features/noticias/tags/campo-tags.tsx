import {
  MENSAGEM_MAXIMO_TAGS,
  nomeTagSchema,
  normalizarNomeTag,
  TAGS_POR_NOTICIA_MAX,
} from '@atletica/shared'
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { ErroCampo, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { useValorAtrasado } from '@/infra/use-valor-atrasado'
import { ChipTag } from './chip-tag'
import { useTags } from './consultas'

const ATRASO_BUSCA_MS = 300
const SUGESTOES_MAX = 5

type Props = {
  valor: string[]
  aoMudar: (tags: string[]) => void
  erro?: string
  desabilitado?: boolean
}

function Sugestao({ rotulo, aoPressionar }: { rotulo: string; aoPressionar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={aoPressionar}
      className="min-h-[44px] justify-center px-3 active:opacity-70"
    >
      <Text className="text-base text-texto">{rotulo}</Text>
    </Pressable>
  )
}

/** Controlado pelo formulário; as tags novas são criadas pela API ao salvar a notícia. */
export function CampoTags({ valor, aoMudar, erro, desabilitado = false }: Props) {
  const [texto, setTexto] = useState('')
  const [erroLocal, setErroLocal] = useState<string>()
  const busca = useValorAtrasado(texto.trim(), ATRASO_BUSCA_MS)
  const { data: encontradas = [] } = useTags(
    { emUso: false, q: busca },
    { enabled: busca.length > 0 },
  )

  const escolhidas = new Set(valor.map(normalizarNomeTag))
  const lotado = valor.length >= TAGS_POR_NOTICIA_MAX
  const termo = texto.trim()
  const sugestoes = termo
    ? encontradas
        .filter(({ nome }) => !escolhidas.has(normalizarNomeTag(nome)))
        .slice(0, SUGESTOES_MAX)
    : []
  const existe = sugestoes.some(({ nome }) => normalizarNomeTag(nome) === normalizarNomeTag(termo))

  function adicionar(nome: string) {
    if (lotado) return setErroLocal(MENSAGEM_MAXIMO_TAGS)
    const resultado = nomeTagSchema.safeParse(nome)
    if (!resultado.success) return setErroLocal(resultado.error.issues[0]?.message)
    setErroLocal(undefined)
    setTexto('')
    if (!escolhidas.has(normalizarNomeTag(resultado.data))) aoMudar([...valor, resultado.data])
  }

  function remover(nome: string) {
    setErroLocal(undefined)
    aoMudar(valor.filter((tag) => tag !== nome))
  }

  return (
    <View className="gap-2">
      <Texto variante="rotulo">Tags</Texto>
      {valor.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {valor.map((nome) => (
            <ChipTag
              key={nome}
              nome={nome}
              aoRemover={() => remover(nome)}
              desabilitado={desabilitado}
            />
          ))}
        </View>
      )}
      <TextInput
        value={texto}
        onChangeText={(novo) => {
          setTexto(novo)
          setErroLocal(undefined)
        }}
        onSubmitEditing={() => termo && adicionar(termo)}
        submitBehavior="submit"
        editable={!desabilitado}
        accessibilityLabel="Adicionar tag"
        placeholder={lotado ? MENSAGEM_MAXIMO_TAGS : 'Adicionar tag'}
        placeholderTextColor={paleta['texto-suave']}
        autoCorrect={false}
        returnKeyType="done"
        className={`min-h-[44px] rounded-xl border bg-superficie px-3 py-2 text-base text-texto ${
          erroLocal || erro ? 'border-erro' : 'border-borda'
        }`}
      />
      {termo.length > 0 && (
        <View className="overflow-hidden rounded-xl border border-borda bg-cartao">
          {sugestoes.map(({ id, nome }) => (
            <Sugestao key={id} rotulo={nome} aoPressionar={() => adicionar(nome)} />
          ))}
          {!existe && (
            <Sugestao rotulo={`Adicionar '${termo}'`} aoPressionar={() => adicionar(termo)} />
          )}
        </View>
      )}
      <ErroCampo mensagem={erroLocal ?? erro} />
    </View>
  )
}
