import { formatarData, type MembroElencoDto } from '@atletica/shared'
import { Alert, FlatList, View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { Imagem } from '@/components/imagem'
import { BotaoIcone, CartaoLinha, confirmar, Selo, Texto, toast } from '@/components/ui'
import { useAtletica } from '@/features/atletica'
import { useDefinirCapitao, useElenco, useRemoverMembro, useTime } from './hooks'

const MENSAGEM_VAZIO =
  'Elenco ainda vazio. Os atletas entram pelas solicitações (Painel > Solicitações).'
const MENSAGEM_TIME_ADVERSARIO = 'O elenco só é gerido para times da própria atlética.'

const capitaoPrimeiro = (membros: readonly MembroElencoDto[]) =>
  [...membros].sort((a, b) => Number(b.capitao) - Number(a.capitao))

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
  const definicaoCapitao = useDefinirCapitao(timeId)
  const remocao = useRemoverMembro(timeId)
  const acoesHabilitadas =
    time !== undefined &&
    definicaoCapitao.online &&
    !definicaoCapitao.isPending &&
    !remocao.isPending
  const capitaoAtual = consulta.data?.items.find(({ capitao }) => capitao)

  function definirCapitao(membro: MembroElencoDto) {
    const enviar = () =>
      definicaoCapitao.mutate(membro.usuarioId, {
        onSuccess: () => toast.sucesso('Capitão definido'),
      })
    if (!capitaoAtual) return enviar()
    confirmar({
      titulo: 'Trocar capitão',
      mensagem: `${membro.nome} será o capitão no lugar de ${capitaoAtual.nome}.`,
      destrutiva: false,
      aoConfirmar: enviar,
    })
  }

  function removerCapitania() {
    definicaoCapitao.mutate(null, { onSuccess: () => toast.sucesso('Capitania removida') })
  }

  function removerDoElenco(membro: MembroElencoDto) {
    const aviso = membro.capitao ? ' O time ficará sem capitão.' : ''
    confirmar({
      titulo: 'Remover do elenco',
      mensagem: `Remover ${membro.nome} do ${time?.nome}? Para voltar, será preciso uma nova solicitação.${aviso}`,
      acao: 'Remover',
      aoConfirmar: () =>
        remocao.mutate(membro.usuarioId, { onSuccess: () => toast.sucesso('Membro removido') }),
    })
  }

  function abrirMenu(membro: MembroElencoDto) {
    const botaoCapitania = membro.capitao
      ? { text: 'Remover capitania', onPress: removerCapitania }
      : { text: 'Definir como capitão', onPress: () => definirCapitao(membro) }
    Alert.alert(membro.nome, undefined, [
      botaoCapitania,
      { text: 'Remover do elenco', style: 'destructive', onPress: () => removerDoElenco(membro) },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  if (time && !time.atletica.propria) {
    return (
      <View className="flex-1 bg-fundo">
        <EstadoVazio mensagem={MENSAGEM_TIME_ADVERSARIO} />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados
        consulta={consulta}
        esqueleto="lista"
        vazio={({ items }) => items.length === 0}
        mensagemVazio={MENSAGEM_VAZIO}
      >
        {({ items }) => (
          <FlatList
            data={capitaoPrimeiro(items)}
            keyExtractor={({ usuarioId }) => usuarioId}
            contentContainerClassName="gap-2 p-4"
            extraData={acoesHabilitadas}
            renderItem={({ item }) => (
              <ItemMembro
                membro={item}
                acoesHabilitadas={acoesHabilitadas}
                aoAbrirMenu={abrirMenu}
              />
            )}
          />
        )}
      </TelaDados>
    </View>
  )
}
