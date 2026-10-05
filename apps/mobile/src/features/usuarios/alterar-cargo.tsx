import Ionicons from '@expo/vector-icons/Ionicons'
import {
  ehDiretoria,
  nivelDoPapel,
  Papel,
  ROTULO_PAPEL,
  type UsuarioDetalhe,
} from '@atletica/shared'
import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import { Alerta, Botao, Texto } from '@/components/ui'
import { paleta, useAtletica } from '@/features/atletica'
import type { ApiErro } from '@/infra/api/api-erro'
import { chaves } from '@/infra/query/chaves'
import { useSessao } from '@/infra/sessao/store'
import { confirmar } from './confirmar'
import { ERROS_DO_CARGO, useAlterarPapel } from './consultas'

/** Crescente de nível, como no protótipo. */
const ORDEM: readonly Papel[] = [
  Papel.ATLETA,
  Papel.DIRETOR,
  Papel.VICE_PRESIDENTE,
  Papel.PRESIDENTE,
  Papel.ADMINISTRADOR,
]

function corDoPapel(papel: Papel, corPrimaria: string): string {
  return {
    ATLETA: paleta['texto-suave'],
    DIRETOR: corPrimaria,
    VICE_PRESIDENTE: paleta.alerta,
    PRESIDENTE: paleta.alerta,
    ADMINISTRADOR: paleta.erro,
  }[papel]
}

function OpcaoPapel({
  papel,
  cor,
  marcada,
  desabilitada,
  aoEscolher,
}: {
  papel: Papel
  cor: string
  marcada: boolean
  desabilitada: boolean
  aoEscolher: (papel: Papel) => void
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={ROTULO_PAPEL[papel]}
      accessibilityState={{ checked: marcada, disabled: desabilitada }}
      disabled={desabilitada}
      onPress={() => aoEscolher(papel)}
      className="min-h-[44px] flex-row items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ borderColor: marcada ? cor : paleta.borda, opacity: desabilitada ? 0.4 : 1 }}
    >
      <View className="h-3 w-3 rounded-full" style={{ backgroundColor: cor }} />
      <Texto className="flex-1 font-semibold" style={marcada ? { color: cor } : undefined}>
        {ROTULO_PAPEL[papel]}
      </Texto>
      {marcada && <Ionicons name="checkmark" size={18} color={cor} />}
    </Pressable>
  )
}

export function AlterarCargoSheet({
  usuario,
  aoFechar,
}: {
  usuario: UsuarioDetalhe
  aoFechar: () => void
}) {
  const [selecionado, setSelecionado] = useState<Papel>(usuario.papel)
  const [erro, setErro] = useState<string | null>(null)
  const ehProprio = useSessao((estado) => estado.usuario?.id === usuario.id)
  const acao = useAlterarPapel(usuario.id)
  const cliente = useQueryClient()
  const { corPrimaria } = useAtletica()
  const { ehUltimoAdministrador } = usuario.permissoes

  async function aplicarNaPropriaSessao(papel: Papel) {
    await useSessao.getState().atualizarUsuario({ papel })
    void cliente.invalidateQueries({ queryKey: chaves.me() })
    if (!ehDiretoria(papel)) router.replace('/(app)/(abas)/perfil')
  }

  function enviar(confirmarSubstituicao?: true) {
    setErro(null)
    acao.mutate(
      { papel: selecionado, confirmarSubstituicao },
      {
        onSuccess: ({ alterado, usuario: { papel } }) => {
          aoFechar()
          if (alterado && ehProprio) void aplicarNaPropriaSessao(papel)
        },
        onError: (falha: ApiErro) => {
          if (falha.code === 'SUBSTITUICAO_NECESSARIA') {
            confirmar({
              titulo: `Substituir ${ROTULO_PAPEL[selecionado]}`,
              mensagem: falha.message,
              aoConfirmar: () => enviar(true),
            })
          } else if (ERROS_DO_CARGO.includes(falha.code)) {
            setErro(falha.message)
          }
        },
      },
    )
  }

  function salvar() {
    if (ehProprio && nivelDoPapel(selecionado) < nivelDoPapel(usuario.papel)) {
      confirmar({
        titulo: 'Alterar o próprio cargo',
        mensagem: 'Você perderá o acesso de Administrador.',
        aoConfirmar: () => enviar(),
      })
      return
    }
    enviar()
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={aoFechar}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="gap-4 rounded-t-3xl bg-superficie p-4 pb-8">
          <Texto variante="subtitulo">Alterar cargo</Texto>
          <Texto variante="legenda">
            Cargo atual de {usuario.nome}:{' '}
            <Texto variante="legenda" style={{ color: corDoPapel(usuario.papel, corPrimaria) }}>
              {ROTULO_PAPEL[usuario.papel]}
            </Texto>
          </Texto>

          {ehUltimoAdministrador && (
            <Alerta>Este é o único Administrador ativo e não pode perder o cargo.</Alerta>
          )}
          {erro && <Alerta>{erro}</Alerta>}

          <View accessibilityRole="radiogroup" className="gap-2">
            {ORDEM.map((papel) => (
              <OpcaoPapel
                key={papel}
                papel={papel}
                cor={corDoPapel(papel, corPrimaria)}
                marcada={papel === selecionado}
                desabilitada={ehUltimoAdministrador && papel !== Papel.ADMINISTRADOR}
                aoEscolher={setSelecionado}
              />
            ))}
          </View>

          <View className="flex-row gap-3">
            <Botao titulo="Cancelar" variante="secundaria" className="flex-1" onPress={aoFechar} />
            <Botao
              titulo="Salvar"
              className="flex-1"
              carregando={acao.isPending}
              disabled={selecionado === usuario.papel || !acao.online}
              onPress={salvar}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

export function AlterarCargo({ usuario }: { usuario: UsuarioDetalhe }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Botao titulo="Alterar cargo" variante="secundaria" onPress={() => setAberto(true)} />
      {aberto && <AlterarCargoSheet usuario={usuario} aoFechar={() => setAberto(false)} />}
    </>
  )
}
