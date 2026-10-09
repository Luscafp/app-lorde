import {
  alteracoesDaAuditoria,
  formatarDataHora,
  rotuloAcao,
  type RegistroAuditoriaDetalhe,
} from '@atletica/shared'
import { ScrollView, View } from 'react-native'
import { TelaDados } from '@/components/estado'
import { Cartao, Texto } from '@/components/ui'
import { descricaoDoRegistro, nomeDoAutor, TabelaAlteracoes } from './componentes'
import { useRegistroAuditoria } from './consultas'

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View className="gap-0.5">
      <Texto variante="legenda">{rotulo}</Texto>
      <Texto>{valor}</Texto>
    </View>
  )
}

function Conteudo({ registro }: { registro: RegistroAuditoriaDetalhe }) {
  const { usuarios, registros } = registro.referencias
  const alteracoes = alteracoesDaAuditoria(registro.dados, { ...usuarios, ...registros })
  return (
    <ScrollView contentContainerClassName="gap-4 p-4">
      <Texto variante="titulo">{rotuloAcao(registro.acao)}</Texto>
      <Cartao className="gap-3">
        <Linha rotulo="Registro" valor={descricaoDoRegistro(registro)} />
        <Linha rotulo="Autor" valor={nomeDoAutor(registro.autor)} />
        <Linha rotulo="Data e horário" valor={formatarDataHora(registro.criadoEm)} />
      </Cartao>
      {alteracoes ? (
        <>
          <View className="gap-2">
            <Texto variante="subtitulo">Alterações</Texto>
            {alteracoes.alteracoes.length > 0 ? (
              <TabelaAlteracoes alteracoes={alteracoes.alteracoes} />
            ) : (
              <Texto variante="legenda">Sem campos alterados.</Texto>
            )}
          </View>
          {alteracoes.contexto.length > 0 && (
            <View className="gap-2">
              <Texto variante="subtitulo">Contexto</Texto>
              <Cartao className="gap-3">
                {alteracoes.contexto.map(({ campo, rotulo, valor }) => (
                  <Linha key={campo} rotulo={rotulo} valor={valor} />
                ))}
              </Cartao>
            </View>
          )}
        </>
      ) : (
        <View className="gap-2">
          <Texto variante="subtitulo">Dados</Texto>
          <Cartao>
            <Texto className="font-mono text-sm">{JSON.stringify(registro.dados, null, 2)}</Texto>
          </Cartao>
        </View>
      )}
    </ScrollView>
  )
}

export function DetalheAuditoria({ id }: { id: string }) {
  const consulta = useRegistroAuditoria(id)
  return (
    <View className="flex-1 bg-fundo">
      <TelaDados consulta={consulta} esqueleto="detalhe">
        {(registro) => <Conteudo registro={registro} />}
      </TelaDados>
    </View>
  )
}
