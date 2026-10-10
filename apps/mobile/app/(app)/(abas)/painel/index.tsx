import Ionicons from '@expo/vector-icons/Ionicons'
import { Papel } from '@atletica/shared'
import { Link, type Href } from 'expo-router'
import type { ComponentProps } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Selo, Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { useTotalPendentes } from '@/features/solicitacoes'
import { useTemNivelMinimo } from '@/infra/sessao/use-tem-nivel-minimo'

type Entrada = {
  titulo: string
  descricao: string
  icone: ComponentProps<typeof Ionicons>['name']
  href: Href
  /** Itens aguardando ação; zero não aparece. */
  indicador?: number
}

function ItemPainel({ titulo, descricao, icone, href, indicador }: Entrada) {
  const { corPrimaria } = useAtletica()
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={indicador ? `${titulo}, ${indicador} pendentes` : titulo}
        className="min-h-[44px] flex-row items-center gap-3 rounded-2xl border border-borda bg-cartao p-4"
      >
        <Ionicons name={icone} size={24} color={paleta.texto} />
        <View className="flex-1">
          <Texto className="font-semibold">{titulo}</Texto>
          <Texto variante="legenda">{descricao}</Texto>
        </View>
        {!!indicador && <Selo texto={String(indicador)} cor={corPrimaria} />}
        <Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />
      </Pressable>
    </Link>
  )
}

// Demais entradas nas issues de diretoria (convenções §10.1).
export default function Painel() {
  const ehPresidencia = useTemNivelMinimo(Papel.PRESIDENTE)
  const { data: pendentes } = useTotalPendentes()

  return (
    <ScrollView className="flex-1 bg-fundo" contentContainerClassName="gap-4 p-4">
      <Texto variante="titulo">Painel</Texto>
      <ItemPainel
        titulo="Eventos"
        descricao="Jogos e treinos: cadastrar, editar e cancelar"
        icone="calendar-outline"
        href="/painel/eventos"
      />
      <ItemPainel
        titulo="Notícias"
        descricao="Criar, publicar e despublicar notícias"
        icone="newspaper-outline"
        href="/painel/noticias"
      />
      <ItemPainel
        titulo="Banners"
        descricao="Carrossel da Home: cadastrar, ordenar e desativar"
        icone="images-outline"
        href="/painel/banners"
      />
      <ItemPainel
        titulo="Solicitações"
        descricao="Aceitar ou rejeitar entradas nos times"
        icone="person-add-outline"
        href="/painel/solicitacoes"
        indicador={pendentes}
      />
      <ItemPainel
        titulo="Enviar aviso"
        descricao="Notificação para todos ou para um time"
        icone="megaphone-outline"
        href="/painel/avisos/novo"
      />
      <ItemPainel
        titulo="Times e modalidades"
        descricao="Times, adversários e modalidades"
        icone="trophy-outline"
        href="/painel/times"
      />
      {ehPresidencia && (
        <>
          <ItemPainel
            titulo="Usuários"
            descricao="Buscar, desativar e reativar contas"
            icone="people-circle-outline"
            href="/painel/usuarios"
          />
          <ItemPainel
            titulo="Auditoria"
            descricao="Histórico de alterações no sistema"
            icone="document-text-outline"
            href="/painel/auditoria"
          />
        </>
      )}
    </ScrollView>
  )
}
