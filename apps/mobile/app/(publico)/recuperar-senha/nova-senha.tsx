import { novaSenhaFormSchema, SENHA_MAX, SENHA_MIN } from '@atletica/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { Redirect, useRouter } from 'expo-router'
import { useForm } from 'react-hook-form'
import { Botao, Campo, Texto, toast } from '@/components/ui'
import {
  CODIGO_INVALIDO,
  MENSAGEM_SENHA_REDEFINIDA,
  useRecuperacaoStore,
  useRedefinirSenha,
} from '@/features/recuperacao-senha'
import { TelaRecuperacao } from '@/features/recuperacao-senha/tela-recuperacao'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'

export default function NovaSenha() {
  const router = useRouter()
  const email = useRecuperacaoStore((estado) => estado.email)
  const codigo = useRecuperacaoStore((estado) => estado.codigo)
  const definirCodigo = useRecuperacaoStore((estado) => estado.definirCodigo)
  const concluir = useRecuperacaoStore((estado) => estado.concluir)
  const redefinir = useRedefinirSenha()
  const form = useForm({
    resolver: zodResolver(novaSenhaFormSchema),
    mode: 'onBlur',
    defaultValues: { novaSenha: '', confirmarSenha: '' },
  })

  if (!email) return <Redirect href="/recuperar-senha" />

  const voltarAoCodigo = () =>
    router.canGoBack() ? router.back() : router.replace('/recuperar-senha/codigo')

  const aoEnviar = form.handleSubmit(({ novaSenha }) => {
    if (!codigo) return voltarAoCodigo()
    redefinir.mutate(
      { email, codigo, novaSenha },
      {
        onSuccess: () => {
          concluir()
          toast.sucesso(MENSAGEM_SENHA_REDEFINIDA)
          router.dismissTo('/login')
        },
        onError: (erro) => {
          if (erro.code !== CODIGO_INVALIDO) return void aplicarErrosDaApi(form, erro)
          definirCodigo('')
          voltarAoCodigo()
        },
      },
    )
  })

  return (
    <TelaRecuperacao titulo="Nova senha">
      <Texto variante="legenda">
        {`Use de ${SENHA_MIN} a ${SENHA_MAX} caracteres, com ao menos uma letra e um número.`}
      </Texto>
      <Campo
        controle={form.control}
        nome="novaSenha"
        rotulo="Nova senha"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Campo
        controle={form.control}
        nome="confirmarSenha"
        rotulo="Confirmar nova senha"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={() => void aoEnviar()}
      />
      <Botao
        titulo="Redefinir senha"
        carregando={redefinir.isPending}
        disabled={!redefinir.online}
        onPress={() => void aoEnviar()}
      />
    </TelaRecuperacao>
  )
}
