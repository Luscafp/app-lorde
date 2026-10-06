import Ionicons from '@expo/vector-icons/Ionicons'
import { Papel } from '@atletica/shared'
import { Link, type Href } from 'expo-router'
import type { ComponentProps } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { useTemNivelMinimo } from '@/infra/sessao/use-tem-nivel-minimo'

type Entrada = {
  titulo: string
  descricao: string
  icone: ComponentProps<typeof Ionicons>['name']
  href: Href
}

function ItemPainel({ titulo, descricao, icone, href }: Entrada) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={titulo}
        className="min-h-[44px] flex-row items-center gap-3 rounded-2xl border border-borda bg-cartao p-4"
      >
        <Ionicons name={icone} size={24} color={paleta.texto} />
        <View className="flex-1">
          <Texto className="font-semibold">{titulo}</Texto>
          <Texto variante="legenda">{descricao}</Texto>
        </View>
        <Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />
      </Pressable>
    </Link>
  )
}

// Demais entradas nas issues de diretoria (convenções §10.1).
export default function Painel() {
  const ehPresidencia = useTemNivelMinimo(Papel.PRESIDENTE)

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerClassName="gap-4 p-4">
      <Texto variante="titulo">Painel</Texto>
      <ItemPainel
        titulo="Times e modalidades"
        descricao="Times, adversários e modalidades"
        icone="trophy-outline"
        href="/painel/times"
      />
      {ehPresidencia && (
        <ItemPainel
          titulo="Usuários"
          descricao="Buscar, desativar e reativar contas"
          icone="people-circle-outline"
          href="/painel/usuarios"
        />
      )}
    </ScrollView>
  )
}
