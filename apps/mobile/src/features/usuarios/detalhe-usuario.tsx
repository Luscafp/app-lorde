import { formatarData, ROTULO_PAPEL, SituacaoUsuario, type UsuarioDetalhe } from '@atletica/shared'
import type { ReactNode } from 'react'
import { Alert, ScrollView, View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Botao, Cartao, Selo, Texto } from '@/components/ui'
import { paleta } from '@/features/atletica'
import { Avatar } from './componentes'
import { useAlterarSituacao, useUsuario } from './consultas'

function confirmar(usuario: UsuarioDetalhe, aoConfirmar: () => void) {
  const desativar = usuario.situacao === SituacaoUsuario.ATIVO
  Alert.alert(
    desativar ? 'Desativar conta' : 'Reativar conta',
    desativar
      ? `${usuario.nome} não poderá mais fazer login até ser reativado.`
      : `${usuario.nome} poderá voltar a fazer login.`,
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: desativar ? 'Desativar' : 'Reativar',
        style: desativar ? 'destructive' : 'default',
        onPress: aoConfirmar,
      },
    ],
  )
}

/** Ponto de entrada da #28: renderiza o "Alterar cargo" do detalhe. */
type AlterarCargo = (usuario: UsuarioDetalhe) => ReactNode

function Acoes({
  usuario,
  alterarCargo,
}: {
  usuario: UsuarioDetalhe
  alterarCargo?: AlterarCargo
}) {
  const acao = useAlterarSituacao(usuario.id)
  const { podeAlterarSituacao, motivoBloqueio, podeAlterarPapel } = usuario.permissoes

  if (usuario.situacao === SituacaoUsuario.EXCLUIDO) {
    return <Texto variante="legenda">Usuário excluído</Texto>
  }

  const ativo = usuario.situacao === SituacaoUsuario.ATIVO
  return (
    <View className="gap-2">
      <Botao
        titulo={ativo ? 'Desativar conta' : 'Reativar conta'}
        variante={ativo ? 'perigo' : 'sucesso'}
        disabled={!podeAlterarSituacao || !acao.online || acao.isPending}
        carregando={acao.isPending}
        onPress={() => confirmar(usuario, () => acao.mutate(!ativo))}
      />
      {motivoBloqueio && <Texto variante="legenda">{motivoBloqueio}</Texto>}
      {podeAlterarPapel && alterarCargo?.(usuario)}
    </View>
  )
}

function Conteudo({
  usuario,
  alterarCargo,
}: {
  usuario: UsuarioDetalhe
  alterarCargo?: AlterarCargo
}) {
  return (
    <ScrollView contentContainerClassName="gap-6 p-4">
      <View className="items-center gap-2">
        <Avatar nome={usuario.nome} fotoUrl={usuario.fotoUrl} tamanho={96} />
        <Texto variante="titulo" className="text-center">
          {usuario.nome}
        </Texto>
        <Texto variante="legenda">{usuario.email}</Texto>
        <View className="flex-row flex-wrap justify-center gap-2">
          <Selo texto={ROTULO_PAPEL[usuario.papel]} />
          {usuario.situacao === SituacaoUsuario.DESATIVADO && (
            <Selo texto="Desativado" cor={paleta.erro} />
          )}
        </View>
        <Texto variante="legenda">Membro desde {formatarData(usuario.criadoEm)}</Texto>
      </View>

      {usuario.situacao !== SituacaoUsuario.EXCLUIDO && (
        <View className="gap-2">
          <Texto variante="subtitulo">Times</Texto>
          {usuario.times.length === 0 ? (
            <Texto variante="legenda">Não participa de nenhum time.</Texto>
          ) : (
            usuario.times.map((time) => (
              <Cartao key={time.id} className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Texto className="font-semibold">{time.nome}</Texto>
                  <Texto variante="legenda">{time.modalidade.nome}</Texto>
                </View>
                {time.capitao && <Selo texto="Capitão" />}
              </Cartao>
            ))
          )}
        </View>
      )}

      <Acoes usuario={usuario} alterarCargo={alterarCargo} />
    </ScrollView>
  )
}

export function DetalheUsuario({ id, alterarCargo }: { id: string; alterarCargo?: AlterarCargo }) {
  const consulta = useUsuario(id)
  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(usuario) => <Conteudo usuario={usuario} alterarCargo={alterarCargo} />}
      </TelaDados>
    </View>
  )
}
