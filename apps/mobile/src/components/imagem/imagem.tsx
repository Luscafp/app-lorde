import Ionicons from '@expo/vector-icons/Ionicons'
import { Image, type ImageContentFit } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { corTextoSobre, paleta, useAtletica } from '@/features/atletica'

export const TRANSICAO_IMAGEM_MS = 150

type Props = {
  uri: string | null | undefined
  /** Fallback de perfil: sem imagem ou com erro, mostra as iniciais deste nome. */
  nome?: string
  rotulo?: string
  contentFit?: ImageContentFit
  className?: string
  style?: StyleProp<ViewStyle>
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : ''
  return (primeira + ultima).toLocaleUpperCase('pt-BR')
}

function Fallback({ nome }: { nome?: string }) {
  const { corPrimaria } = useAtletica()
  const texto = nome ? iniciais(nome) : ''
  if (!texto) {
    return (
      <View
        testID="imagem-fallback"
        style={StyleSheet.absoluteFill}
        className="items-center justify-center"
      >
        <Ionicons name="image-outline" size={28} color={paleta['texto-suave']} />
      </View>
    )
  }
  return (
    <View
      testID="imagem-fallback"
      style={[StyleSheet.absoluteFill, { backgroundColor: corPrimaria }]}
      className="items-center justify-center"
    >
      <Text className="text-lg font-semibold" style={{ color: corTextoSobre(corPrimaria) }}>
        {texto}
      </Text>
    </View>
  )
}

/** Toda imagem remota do app passa por aqui (convenções §10.8): cache em memória e disco. */
export function Imagem({ uri, nome, rotulo, contentFit = 'cover', className, style }: Props) {
  const [uriComErro, setUriComErro] = useState<string | null>(null)
  const exibir = uri && uri !== uriComErro

  return (
    <View
      accessible={Boolean(rotulo)}
      accessibilityRole={rotulo ? 'image' : undefined}
      accessibilityLabel={rotulo}
      className={`overflow-hidden bg-cartao ${className ?? ''}`}
      style={style}
    >
      {exibir ? (
        <Image
          testID="imagem"
          source={{ uri }}
          cachePolicy="memory-disk"
          transition={TRANSICAO_IMAGEM_MS}
          contentFit={contentFit}
          style={StyleSheet.absoluteFill}
          onError={() => setUriComErro(uri)}
        />
      ) : (
        <Fallback nome={nome} />
      )}
    </View>
  )
}
