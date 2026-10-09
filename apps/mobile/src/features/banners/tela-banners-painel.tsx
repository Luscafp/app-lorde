import { Papel, type BannerPainelDto } from '@atletica/shared'
import { useState } from 'react'
import { FlatList, Switch, View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { Imagem } from '@/components/imagem'
import { Botao, BotaoIcone, CartaoLinha, confirmar, Texto, toast } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { useTemNivelMinimo } from '@/infra/sessao/use-tem-nivel-minimo'
import { useAtualizarBanner, useBannersPainel, useExcluirBanner, useOrdenarBanners } from './hooks'

export type NavegacaoBanners = {
  novo: () => void
  editar: (id: string) => void
}

type PropsItem = {
  banner: BannerPainelDto
  indice: number
  total: number
  podeExcluir: boolean
  habilitado: boolean
  aoMover: (indice: number, passo: -1 | 1) => void
  aoAlternar: (banner: BannerPainelDto, ativo: boolean) => void
  aoEditar: (id: string) => void
  aoExcluir: (banner: BannerPainelDto) => void
}

function CartaoBannerPainel({
  banner,
  indice,
  total,
  podeExcluir,
  habilitado,
  aoMover,
  aoAlternar,
  aoEditar,
  aoExcluir,
}: PropsItem) {
  const { corPrimaria } = useAtletica()
  return (
    <CartaoLinha className="flex-wrap">
      <Imagem uri={banner.imagemUrl} className="aspect-video w-20 rounded-lg" />
      <View className="flex-1 gap-1">
        <Texto className="font-semibold" numberOfLines={2}>
          {banner.titulo}
        </Texto>
        <Texto variante="legenda">{banner.ativo ? 'Ativo' : 'Inativo'}</Texto>
        {banner.link && (
          <Texto variante="legenda" numberOfLines={1}>
            {banner.link}
          </Texto>
        )}
      </View>
      <Switch
        accessibilityLabel={`Ativo: ${banner.titulo}`}
        value={banner.ativo}
        disabled={!habilitado}
        onValueChange={(ativo) => aoAlternar(banner, ativo)}
        trackColor={{ true: corPrimaria, false: paleta.borda }}
      />
      <View className="w-full flex-row justify-end">
        <BotaoIcone
          icone="arrow-up"
          rotulo={`Subir ${banner.titulo}`}
          disabled={!habilitado || indice === 0}
          onPress={() => aoMover(indice, -1)}
        />
        <BotaoIcone
          icone="arrow-down"
          rotulo={`Descer ${banner.titulo}`}
          disabled={!habilitado || indice === total - 1}
          onPress={() => aoMover(indice, 1)}
        />
        <BotaoIcone
          icone="create-outline"
          rotulo={`Editar ${banner.titulo}`}
          onPress={() => aoEditar(banner.id)}
        />
        {podeExcluir && (
          <BotaoIcone
            icone="trash-outline"
            rotulo={`Excluir ${banner.titulo}`}
            cor={paleta.erro}
            disabled={!habilitado}
            onPress={() => aoExcluir(banner)}
          />
        )}
      </View>
    </CartaoLinha>
  )
}

function mover<T>(lista: T[], indice: number, passo: -1 | 1): T[] {
  const copia = [...lista]
  const [item] = copia.splice(indice, 1)
  if (item !== undefined) copia.splice(indice + passo, 0, item)
  return copia
}

function ListaBanners({ banners, ir }: { banners: BannerPainelDto[]; ir: NavegacaoBanners }) {
  const podeExcluir = useTemNivelMinimo(Papel.PRESIDENTE)
  const alternar = useAtualizarBanner(['LIMITE_BANNERS_ATIVOS'])
  const ordenar = useOrdenarBanners()
  const excluir = useExcluirBanner()
  const [ordemLocal, setOrdemLocal] = useState<string[]>()
  const porId = new Map(banners.map((banner) => [banner.id, banner]))
  const exibidos = ordemLocal ? ordemLocal.flatMap((id) => porId.get(id) ?? []) : banners
  const ocupado = alternar.isPending || ordenar.isPending || excluir.isPending
  const habilitado = alternar.online && !ocupado

  const definirAtivo = (banner: BannerPainelDto, ativo: boolean) =>
    alternar.mutate(
      { id: banner.id, dados: { ativo } },
      {
        onSuccess: () => toast.sucesso(ativo ? 'Banner ativado' : 'Banner desativado'),
        onError: (erro) => {
          if (erro.code === 'LIMITE_BANNERS_ATIVOS') toast.erro(erro.message)
        },
      },
    )

  const salvarOrdem = (ids: string[]) =>
    ordenar.mutate(ids, {
      onSuccess: () => {
        setOrdemLocal(undefined)
        toast.sucesso('Ordem salva')
      },
    })

  const pedirExclusao = (banner: BannerPainelDto) =>
    confirmar({
      titulo: `Excluir ${banner.titulo}?`,
      mensagem: 'Esta ação não pode ser desfeita.',
      acao: 'Excluir',
      aoConfirmar: () =>
        excluir.mutate(banner.id, { onSuccess: () => toast.sucesso('Banner excluído') }),
    })

  return (
    <FlatList
      data={exibidos}
      keyExtractor={({ id }) => id}
      extraData={habilitado}
      contentContainerClassName="gap-2 p-4"
      ListHeaderComponent={
        <View className="gap-2">
          <Botao titulo="Novo banner" onPress={ir.novo} />
          {ordemLocal && (
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Botao
                  titulo="Cancelar"
                  variante="secundaria"
                  disabled={ordenar.isPending}
                  onPress={() => setOrdemLocal(undefined)}
                />
              </View>
              <View className="flex-1">
                <Botao
                  titulo="Salvar ordem"
                  carregando={ordenar.isPending}
                  disabled={!ordenar.online}
                  onPress={() => salvarOrdem(ordemLocal)}
                />
              </View>
            </View>
          )}
        </View>
      }
      renderItem={({ item, index }) => (
        <CartaoBannerPainel
          banner={item}
          indice={index}
          total={exibidos.length}
          podeExcluir={podeExcluir}
          habilitado={habilitado}
          aoMover={(indice, passo) =>
            setOrdemLocal(
              mover(
                exibidos.map(({ id }) => id),
                indice,
                passo,
              ),
            )
          }
          aoAlternar={definirAtivo}
          aoEditar={ir.editar}
          aoExcluir={pedirExclusao}
        />
      )}
    />
  )
}

/** Painel > Banners (UC22): lista, ordenação, ativação e exclusão. */
export function TelaBannersPainel({ ir }: { ir: NavegacaoBanners }) {
  const consulta = useBannersPainel()
  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="lista">
        {(banners) =>
          banners.length === 0 ? (
            <EstadoVazio
              mensagem="Nenhum banner cadastrado"
              acao={{ titulo: 'Novo banner', onPress: ir.novo }}
            />
          ) : (
            <ListaBanners banners={banners} ir={ir} />
          )
        }
      </TelaDados>
    </View>
  )
}
