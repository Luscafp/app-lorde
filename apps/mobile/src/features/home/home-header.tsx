import { Pressable, Text, View } from 'react-native'
import { Imagem, iniciais } from '@/components/imagem'
import { Texto } from '@/components/ui'
import { corTextoSobre, useAtletica } from '@/features/atletica'
import { useSessao } from '@/infra/sessao/store'

function LogoAtletica() {
  const { nome, sigla, logoUrl, corPrimaria } = useAtletica()
  return (
    <Imagem
      uri={logoUrl}
      rotulo={`Logo da ${nome}`}
      className="h-12 w-12 rounded-xl"
      fallback={
        <View
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: corPrimaria }}
        >
          <Text className="font-semibold" style={{ color: corTextoSobre(corPrimaria) }}>
            {sigla ?? iniciais(nome)}
          </Text>
        </View>
      }
    />
  )
}

export function HomeHeader({ aoAbrirPerfil }: { aoAbrirPerfil: () => void }) {
  const { nome } = useAtletica()
  const usuario = useSessao((estado) => estado.usuario)
  const primeiroNome = usuario?.nome.trim().split(/\s+/)[0]

  return (
    <View className="flex-row items-center gap-3">
      <LogoAtletica />
      <View className="flex-1">
        {primeiroNome && <Texto variante="legenda">{`Olá, ${primeiroNome}`}</Texto>}
        <Texto variante="titulo" numberOfLines={1}>
          {nome}
        </Texto>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir perfil"
        onPress={aoAbrirPerfil}
      >
        <Imagem uri={usuario?.fotoUrl} nome={usuario?.nome} className="h-11 w-11 rounded-full" />
      </Pressable>
    </View>
  )
}
