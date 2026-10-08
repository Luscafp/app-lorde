import type { BannerDto } from '@atletica/shared'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useRef, useState } from 'react'
import {
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { paleta, useAtletica } from '@/features/atletica'
import { Imagem } from '@/components/imagem'
import { useBanners } from './hooks'

export const INTERVALO_CARROSSEL_MS = 5000
/** Padding horizontal da Home (`p-4`). */
const MARGEM_HOME = 32

function Slide({ banner, largura }: { banner: BannerDto; largura: number }) {
  const conteudo = (
    <>
      <Imagem uri={banner.imagemUrl} className="h-full w-full" />
      <View className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-2">
        <Text className="font-semibold text-white" numberOfLines={2}>
          {banner.titulo}
        </Text>
      </View>
    </>
  )
  const estilo = { width: largura, height: (largura * 9) / 16 }
  const { link } = banner
  if (!link) {
    return (
      <View
        testID={`banner-${banner.id}`}
        accessible
        accessibilityLabel={banner.titulo}
        className="overflow-hidden rounded-2xl"
        style={estilo}
      >
        {conteudo}
      </View>
    )
  }
  return (
    <Pressable
      testID={`banner-${banner.id}`}
      accessibilityRole="link"
      accessibilityLabel={banner.titulo}
      accessibilityHint="Abre no navegador"
      onPress={() => void WebBrowser.openBrowserAsync(link)}
      className="overflow-hidden rounded-2xl active:opacity-90"
      style={estilo}
    >
      {conteudo}
    </Pressable>
  )
}

function Indicadores({ total, atual }: { total: number; atual: number }) {
  const { corPrimaria } = useAtletica()
  return (
    <View
      className="flex-row justify-center gap-2"
      accessibilityLabel={`Banner ${atual + 1} de ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          testID="indicador-banner"
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: i === atual ? corPrimaria : paleta.borda }}
        />
      ))}
    </View>
  )
}

/** Topo da Home (UC01 passos 2 e 5); sem banner ativo, não ocupa espaço. */
export function CarrosselBanners() {
  const { data: banners = [] } = useBanners()
  const largura = useWindowDimensions().width - MARGEM_HOME
  const lista = useRef<FlatList<BannerDto>>(null)
  const [atual, setAtual] = useState(0)
  const [arrastando, setArrastando] = useState(false)
  const total = banners.length

  useEffect(() => {
    if (total < 2 || arrastando) return
    const intervalo = setInterval(() => {
      setAtual((anterior) => {
        const proximo = (anterior + 1) % total
        lista.current?.scrollToOffset({ offset: proximo * largura, animated: true })
        return proximo
      })
    }, INTERVALO_CARROSSEL_MS)
    return () => clearInterval(intervalo)
  }, [total, arrastando, largura])

  if (total === 0) return null

  const aoParar = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    setAtual(Math.min(total - 1, Math.max(0, Math.round(nativeEvent.contentOffset.x / largura))))
    setArrastando(false)
  }

  return (
    <View className="gap-2" testID="carrossel-banners">
      <FlatList
        ref={lista}
        data={banners}
        keyExtractor={({ id }) => id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, indice) => ({
          length: largura,
          offset: largura * indice,
          index: indice,
        })}
        onScrollBeginDrag={() => setArrastando(true)}
        onMomentumScrollEnd={aoParar}
        renderItem={({ item }) => <Slide banner={item} largura={largura} />}
      />
      {total > 1 && <Indicadores total={total} atual={atual} />}
    </View>
  )
}
