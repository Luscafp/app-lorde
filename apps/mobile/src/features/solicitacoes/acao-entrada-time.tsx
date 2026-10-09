import type { TimeDetalheDto } from '@atletica/shared'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { ComponentProps, ReactNode } from 'react'
import { View } from 'react-native'
import { AvisoOffline, Botao, confirmar, Texto, toast } from '@/components/ui'
import { paleta } from '@/features/atletica'
import type { ApiErro } from '@/infra/api/cliente'
import { TIME_INATIVO, useCancelarSolicitacao, useSolicitarEntrada } from './hooks'

type Props = {
  time: TimeDetalheDto
  aoTimeIndisponivel: () => void
  acaoDeMembro?: ReactNode
}

type PropsFaixa = { cor: string; icone: ComponentProps<typeof Ionicons>['name']; texto: string }

function Faixa({ cor, icone, texto }: PropsFaixa) {
  return (
    <View
      accessible
      className="flex-row items-center gap-3 rounded-xl border p-3"
      style={{ borderColor: cor }}
    >
      <Ionicons name={icone} size={20} color={cor} />
      <Texto className="flex-1 font-semibold" style={{ color: cor }}>
        {texto}
      </Texto>
    </View>
  )
}

/** Situação do usuário no time (épico #18 §6). */
export function AcaoEntradaTime({ time, aoTimeIndisponivel, acaoDeMembro }: Props) {
  const solicitacao = useSolicitarEntrada(time.id)
  const cancelamento = useCancelarSolicitacao(time.id)
  const situacao = time.minhaSituacao
  if (!situacao) return null
  const pendente = situacao.solicitacaoPendente

  const aoErrar = (erro: ApiErro) => {
    if (erro.code === TIME_INATIVO) aoTimeIndisponivel()
  }

  function solicitar() {
    confirmar({
      titulo: 'Solicitar entrada',
      mensagem: `Enviar uma solicitação para entrar no ${time.nome}? A diretoria vai aceitar ou rejeitar.`,
      acao: 'Enviar',
      destrutiva: false,
      aoConfirmar: () =>
        solicitacao.mutate(undefined, {
          onSuccess: () => toast.sucesso('Solicitação enviada — aguarde a diretoria'),
          onError: aoErrar,
        }),
    })
  }

  function cancelar(id: string) {
    confirmar({
      titulo: 'Cancelar solicitação',
      mensagem: 'Deseja cancelar sua solicitação de entrada neste time?',
      acao: 'Cancelar solicitação',
      cancelar: 'Voltar',
      aoConfirmar: () =>
        cancelamento.mutate(id, { onSuccess: () => toast.sucesso('Solicitação cancelada') }),
    })
  }

  return (
    <View testID="acao-entrada-time" className="gap-2 border-t border-borda bg-fundo p-4">
      {situacao.membro ? (
        <>
          <Faixa cor={paleta.sucesso} icone="checkmark-circle" texto="Você faz parte deste time" />
          {acaoDeMembro}
        </>
      ) : pendente ? (
        <>
          <Faixa cor={paleta.alerta} icone="time" texto="Solicitação pendente de aprovação" />
          <Botao
            titulo="Cancelar solicitação"
            variante="secundaria"
            carregando={cancelamento.isPending}
            disabled={!cancelamento.online}
            onPress={() => cancelar(pendente.id)}
          />
        </>
      ) : (
        <Botao
          titulo="Solicitar entrada"
          carregando={solicitacao.isPending}
          disabled={!solicitacao.online}
          onPress={solicitar}
        />
      )}
      <AvisoOffline online={solicitacao.online} />
    </View>
  )
}
