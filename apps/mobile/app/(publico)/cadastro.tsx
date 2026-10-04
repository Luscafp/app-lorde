import { cadastroFormSchema, SENHA_MIN, TERMOS_VERSAO } from '@atletica/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { View } from 'react-native'
import { TelaRolavel } from '@/components/tela-rolavel'
import { Botao, CaixaSelecao, Campo, CampoSenha, Texto } from '@/components/ui'
import { CabecalhoAuth, useCadastro } from '@/features/auth'
import { CodigoApi } from '@/infra/api/api-erro'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import { MENSAGEM_ACAO_OFFLINE } from '@/infra/query/use-acao-online'

const ROTULO_ACEITE = 'Li e aceito os Termos de Uso e a Política de Privacidade'

export default function Cadastro() {
  const router = useRouter()
  const { email: emailRecebido } = useLocalSearchParams<{ email?: string }>()
  const cadastro = useCadastro()
  const [emailExistente, setEmailExistente] = useState<string | null>(null)
  const form = useForm({
    resolver: zodResolver(cadastroFormSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { nome: '', email: emailRecebido ?? '', senha: '', confirmarSenha: '' },
  })
  const [email, aceite] = useWatch({ control: form.control, name: ['email', 'aceiteTermos'] })
  const emailJaCadastrado = emailExistente !== null && emailExistente === email

  const enviar = form.handleSubmit(({ nome, email: emailNormalizado, senha, aceiteTermos }) =>
    cadastro.mutate(
      { nome, email: emailNormalizado, senha, aceiteTermos, versaoTermos: TERMOS_VERSAO },
      {
        onError: (erro) => {
          aplicarErrosDaApi(form, erro)
          if (erro.code === CodigoApi.EMAIL_JA_CADASTRADO)
            setEmailExistente(form.getValues('email'))
        },
      },
    ),
  )

  return (
    <TelaRolavel>
      <CabecalhoAuth subtitulo="Crie sua conta" />

      <Campo
        controle={form.control}
        nome="nome"
        rotulo="Nome"
        placeholder="Seu nome"
        autoComplete="name"
        autoCapitalize="words"
      />
      <Campo
        controle={form.control}
        nome="email"
        rotulo="E-mail"
        placeholder="seu@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
      />
      {emailJaCadastrado && (
        <View className="flex-row gap-2">
          <Botao
            titulo="Entrar"
            variante="secundaria"
            className="flex-1"
            onPress={() => router.dismissTo({ pathname: '/login', params: { email } })}
          />
          <Botao
            titulo="Esqueci minha senha"
            variante="secundaria"
            className="flex-1"
            onPress={() => router.push({ pathname: '/recuperar-senha', params: { email } })}
          />
        </View>
      )}
      <View className="gap-1">
        <CampoSenha
          controle={form.control}
          nome="senha"
          rotulo="Senha"
          autoComplete="new-password"
        />
        <Texto variante="legenda">
          {`Mínimo de ${SENHA_MIN} caracteres, com ao menos uma letra e um número.`}
        </Texto>
      </View>
      <CampoSenha
        controle={form.control}
        nome="confirmarSenha"
        rotulo="Confirmar senha"
        autoComplete="new-password"
      />

      <Controller
        control={form.control}
        name="aceiteTermos"
        render={({ field }) => (
          <CaixaSelecao
            marcada={field.value === true}
            aoAlternar={field.onChange}
            rotulo={ROTULO_ACEITE}
          >
            <Texto variante="legenda">
              Li e aceito os{' '}
              <Link href="/termos" className="text-secundaria underline">
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link href="/privacidade" className="text-secundaria underline">
                Política de Privacidade
              </Link>
            </Texto>
          </CaixaSelecao>
        )}
      />

      <Botao
        titulo="Criar conta"
        carregando={cadastro.isPending}
        disabled={!cadastro.online || aceite !== true}
        onPress={() => void enviar()}
      />
      {!cadastro.online && (
        <Texto variante="legenda" className="text-center" accessibilityLiveRegion="polite">
          {MENSAGEM_ACAO_OFFLINE}
        </Texto>
      )}

      <View className="items-center">
        <Link
          href={{ pathname: '/login', params: { email } }}
          dismissTo
          className="min-h-[44px] py-3 text-sm font-semibold text-secundaria underline"
        >
          Já tenho conta
        </Link>
      </View>
    </TelaRolavel>
  )
}
