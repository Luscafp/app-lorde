import { formatarData, type MembroElencoDto } from '@atletica/shared'
import { Alert, FlatList, View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { Imagem } from '@/components/imagem'
import { BotaoIcone, CartaoLinha, Selo, Texto, toast } from '@/components/ui'
import { useAtletica } from '@/features/atletica'
import { useDefinirCapitao, useElenco, useRemoverMembro, useTime } from './hooks'

const MENSAGEM_VAZIO =
  'Elenco ainda vazio. Os atletas entram pelas solicitações (Painel > Solicitações).'

const capitaoPrimeiro = (membros: readonly MembroElencoDto[]) =>
  [...membros].sort((a, b) => Number(b.capitao) - Number(a.capitao))

function confirmar(titulo: string, mensagem: string, acao: string, aoConfirmar: () => void) {
  Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    { text: acao, style: 'destructive', onPress: aoConfirmar },
  ])
}

type PropsItem = {
  membro: MembroElencoDto
  acoesHabilitadas: boolean
  aoAbrirMenu: (membro: MembroElencoDto) => void
}

function ItemMembro({ membro, acoesHabilitadas, aoAbrirMenu }: PropsItem) {
  const { corPrimaria } = useAtletica()
  return (
    <CartaoLinha>
      <Imagem uri={membro.fotoUrl} nome={membro.nome} className="h-12 w-12 rounded-full" />
      <View className="flex-1 gap-1">
        <Texto className="font-semibold">{membro.nome}</Texto>
        <Texto variante="legenda">Entrou em {formatarData(membro.entradaEm)}</Texto>
        {membro.capitao && (
          <View className="flex-row">
            <Selo texto="CAPITÃO" cor={corPrimaria} />
          </View>
        )}
      </View>
      <BotaoIcone
        icone="ellipsis-vertical"
        rotulo={`Ações de ${membro.nome}`}
        disabled={!acoesHabilitadas}
        onPress={() => aoAbrirMenu(membro)}
      />
    </CartaoLinha>
  )
}

export function ElencoPainel({ timeId }: { timeId: string }) {
  const consulta = useElenco(timeId)
  const { data: time } = useTime(timeId)
  const capitania = useDefinirCapitao(timeId)
  const remocao = useRemoverMembro(timeId)
  const acoesHabilitadas = capitania.online && !capitania.isPending && !remocao.isPending
  const nomeDoTime = time?.nome ?? 'time'

  function definirCapitao(membro: MembroElencoDto, atual: MembroElencoDto | undefined) {
    const enviar = () =>
      capitania.mutate(membro.usuarioId, { onSuccess: () => toast.sucesso('Capitão definido') })
    if (!atual) return enviar()
    confirmar(
      'Trocar capitão',
      `${membro.nome} será o capitão no lugar de ${atual.nome}.`,
      'Confirmar',
      enviar,
    )
  }

  function removerCapitania() {
    capitania.mutate(null, { onSuccess: () => toast.sucesso('Capitania removida') })
  }

  function removerDoElenco(membro: MembroElencoDto) {
    const aviso = membro.capitao ? ' O time ficará sem capitão.' : ''
    confirmar(
      'Remover do elenco',
      `Remover ${membro.nome} do ${nomeDoTime}? Para voltar, será preciso uma nova solicitação.${aviso}`,
      'Remover',
      () => remocao.mutate(membro.usuarioId, { onSuccess: () => toast.sucesso('Membro removido') }),
    )
  }

  function abrirMenu(membro: MembroElencoDto, atual: MembroElencoDto | undefined) {
    const capitaniaDoMembro = membro.capitao
      ? { text: 'Remover capitania', onPress: removerCapitania }
      : { text: 'Definir como capitão', onPress: () => definirCapitao(membro, atual) }
    Alert.alert(membro.nome, undefined, [
      capitaniaDoMembro,
      { text: 'Remover do elenco', style: 'destructive', onPress: () => removerDoElenco(membro) },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="lista">
        {({ items }) => {
          if (items.length === 0) return <EstadoVazio mensagem={MENSAGEM_VAZIO} />
          const membros = capitaoPrimeiro(items)
          const atual = membros.find(({ capitao }) => capitao)
          return (
            <FlatList
              data={membros}
              keyExtractor={({ usuarioId }) => usuarioId}
              contentContainerClassName="gap-2 p-4"
              extraData={acoesHabilitadas}
              renderItem={({ item }) => (
                <ItemMembro
                  membro={item}
                  acoesHabilitadas={acoesHabilitadas}
                  aoAbrirMenu={(membro) => abrirMenu(membro, atual)}
                />
              )}
            />
          )
        }}
      </TelaDados>
    </View>
  )
}
