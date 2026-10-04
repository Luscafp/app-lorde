import { esqueciSenhaSchema } from '@atletica/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { useForm } from 'react-hook-form'
import { Botao, Campo, Texto } from '@/components/ui'
import { TelaRecuperacao, useEnviarCodigo, useRecuperacaoStore } from '@/features/recuperacao-senha'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'

export default function InformarEmail() {
  const router = useRouter()
  const emailInicial = useRecuperacaoStore((estado) => estado.email)
  const codigoEnviado = useRecuperacaoStore((estado) => estado.codigoEnviado)
  const enviar = useEnviarCodigo()
  const form = useForm({
    resolver: zodResolver(esqueciSenhaSchema),
    mode: 'onBlur',
    defaultValues: { email: emailInicial },
  })

  const aoEnviar = form.handleSubmit((dados) =>
    enviar.mutate(dados, {
      onSuccess: () => {
        codigoEnviado(dados.email)
        router.push('/recuperar-senha/codigo')
      },
      onError: (erro) => aplicarErrosDaApi(form, erro),
    }),
  )

  return (
    <TelaRecuperacao titulo="Recuperar senha">
      <Texto variante="legenda">
        Informe o e-mail da sua conta. Enviaremos um código de 6 dígitos para você criar uma nova
        senha.
      </Texto>
      <Campo
        controle={form.control}
        nome="email"
        rotulo="E-mail"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => void aoEnviar()}
      />
      <Botao
        titulo="Enviar código"
        carregando={enviar.isPending}
        disabled={!enviar.online}
        onPress={() => void aoEnviar()}
      />
    </TelaRecuperacao>
  )
}
