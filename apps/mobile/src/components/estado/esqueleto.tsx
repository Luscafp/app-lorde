import { useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'

export type VarianteEsqueleto = 'lista' | 'cartao' | 'detalhe' | 'cartoes' | 'cartoes-capa'

export type PropsEsqueleto = { variante?: VarianteEsqueleto; quantidade?: number }

const QUANTIDADE_PADRAO = { lista: 5, cartoes: 4, 'cartoes-capa': 2, cartao: 1, detalhe: 1 }

function Bloco({ brilho, className }: { brilho: Animated.Value; className: string }) {
  return (
    <Animated.View className={`rounded-lg bg-cartao ${className}`} style={{ opacity: brilho }} />
  )
}

function useBrilho() {
  const brilho = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    const animacao = Animated.loop(
      Animated.sequence([
        Animated.timing(brilho, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(brilho, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    )
    animacao.start()
    return () => animacao.stop()
  }, [brilho])
  return brilho
}

export function Esqueleto({ variante = 'lista', quantidade }: PropsEsqueleto) {
  const brilho = useBrilho()
  const itens = Array.from({ length: quantidade ?? QUANTIDADE_PADRAO[variante] }, (_, i) => i)

  return (
    <View
      accessible
      accessibilityLabel="Carregando"
      accessibilityState={{ busy: true }}
      testID={`esqueleto-${variante}`}
      className="flex-1 gap-3 p-4"
    >
      {variante === 'lista' &&
        itens.map((item) => (
          <View key={item} className="flex-row items-center gap-3">
            <Bloco brilho={brilho} className="h-12 w-12 rounded-full" />
            <View className="flex-1 gap-2">
              <Bloco brilho={brilho} className="h-4 w-3/4" />
              <Bloco brilho={brilho} className="h-3 w-1/2" />
            </View>
          </View>
        ))}
      {variante === 'cartoes' &&
        itens.map((item) => (
          <Bloco key={item} brilho={brilho} className="h-20 w-full rounded-2xl" />
        ))}
      {variante === 'cartoes-capa' &&
        itens.map((item) => (
          <View key={item} className="gap-2">
            <Bloco brilho={brilho} className="aspect-video w-full rounded-2xl" />
            <Bloco brilho={brilho} className="h-4 w-3/4" />
            <Bloco brilho={brilho} className="h-3 w-1/3" />
          </View>
        ))}
      {variante === 'cartao' && <Bloco brilho={brilho} className="h-40 w-full rounded-2xl" />}
      {variante === 'detalhe' && (
        <>
          <Bloco brilho={brilho} className="h-48 w-full rounded-2xl" />
          <Bloco brilho={brilho} className="h-6 w-2/3" />
          <Bloco brilho={brilho} className="h-4 w-full" />
          <Bloco brilho={brilho} className="h-4 w-full" />
          <Bloco brilho={brilho} className="h-4 w-1/2" />
        </>
      )}
    </View>
  )
}
