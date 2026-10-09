import Ionicons from '@expo/vector-icons/Ionicons'
import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { EstadoVazio, ListaInfinita, TelaDados } from '@/components/estado'
import { Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { ChipsFiltrosAtivos, ItemAuditoria } from './componentes'
import { useListaAuditoria } from './consultas'
import { FiltrosAuditoriaSheet } from './filtros-auditoria'
import {
  FILTROS_PADRAO,
  filtrosAtivos,
  paraConsulta,
  removerFiltro,
  type FiltrosTela,
} from './filtros'

export const MENSAGEM_SEM_REGISTROS = 'Nenhum registro encontrado para os filtros escolhidos.'

type Props = {
  filtros: FiltrosTela
  aoMudarFiltros: (filtros: FiltrosTela) => void
  aoAbrir: (id: string) => void
}

export function ListaAuditoria({ filtros, aoMudarFiltros, aoAbrir }: Props) {
  const [editando, setEditando] = useState(false)
  const consulta = useListaAuditoria(useMemo(() => paraConsulta(filtros), [filtros]))
  const ativos = filtrosAtivos(filtros)
  const limparFiltros = () => aoMudarFiltros(FILTROS_PADRAO)

  return (
    <View className="flex-1 bg-fundo">
      <View className="gap-3 p-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filtros${ativos.length ? `, ${ativos.length} ativos` : ''}`}
          onPress={() => setEditando(true)}
          className="min-h-[44px] flex-row items-center gap-2 self-start rounded-full border border-borda px-4"
        >
          <Ionicons name="options-outline" size={18} color={paleta.texto} />
          <Texto variante="rotulo">Filtros</Texto>
        </Pressable>
        <ChipsFiltrosAtivos
          filtros={ativos}
          aoRemover={({ chave }) => aoMudarFiltros(removerFiltro(filtros, chave))}
        />
      </View>
      <TelaDados consulta={consulta} esqueleto="lista">
        {({ pages }) => {
          const registros = juntarPaginas(pages)
          if (registros.length === 0) {
            return (
              <EstadoVazio
                mensagem={MENSAGEM_SEM_REGISTROS}
                acao={{ titulo: 'Limpar filtros', onPress: limparFiltros }}
              />
            )
          }
          return (
            <ListaInfinita
              consulta={consulta}
              data={registros}
              keyExtractor={({ id }) => id}
              renderItem={({ item }) => <ItemAuditoria registro={item} aoAbrir={aoAbrir} />}
            />
          )
        }}
      </TelaDados>
      {editando && (
        <FiltrosAuditoriaSheet
          filtros={filtros}
          aoFechar={() => setEditando(false)}
          aoAplicar={(novos) => {
            setEditando(false)
            aoMudarFiltros(novos)
          }}
        />
      )}
    </View>
  )
}
