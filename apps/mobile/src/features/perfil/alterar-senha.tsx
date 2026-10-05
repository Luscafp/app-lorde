import { alterarSenhaFormSchema, SENHA_MAX, SENHA_MIN } from '@atletica/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { TelaRolavel } from '@/components/tela-rolavel'
import { AvisoOffline, Botao, CampoSenha, Texto, toast } from '@/components/ui'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import { useAlterarSenha } from './consultas'

export const MENSAGEM_SENHA_ALTERADA = 'Senha alterada'

export function AlterarSenha({ aoConcluir }: { aoConcluir: () => void }) {
  const alterar = useAlterarSenha()
  const form = useForm({
    resolver: zodResolver(alterarSenhaFormSchema),
    mode: 'onBlur',
    defaultValues: { senhaAtual: '', novaSenha: '', confirmarSenha: '' },
  })

  const salvar = form.handleSubmit(({ senhaAtual, novaSenha }) => {
    alterar.mutate(
      { senhaAtual, novaSenha },
      {
        onSuccess: () => {
          toast.sucesso(MENSAGEM_SENHA_ALTERADA)
          aoConcluir()
        },
        onError: (erro) => void aplicarErrosDaApi(form, erro),
      },
    )
  })

  return (
    <TelaRolavel>
      <CampoSenha
        controle={form.control}
        nome="senhaAtual"
        rotulo="Senha atual"
        autoComplete="current-password"
        textContentType="password"
      />
      <Texto variante="legenda">
        {`Use de ${SENHA_MIN} a ${SENHA_MAX} caracteres, com ao menos uma letra e um número.`}
      </Texto>
      <CampoSenha
        controle={form.control}
        nome="novaSenha"
        rotulo="Nova senha"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <CampoSenha
        controle={form.control}
        nome="confirmarSenha"
        rotulo="Confirmar nova senha"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={() => void salvar()}
      />
      <AvisoOffline online={alterar.online} />
      <Botao
        titulo="Salvar"
        carregando={alterar.isPending}
        disabled={!alterar.online}
        onPress={() => void salvar()}
      />
    </TelaRolavel>
  )
}
