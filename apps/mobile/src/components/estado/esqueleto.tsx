import { useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'

export type VarianteEsqueleto = 'lista' | 'cartao' | 'detalhe'

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

export function Esqueleto({ variante = 'lista' }: { variante?: VarianteEsqueleto }) {
  const brilho = useBrilho()

  return (
    <View
      accessible
      accessibilityLabel="Carregando"
      accessibilityState={{ busy: true }}
      className="flex-1 gap-3 p-4"
    >
      {variante === 'lista' &&
        [0, 1, 2, 3, 4].map((item) => (
          <View key={item} className="flex-row items-center gap-3">
            <Bloco brilho={brilho} className="h-12 w-12 rounded-full" />
            <View className="flex-1 gap-2">
              <Bloco brilho={brilho} className="h-4 w-3/4" />
              <Bloco brilho={brilho} className="h-3 w-1/2" />
            </View>
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
