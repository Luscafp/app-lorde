import { atualizarPerfilSchema, FinalidadeUpload, type Perfil } from '@atletica/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { SeletorImagem } from '@/components/imagem'
import { TelaRolavel } from '@/components/tela-rolavel'
import { AvisoOffline, Botao, Campo, toast } from '@/components/ui'
import { aplicarErrosDaApi } from '@/infra/api/aplicar-erros'
import { useAtualizarFoto, useAtualizarPerfil, useMe, useRemoverFoto } from './consultas'

export const MENSAGEM_PERFIL_ATUALIZADO = 'Perfil atualizado'

/** `undefined`: foto sem alteração; `null`: removida; texto: chave do upload concluído. */
type FotoEditada = string | null | undefined

function Formulario({ perfil, aoSalvar }: { perfil: Perfil; aoSalvar: () => void }) {
  const atualizarNome = useAtualizarPerfil()
  const atualizarFoto = useAtualizarFoto()
  const removerFoto = useRemoverFoto()
  const { online } = atualizarNome
  const [foto, setFoto] = useState<FotoEditada>(undefined)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const form = useForm({
    resolver: zodResolver(atualizarPerfilSchema),
    mode: 'onBlur',
    defaultValues: { nome: perfil.nome },
  })

  const salvando = atualizarNome.isPending || atualizarFoto.isPending || removerFoto.isPending
  const alterado = form.formState.isDirty || foto !== undefined

  const salvar = form.handleSubmit(async ({ nome }) => {
    try {
      if (foto === null) await removerFoto.mutateAsync()
      else if (foto !== undefined) await atualizarFoto.mutateAsync(foto)
      setFoto(undefined)
      if (form.formState.isDirty) await atualizarNome.mutateAsync({ nome })
      toast.sucesso(MENSAGEM_PERFIL_ATUALIZADO)
      aoSalvar()
    } catch (erro) {
      aplicarErrosDaApi(form, erro)
    }
  })

  return (
    <TelaRolavel>
      <View className="items-center">
        <SeletorImagem
          finalidade={FinalidadeUpload.PERFIL}
          formato="circulo"
          valorAtualUrl={perfil.fotoUrl}
          nome={perfil.nome}
          rotulo="Foto de perfil"
          desabilitado={salvando}
          onChange={setFoto}
          onMudarEnviando={setEnviandoFoto}
        />
      </View>
      <Campo
        controle={form.control}
        nome="nome"
        rotulo="Nome"
        autoComplete="name"
        textContentType="name"
        returnKeyType="done"
        onSubmitEditing={() => void salvar()}
      />
      <AvisoOffline online={online} />
      <Botao
        titulo="Salvar"
        carregando={salvando}
        disabled={!online || !alterado || enviandoFoto}
        onPress={() => void salvar()}
      />
    </TelaRolavel>
  )
}

export function EditarPerfil({ aoSalvar }: { aoSalvar: () => void }) {
  const consulta = useMe()
  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(perfil) => <Formulario perfil={perfil} aoSalvar={aoSalvar} />}
      </TelaDados>
    </View>
  )
}
