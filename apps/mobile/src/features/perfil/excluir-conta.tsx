import { excluirContaSchema } from '@atletica/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Alert, View } from 'react-native'
import { TelaRolavel } from '@/components/tela-rolavel'
import { Alerta, Botao, CaixaSelecao, CampoSenha, Texto, toast } from '@/components/ui'
import { ApiErro, CodigoApi } from '@/infra/api/api-erro'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import { useExcluirConta } from './consultas'

export const MENSAGEM_CONTA_EXCLUIDA = 'Conta excluída'
export const MENSAGEM_EXCLUSAO_OFFLINE = 'Conecte-se à internet para excluir a conta.'

const CONSEQUENCIAS = [
  'Seus dados pessoais serão anonimizados.',
  'Você sairá de todos os times.',
  'Suas solicitações pendentes serão canceladas.',
  'O histórico de presenças e resultados será mantido de forma anônima.',
  'Esta ação não pode ser desfeita.',
]

function mensagemDoBloqueio(erro: unknown): string | null {
  if (!(erro instanceof ApiErro)) return null
  if (erro.code === CodigoApi.ULTIMO_ADMINISTRADOR) return erro.message
  if (erro.code !== CodigoApi.RATE_LIMITED) return null
  const segundos = erro.segundosParaNovaTentativa
  return segundos
    ? `Muitas tentativas. Tente novamente em ${Math.ceil(segundos / 60)} min.`
    : erro.message
}

function confirmar(aoConfirmar: () => void) {
  Alert.alert('Excluir conta definitivamente?', 'Seus dados não poderão ser recuperados.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: aoConfirmar },
  ])
}

/** UC13: ao concluir, a sessão local termina e o layout raiz leva ao login. */
export function ExcluirConta() {
  const excluir = useExcluirConta()
  const [entendido, setEntendido] = useState(false)
  const [bloqueio, setBloqueio] = useState<string | null>(null)
  const form = useForm({
    resolver: zodResolver(excluirContaSchema),
    mode: 'onBlur',
    defaultValues: { senha: '' },
  })
  const senha = useWatch({ control: form.control, name: 'senha' })

  const enviar = form.handleSubmit((dados) => {
    setBloqueio(null)
    excluir.mutate(dados, {
      onSuccess: () => toast.sucesso(MENSAGEM_CONTA_EXCLUIDA),
      onError: (erro) => {
        if (!aplicarErrosDaApi(form, erro)) setBloqueio(mensagemDoBloqueio(erro))
      },
    })
  })

  return (
    <TelaRolavel>
      <Alerta titulo="Ao excluir sua conta">
        <View className="gap-1">
          {CONSEQUENCIAS.map((consequencia) => (
            <Texto key={consequencia} variante="legenda">
              {`• ${consequencia}`}
            </Texto>
          ))}
        </View>
      </Alerta>
      <CampoSenha
        controle={form.control}
        nome="senha"
        rotulo="Senha"
        autoComplete="current-password"
        textContentType="password"
      />
      <CaixaSelecao
        marcada={entendido}
        aoAlternar={setEntendido}
        rotulo="Entendo que esta ação não pode ser desfeita"
      >
        <Texto>Entendo que esta ação não pode ser desfeita</Texto>
      </CaixaSelecao>
      {bloqueio && <Alerta>{bloqueio}</Alerta>}
      {!excluir.online && (
        <Texto variante="legenda" className="text-center" accessibilityLiveRegion="polite">
          {MENSAGEM_EXCLUSAO_OFFLINE}
        </Texto>
      )}
      <Botao
        titulo="Excluir minha conta"
        variante="perigo"
        carregando={excluir.isPending}
        disabled={!excluir.online || excluir.isPending || !senha || !entendido}
        onPress={() => confirmar(() => void enviar())}
      />
    </TelaRolavel>
  )
}
