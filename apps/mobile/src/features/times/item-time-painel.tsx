import type { TimeDto } from '@atletica/shared'
import { Switch, View } from 'react-native'
import { BotaoIcone, Selo, Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import { ModalidadeIcone } from '@/features/modalidades'

type Props = {
  time: TimeDto
  podeExcluir: boolean
  /** Toggle e excluir ficam desabilitados offline ou durante a ação. */
  acoesHabilitadas: boolean
  aoEditar: (time: TimeDto) => void
  aoAbrirElenco: (time: TimeDto) => void
  aoAlternar: (time: TimeDto, ativo: boolean) => void
  aoExcluir: (time: TimeDto) => void
}

function resumoElenco({ totalMembros, capitao }: TimeDto): string {
  const membros = totalMembros === 1 ? '1 membro' : `${totalMembros} membros`
  return capitao ? `${membros} · Capitão: ${capitao.nome}` : `${membros} · Sem capitão`
}

export function ItemTimePainel({
  time,
  podeExcluir,
  acoesHabilitadas,
  aoEditar,
  aoAbrirElenco,
  aoAlternar,
  aoExcluir,
}: Props) {
  const { corPrimaria } = useAtletica()
  const { atletica } = time

  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-borda bg-cartao px-3 py-2">
      <ModalidadeIcone
        icone={time.modalidade.icone}
        cor={time.ativo ? corPrimaria : paleta['texto-suave']}
      />
      <View className="flex-1 gap-1">
        <Texto className="font-semibold">{time.nome}</Texto>
        <Texto variante="legenda">{time.modalidade.nome}</Texto>
        <View className="flex-row flex-wrap gap-1">
          {!time.ativo && <Selo texto="INATIVO" />}
          {!atletica.propria && (
            <Selo texto={atletica.sigla ?? atletica.nome} cor={paleta.alerta} />
          )}
        </View>
        {atletica.propria && <Texto variante="legenda">{resumoElenco(time)}</Texto>}
      </View>
      <Switch
        accessibilityLabel={`Ativo: ${time.nome}`}
        value={time.ativo}
        disabled={!acoesHabilitadas}
        onValueChange={(ativo) => aoAlternar(time, ativo)}
        trackColor={{ true: corPrimaria, false: paleta.borda }}
      />
      <View>
        <BotaoIcone
          icone="create-outline"
          rotulo={`Editar ${time.nome}`}
          onPress={() => aoEditar(time)}
        />
        {atletica.propria && (
          <BotaoIcone
            icone="people-outline"
            rotulo={`Elenco de ${time.nome}`}
            onPress={() => aoAbrirElenco(time)}
          />
        )}
        {podeExcluir && (
          <BotaoIcone
            icone="trash-outline"
            rotulo={`Excluir ${time.nome}`}
            cor={paleta.erro}
            disabled={!acoesHabilitadas}
            onPress={() => aoExcluir(time)}
          />
        )}
      </View>
    </View>
  )
}
