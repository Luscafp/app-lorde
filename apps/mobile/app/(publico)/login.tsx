import { loginSchema } from '@atletica/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { View } from 'react-native'
import { TelaRolavel } from '@/components/tela-rolavel'
import { Alerta, Botao, Campo, CampoSenha, Texto } from '@/components/ui'
import { useAtletica } from '@/features/atletica'
import {
  CabecalhoAuth,
  formatarMinutosSegundos,
  useContagemRegressiva,
  useLogin,
} from '@/features/auth'
import { CodigoApi, type ApiErro } from '@/infra/api/api-erro'
import { MENSAGEM_ACAO_OFFLINE } from '@/infra/query/use-acao-online'

function AvisoDeErro({ erro }: { erro: ApiErro | null }) {
  const { contatoEmail } = useAtletica()

  if (erro?.code === CodigoApi.CONTA_DESATIVADA) {
    return (
      <Alerta variante="alerta" titulo="Conta desativada">
        <Texto variante="legenda">{erro.message}</Texto>
        {contatoEmail && <Texto variante="legenda">Contato da diretoria: {contatoEmail}</Texto>}
      </Alerta>
    )
  }
  const semContagem = erro?.code === CodigoApi.RATE_LIMITED && !erro.segundosParaNovaTentativa
  if (erro?.code === CodigoApi.CREDENCIAIS_INVALIDAS || semContagem) {
    return <Alerta>{erro.message}</Alerta>
  }
  return null
}

export default function Login() {
  const { email: emailRecebido } = useLocalSearchParams<{ email?: string }>()
  const login = useLogin()
  const bloqueio = useContagemRegressiva()
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: emailRecebido ?? '', senha: '' },
  })
  const email = useWatch({ control: form.control, name: 'email' })

  useEffect(() => {
    if (emailRecebido !== undefined) form.setValue('email', emailRecebido)
  }, [emailRecebido, form])

  const enviar = form.handleSubmit((dados) =>
    login.mutate(dados, {
      onError: (erro) => {
        if (erro.code === CodigoApi.RATE_LIMITED && erro.segundosParaNovaTentativa) {
          bloqueio.iniciar(erro.segundosParaNovaTentativa)
        }
      },
    }),
  )

  return (
    <TelaRolavel centralizada>
      <CabecalhoAuth subtitulo="Entre com seu e-mail e senha" />

      {bloqueio.ativa ? (
        <Alerta titulo="Login bloqueado temporariamente">
          {`Muitas tentativas incorretas. Tente novamente em ${formatarMinutosSegundos(bloqueio.restantes)}.`}
        </Alerta>
      ) : (
        <AvisoDeErro erro={login.error} />
      )}

      <Campo
        controle={form.control}
        nome="email"
        rotulo="E-mail"
        placeholder="seu@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        editable={!bloqueio.ativa}
      />
      <CampoSenha
        controle={form.control}
        nome="senha"
        rotulo="Senha"
        autoComplete="current-password"
        editable={!bloqueio.ativa}
        onSubmitEditing={() => void enviar()}
      />
      <View className="items-end">
        <Link
          href={{ pathname: '/recuperar-senha', params: { email } }}
          className="min-h-[44px] py-3 text-sm text-texto-suave underline"
        >
          Esqueci minha senha
        </Link>
      </View>

      <Botao
        titulo="Entrar"
        carregando={login.isPending}
        disabled={!login.online || bloqueio.ativa}
        onPress={() => void enviar()}
      />
      {!login.online && (
        <Texto variante="legenda" className="text-center" accessibilityLiveRegion="polite">
          {MENSAGEM_ACAO_OFFLINE}
        </Texto>
      )}

      <View className="flex-row items-center justify-center gap-1">
        <Texto variante="legenda">Não tem conta?</Texto>
        <Link
          href={{ pathname: '/cadastro', params: { email } }}
          className="min-h-[44px] py-3 text-sm font-semibold text-secundaria underline"
        >
          Criar conta
        </Link>
      </View>
    </TelaRolavel>
  )
}
