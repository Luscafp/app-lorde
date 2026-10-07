import { formatarDataHora, StatusSolicitacao, type SolicitacaoPainelDto } from '@atletica/shared'
import { View } from 'react-native'
import { Imagem } from '@/components/imagem'
import { Botao, Selo, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { ModalidadeIcone } from '@/features/modalidades'

const SELO_STATUS: Record<StatusSolicitacao, { texto: string; cor: string }> = {
  PENDENTE: { texto: 'Pendente', cor: paleta.alerta },
  APROVADA: { texto: 'Aceita', cor: paleta.sucesso },
  REJEITADA: { texto: 'Rejeitada', cor: paleta.erro },
  CANCELADA: { texto: 'Cancelada', cor: paleta['texto-suave'] },
}

type Acao = (solicitacao: SolicitacaoPainelDto) => void

export type AcoesSolicitacao = { online: boolean; aprovar: Acao; rejeitar: Acao }

type Props = { solicitacao: SolicitacaoPainelDto; acoes?: AcoesSolicitacao }

type PropsBotao = {
  titulo: 'Aceitar' | 'Rejeitar'
  acao: Acao
  solicitacao: SolicitacaoPainelDto
  online: boolean
  variante?: 'secundaria'
}

function BotaoAvaliacao({ titulo, acao, solicitacao, online, variante }: PropsBotao) {
  return (
    <View className="flex-1">
      <Botao
        titulo={titulo}
        variante={variante}
        accessibilityLabel={`${titulo} ${solicitacao.usuario.nome}`}
        disabled={!online}
        onPress={() => acao(solicitacao)}
      />
    </View>
  )
}

function Encerramento({ solicitacao }: { solicitacao: SolicitacaoPainelDto }) {
  const encerradaEm = solicitacao.avaliadaEm ?? solicitacao.canceladaEm
  return (
    <>
      <View className="flex-row">
        <Selo {...SELO_STATUS[solicitacao.status]} />
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
          <BotaoAvaliacao
            titulo="Rejeitar"
            variante="secundaria"
            acao={acoes.rejeitar}
            solicitacao={solicitacao}
            online={acoes.online}
          />
          <BotaoAvaliacao
            titulo="Aceitar"
            acao={acoes.aprovar}
            solicitacao={solicitacao}
            online={acoes.online}
          />
        </View>
      )}
    </View>
  )
}
