import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { useState, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { corTextoSobre, paleta, useAtletica } from '@/features/atletica'

export const TRANSICAO_IMAGEM_MS = 150

type Props = {
  uri: string | null | undefined
  /** Fallback de perfil: sem imagem ou com erro, mostra as iniciais deste nome. */
  nome?: string
  /** Texto do fallback no lugar das iniciais (ex.: sigla da atlética). */
  textoFallback?: string | null
  rotulo?: string
  className?: string
  /** Substitui o fallback padrão (iniciais ou ícone neutro). */
  fallback?: ReactNode
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : ''
  return (primeira + ultima).toLocaleUpperCase('pt-BR')
}

function IconeNeutro({ testID }: { testID: string }) {
  return (
    <View testID={testID} style={StyleSheet.absoluteFill} className="items-center justify-center">
      <Ionicons name="image-outline" size={28} color={paleta['texto-suave']} />
    </View>
  )
}

function Fallback({ texto }: { texto: string }) {
  const { corPrimaria } = useAtletica()
  if (!texto) return <IconeNeutro testID="imagem-fallback" />
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
export function Imagem({ uri, nome, textoFallback, rotulo, className, fallback }: Props) {
  const [uriComErro, setUriComErro] = useState<string | null>(null)
  const exibir = uri && uri !== uriComErro

  return (
    <View
      accessible={Boolean(rotulo)}
      accessibilityRole={rotulo ? 'image' : undefined}
      accessibilityLabel={rotulo}
      className={`overflow-hidden bg-cartao ${className ?? ''}`}
    >
      {exibir ? (
        <>
          <IconeNeutro testID="imagem-placeholder" />
          <Image
            testID="imagem"
            source={{ uri }}
            cachePolicy="memory-disk"
            transition={TRANSICAO_IMAGEM_MS}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
            onError={() => setUriComErro(uri)}
          />
        </>
      ) : (
        (fallback ?? <Fallback texto={textoFallback ?? (nome ? iniciais(nome) : '')} />)
      )}
    </View>
  )
}
