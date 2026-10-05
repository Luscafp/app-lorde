import { ehPresidencia, type Modalidade } from '@atletica/shared'
import { router } from 'expo-router'
import { Alert, View } from 'react-native'
import { EstadoVazio, TelaDados } from '@/components/estado'
import { Botao, toast } from '@/components/ui'
import {
  ListaModalidadesPainel,
  useAtualizarModalidade,
  useExcluirModalidade,
  useModalidades,
} from '@/features/modalidades'
import { useSessao } from '@/infra/sessao/store'

const novaModalidade = () => router.push('/painel/modalidades/nova')

export default function ModalidadesPainel() {
  const consulta = useModalidades({ incluirInativas: true })
  const podeExcluir = useSessao((estado) => !!estado.usuario && ehPresidencia(estado.usuario.papel))
  const alternar = useAtualizarModalidade()
  const excluir = useExcluirModalidade()
  const definirAtiva = (modalidade: Modalidade, ativa: boolean) =>
    alternar.mutate({ id: modalidade.id, dados: { ativa } })
  const desativar = (modalidade: Modalidade) => definirAtiva(modalidade, false)

  function aoAlternar(modalidade: Modalidade, ativa: boolean) {
    if (ativa) return definirAtiva(modalidade, true)
    Alert.alert(`Desativar ${modalidade.nome}?`, 'Ela deixará de aparecer na aba Times.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desativar', style: 'destructive', onPress: () => desativar(modalidade) },
    ])
  }

  function confirmarExclusao(modalidade: Modalidade) {
    excluir.mutate(modalidade.id, {
      onSuccess: () => toast.sucesso('Modalidade excluída'),
      onError: (erro) => {
        if (erro.code !== 'MODALIDADE_COM_DEPENDENCIAS') return
        toast.erro(erro.message, { rotulo: 'Desativar', aoTocar: () => desativar(modalidade) })
      },
    })
  }

  function aoExcluir(modalidade: Modalidade) {
    Alert.alert(`Excluir ${modalidade.nome}?`, 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => confirmarExclusao(modalidade) },
    ])
  }

  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="lista">
        {(modalidades) =>
          modalidades.length === 0 ? (
            <EstadoVazio
              mensagem="Nenhuma modalidade cadastrada"
              acao={{ titulo: 'Nova modalidade', onPress: novaModalidade }}
            />
          ) : (
            <>
              <View className="px-4 pt-4">
                <Botao titulo="Nova modalidade" onPress={novaModalidade} />
              </View>
              <ListaModalidadesPainel
                modalidades={modalidades}
                podeExcluir={podeExcluir}
                acoesHabilitadas={alternar.online && !alternar.isPending && !excluir.isPending}
                aoEditar={({ id }) => router.push(`/painel/modalidades/${id}`)}
                aoAlternar={aoAlternar}
                aoExcluir={aoExcluir}
              />
            </>
          )
        }
      </TelaDados>
    </View>
  )
}
