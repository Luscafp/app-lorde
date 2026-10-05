import type { AtleticaPublica } from '@atletica/shared'
import * as Application from 'expo-application'
import * as Updates from 'expo-updates'
import { Linking, ScrollView, View } from 'react-native'
import { z } from 'zod'
import { TelaDados } from '@/components/estado'
import { Imagem } from '@/components/imagem'
import { Texto } from '@/components/ui'
import { useConsultaAtletica } from '@/features/atletica'
import { SecaoConfiguracoes, type PropsItemConfiguracao } from './secao-configuracoes'

export const MENSAGEM_SEM_CONTATO = 'Contato não informado'

const CANAL_PRODUCAO = 'production'

export function versaoInstalada(): string {
  const { nativeApplicationVersion: versao, nativeBuildVersion: build } = Application
  if (!versao) return 'Desconhecida'
  return build ? `${versao} (build ${build})` : versao
}

/** Identifica o OTA para o suporte; o canal só aparece fora de produção. */
export function atualizacaoInstalada(): string | null {
  const id = Updates.updateId?.slice(0, 8)
  if (!id) return null
  const canal = Updates.channel
  return canal && canal !== CANAL_PRODUCAO ? `Atualização ${id} · ${canal}` : `Atualização ${id}`
}

/** Só monta `mailto:` com e-mail válido: um cadastro errado não abre esquemas arbitrários. */
function itemEmail(email: string | null): PropsItemConfiguracao {
  if (!email || !z.email().safeParse(email).success) {
    return { icone: 'mail-outline', rotulo: MENSAGEM_SEM_CONTATO }
  }
  return {
    icone: 'mail-outline',
    rotulo: email,
    onPress: () => void Linking.openURL(`mailto:${email}`),
  }
}

function DadosAtletica({ atletica }: { atletica: AtleticaPublica }) {
  const contatos: PropsItemConfiguracao[] = [itemEmail(atletica.contatoEmail)]
  if (atletica.contatoWhatsapp) {
    contatos.push({ icone: 'logo-whatsapp', rotulo: atletica.contatoWhatsapp })
  }
  if (atletica.contatoInstagram) {
    contatos.push({ icone: 'logo-instagram', rotulo: atletica.contatoInstagram })
  }

  return (
    <View className="gap-6">
      <View className="items-center gap-2">
        <Imagem
          uri={atletica.logoUrl}
          nome={atletica.sigla ?? atletica.nome}
          rotulo={`Logo de ${atletica.nome}`}
          className="h-24 w-24 rounded-2xl"
        />
        <Texto variante="subtitulo" className="text-center">
          {atletica.nome}
        </Texto>
        {atletica.sigla && <Texto variante="legenda">{atletica.sigla}</Texto>}
        {atletica.curso && <Texto variante="legenda">{atletica.curso}</Texto>}
      </View>
      <SecaoConfiguracoes titulo="Contato da diretoria" itens={contatos} />
    </View>
  )
}

export function TelaSobre() {
  const consulta = useConsultaAtletica()
  const atualizacao = atualizacaoInstalada()

  return (
    <ScrollView contentContainerClassName="flex-grow gap-6 pb-4">
      <View className="min-h-[200px]">
        <TelaDados consulta={consulta} esqueleto="detalhe">
          {(atletica) => (
            <View className="px-4 pt-4">
              <DadosAtletica atletica={atletica} />
            </View>
          )}
        </TelaDados>
      </View>
      <View className="gap-1 px-4">
        <SecaoConfiguracoes
          titulo="Aplicativo"
          itens={[
            { icone: 'phone-portrait-outline', rotulo: 'Versão', valorDireita: versaoInstalada() },
          ]}
        />
        {atualizacao && (
          <Texto variante="legenda" className="px-1 text-xs">
            {atualizacao}
          </Texto>
        )}
      </View>
    </ScrollView>
  )
}
