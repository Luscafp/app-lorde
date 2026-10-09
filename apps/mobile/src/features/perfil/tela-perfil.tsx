import Ionicons from '@expo/vector-icons/Ionicons'
import { ROTULO_PAPEL, type Perfil, type TimeDoPerfil } from '@atletica/shared'
import { Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Imagem } from '@/components/imagem'
import { Botao, Cartao, Selo, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { SecaoMeusProximosEventos } from '@/features/participacoes'
import { BotaoSairDoTime } from '@/features/times'
import { useMe } from './consultas'

export const MENSAGEM_SEM_TIMES = 'Você ainda não faz parte de nenhum time.'

type Navegacao = {
  aoAbrirConfiguracoes: () => void
  aoAbrirTime: (id: string) => void
  aoAbrirEvento: (id: string) => void
  aoConhecerTimes: () => void
}

function ItemTimeInativo({ time }: { time: TimeDoPerfil }) {
  return (
    <Cartao className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Texto className="font-semibold">{time.nome}</Texto>
          <Texto variante="legenda">{time.modalidade.nome}</Texto>
        </View>
        <Selo texto="Inativo" />
      </View>
      <BotaoSairDoTime time={time} souCapitao={time.capitao} />
    </Cartao>
  )
}

function ItemTime({ time, aoAbrir }: { time: TimeDoPerfil; aoAbrir: (id: string) => void }) {
  if (!time.ativo) return <ItemTimeInativo time={time} />
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${time.nome}, ${time.modalidade.nome}${time.capitao ? ', capitão' : ''}`}
      onPress={() => aoAbrir(time.id)}
    >
      <Cartao className="min-h-[44px] flex-row items-center gap-3">
        <View className="flex-1">
          <Texto className="font-semibold">{time.nome}</Texto>
          <Texto variante="legenda">{time.modalidade.nome}</Texto>
        </View>
        {time.capitao && <Selo texto="Capitão" />}
        <Ionicons name="chevron-forward" size={20} color={paleta['texto-suave']} />
      </Cartao>
    </Pressable>
  )
}

function MeusTimes({ times, aoAbrirTime, aoConhecerTimes }: { times: TimeDoPerfil[] } & Navegacao) {
  return (
    <View className="gap-2">
      <Texto variante="subtitulo">Meus times</Texto>
      {times.length === 0 ? (
        <Cartao>
          <Texto>{MENSAGEM_SEM_TIMES}</Texto>
          <Botao titulo="Conhecer os times" variante="secundaria" onPress={aoConhecerTimes} />
        </Cartao>
      ) : (
        times.map((time) => <ItemTime key={time.id} time={time} aoAbrir={aoAbrirTime} />)
      )}
    </View>
  )
}

function Conteudo({
  perfil,
  atualizando,
  aoAtualizar,
  ...navegacao
}: { perfil: Perfil; atualizando: boolean; aoAtualizar: () => void } & Navegacao) {
  return (
    <ScrollView
      contentContainerClassName="gap-6 p-4"
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} />}
    >
      <View className="items-center gap-2">
        <Imagem
          uri={perfil.fotoUrl}
          nome={perfil.nome}
          rotulo={`Foto de ${perfil.nome}`}
          className="h-28 w-28 rounded-full"
        />
        <Texto variante="subtitulo" className="text-center">
          {perfil.nome}
        </Texto>
        <Texto variante="legenda">{perfil.email}</Texto>
        <Selo texto={ROTULO_PAPEL[perfil.papel]} />
      </View>
      <MeusTimes times={perfil.times} {...navegacao} />
      <SecaoMeusProximosEventos aoAbrirEvento={navegacao.aoAbrirEvento} />
    </ScrollView>
  )
}

/** Estatísticas (#85) entram como seção desta tela. */
export function TelaPerfil(navegacao: Navegacao) {
  const consulta = useMe()

  return (
    <View className="flex-1 bg-fundo">
      <View className="flex-row items-center justify-between px-4 pt-4">
        <Texto variante="titulo">Perfil</Texto>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Configurações"
          onPress={navegacao.aoAbrirConfiguracoes}
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <Ionicons name="settings-outline" size={24} color={paleta.texto} />
        </Pressable>
      </View>
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(perfil) => (
          <Conteudo
            perfil={perfil}
            atualizando={consulta.isRefetching}
            aoAtualizar={() => void consulta.refetch()}
            {...navegacao}
          />
        )}
      </TelaDados>
    </View>
  )
}
