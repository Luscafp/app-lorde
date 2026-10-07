import { formatarDataHora, StatusSolicitacao, type SolicitacaoPainelDto } from '@atletica/shared'
import { View } from 'react-native'
import { Imagem } from '@/components/imagem'
import { Botao, Selo, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { ModalidadeIcone } from '@/features/modalidades'

const COR_STATUS: Record<StatusSolicitacao, string> = {
  PENDENTE: paleta.alerta,
  APROVADA: paleta.sucesso,
  REJEITADA: paleta.erro,
  CANCELADA: paleta['texto-suave'],
}

export type AcoesSolicitacao = {
  online: boolean
  aceitar: (solicitacao: SolicitacaoPainelDto) => void
  rejeitar: (solicitacao: SolicitacaoPainelDto) => void
}

type Props = { solicitacao: SolicitacaoPainelDto; acoes?: AcoesSolicitacao }

function Encerramento({ solicitacao }: { solicitacao: SolicitacaoPainelDto }) {
  const encerradaEm = solicitacao.avaliadaEm ?? solicitacao.canceladaEm
  return (
    <>
      <View className="flex-row">
        <Selo texto={solicitacao.status} cor={COR_STATUS[solicitacao.status]} />
      </View>
      {encerradaEm && (
        <Texto variante="legenda">{`Encerrada em ${formatarDataHora(encerradaEm)}`}</Texto>
      )}
      {solicitacao.avaliadoPor && (
        <Texto variante="legenda">{`por ${solicitacao.avaliadoPor.nome}`}</Texto>
      )}
    </>
  )
}

/** Pendente com "Aceitar"/"Rejeitar"; no histórico, status, encerramento e avaliador. */
export function ItemSolicitacao({ solicitacao, acoes }: Props) {
  const { usuario, time } = solicitacao

  return (
    <View
      testID={`solicitacao-${solicitacao.id}`}
      className="gap-3 rounded-2xl border border-borda bg-cartao p-3"
    >
      <View className="flex-row items-center gap-3">
        <Imagem uri={usuario.fotoUrl} nome={usuario.nome} className="h-10 w-10 rounded-full" />
        <View className="flex-1 gap-1">
          <Texto className="font-semibold" numberOfLines={1}>
            {usuario.nome}
          </Texto>
          <View
            accessible
            accessibilityLabel={`${time.nome}, ${time.modalidade.nome}`}
            className="flex-row items-center gap-1"
          >
            <ModalidadeIcone icone={time.modalidade.icone} tamanho={16} />
            <Texto variante="legenda" numberOfLines={1}>
              {`${time.nome} · ${time.modalidade.nome}`}
            </Texto>
          </View>
          <Texto variante="legenda">{`Solicitada em ${formatarDataHora(solicitacao.criadaEm)}`}</Texto>
          {solicitacao.status !== StatusSolicitacao.PENDENTE && (
            <Encerramento solicitacao={solicitacao} />
          )}
        </View>
      </View>
      {acoes && (
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Botao
              titulo="Rejeitar"
              variante="secundaria"
              accessibilityLabel={`Rejeitar ${usuario.nome}`}
              disabled={!acoes.online}
              onPress={() => acoes.rejeitar(solicitacao)}
            />
          </View>
          <View className="flex-1">
            <Botao
              titulo="Aceitar"
              accessibilityLabel={`Aceitar ${usuario.nome}`}
              disabled={!acoes.online}
              onPress={() => acoes.aceitar(solicitacao)}
            />
          </View>
        </View>
      )}
    </View>
  )
}
