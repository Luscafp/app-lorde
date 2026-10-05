import {
  BUSCA_MIN,
  Papel,
  ROTULO_PAPEL,
  SituacaoUsuario,
  type SituacaoFiltro,
} from '@atletica/shared'
import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, TextInput, View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { Pilulas, type Opcao } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { useValorAtrasado } from '@/infra/use-valor-atrasado'
import { ItemUsuario } from './componentes'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { useListaUsuarios } from './consultas'

const ATRASO_BUSCA_MS = 300

const PAPEIS_FILTRO = [
  Papel.ATLETA,
  Papel.DIRETOR,
  Papel.VICE_PRESIDENTE,
  Papel.PRESIDENTE,
  Papel.ADMINISTRADOR,
] as const

const OPCOES_PAPEL: readonly Opcao<Papel>[] = [
  { valor: undefined, rotulo: 'Todos' },
  ...PAPEIS_FILTRO.map((papel) => ({ valor: papel, rotulo: ROTULO_PAPEL[papel] })),
]

const OPCOES_SITUACAO: readonly Opcao<SituacaoFiltro>[] = [
  { valor: undefined, rotulo: 'Todos' },
  { valor: SituacaoUsuario.ATIVO, rotulo: 'Ativos' },
  { valor: SituacaoUsuario.DESATIVADO, rotulo: 'Desativados' },
]

/** Com 1 caractere a busca anterior continua valendo (a API exige 2). */
function useBusca(termo: string): string | undefined {
  const atrasado = useValorAtrasado(termo.trim(), ATRASO_BUSCA_MS)
  const [busca, setBusca] = useState<string>()
  useEffect(() => {
    if (atrasado.length === 0 || atrasado.length >= BUSCA_MIN) setBusca(atrasado || undefined)
  }, [atrasado])
  return busca
}

export function ListaUsuarios({ aoAbrir }: { aoAbrir: (id: string) => void }) {
  const [termo, setTermo] = useState('')
  const [papel, setPapel] = useState<Papel>()
  const [situacao, setSituacao] = useState<SituacaoFiltro>()
  const busca = useBusca(termo)
  const consulta = useListaUsuarios({ busca, papel, situacao })

  const limparFiltros = () => {
    setTermo('')
    setPapel(undefined)
    setSituacao(undefined)
  }
  const carregarMais = () => {
    if (consulta.hasNextPage && !consulta.isFetchingNextPage) void consulta.fetchNextPage()
  }

  return (
    <View className="flex-1 bg-fundo">
      <View className="gap-3 p-4">
        <TextInput
          value={termo}
          onChangeText={setTermo}
          accessibilityLabel="Buscar por nome ou e-mail"
          placeholder="Buscar por nome ou e-mail"
          placeholderTextColor={paleta['texto-suave']}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          className="min-h-[44px] rounded-xl border border-borda bg-superficie px-3 py-2 text-base text-texto"
        />
        <Pilulas
          rotulo="Filtrar por cargo"
          opcoes={OPCOES_PAPEL}
          valor={papel}
          aoMudar={setPapel}
        />
        <Pilulas
          rotulo="Filtrar por situação"
          opcoes={OPCOES_SITUACAO}
          valor={situacao}
          aoMudar={setSituacao}
        />
      </View>
      <TelaDados consulta={consulta} esqueleto="lista">
        {({ pages }) => {
          const usuarios = juntarPaginas(pages)
          if (usuarios.length === 0) {
            return (
              <EstadoVazio
                mensagem="Nenhum usuário encontrado"
                acao={{ titulo: 'Limpar filtros', onPress: limparFiltros }}
              />
            )
          }
          return (
            <FlatList
              data={usuarios}
              keyExtractor={({ id }) => id}
              renderItem={({ item }) => <ItemUsuario usuario={item} aoAbrir={aoAbrir} />}
              onEndReached={carregarMais}
              onEndReachedThreshold={0.5}
              refreshing={consulta.isRefetching && !consulta.isFetchingNextPage}
              onRefresh={() => void consulta.refetch()}
              ListFooterComponent={
                consulta.isFetchingNextPage ? (
                  <ActivityIndicator className="py-4" color={paleta['texto-suave']} />
                ) : null
              }
            />
          )
        }}
      </TelaDados>
    </View>
  )
}
