import { StatusNoticia } from '@atletica/shared'
import { useState } from 'react'
import { View } from 'react-native'
import { EstadoVazio, ListaInfinita, TelaDados } from '@/components/estado'
import { Botao, CampoBusca, Pilulas, type Opcao } from '@/components/ui'
import { juntarPaginas } from '@/infra/query/juntar-paginas'
import { useValorAtrasado } from '@/infra/use-valor-atrasado'
import { useNoticiasPainel } from './hooks'
import { ItemNoticiaPainel } from './item-noticia-painel'

const ATRASO_BUSCA_MS = 300

const OPCOES_STATUS: readonly Opcao<StatusNoticia>[] = [
  { valor: undefined, rotulo: 'Todas' },
  { valor: StatusNoticia.PUBLICADA, rotulo: 'Publicadas' },
  { valor: StatusNoticia.RASCUNHO, rotulo: 'Rascunhos' },
]

export type NavegacaoNoticias = {
  nova: () => void
  editar: (id: string) => void
}

export function ListaNoticiasPainel({ ir }: { ir: NavegacaoNoticias }) {
  const [status, setStatus] = useState<StatusNoticia>()
  const [termo, setTermo] = useState('')
  const busca = useValorAtrasado(termo.trim(), ATRASO_BUSCA_MS) || undefined
  const consulta = useNoticiasPainel({ status, q: busca })
  const comFiltro = !!status || !!busca

  const limparFiltros = () => {
    setStatus(undefined)
    setTermo('')
  }

  return (
    <View className="flex-1 bg-fundo">
      <View className="gap-3 p-4">
        <CampoBusca rotulo="Buscar por título" valor={termo} aoMudar={setTermo} />
        <Pilulas
          rotulo="Filtrar por status"
          opcoes={OPCOES_STATUS}
          valor={status}
          aoMudar={setStatus}
        />
        <Botao titulo="Nova notícia" onPress={ir.nova} />
      </View>
      <TelaDados consulta={consulta} esqueleto="lista">
        {({ pages }) => {
          const noticias = juntarPaginas(pages)
          if (noticias.length === 0) {
            return comFiltro ? (
              <EstadoVazio
                mensagem="Nenhuma notícia encontrada"
                acao={{ titulo: 'Limpar filtros', onPress: limparFiltros }}
              />
            ) : (
              <EstadoVazio
                mensagem="Nenhuma notícia cadastrada"
                acao={{ titulo: 'Nova notícia', onPress: ir.nova }}
              />
            )
          }
          return (
            <ListaInfinita
              consulta={consulta}
              data={noticias}
              keyExtractor={({ id }) => id}
              contentContainerClassName="gap-2 px-4 pb-4"
              renderItem={({ item }) => <ItemNoticiaPainel noticia={item} aoAbrir={ir.editar} />}
            />
          )
        }}
      </TelaDados>
    </View>
  )
}
