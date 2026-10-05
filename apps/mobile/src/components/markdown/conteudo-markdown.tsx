import * as WebBrowser from 'expo-web-browser'
import { StyleSheet, Text } from 'react-native'
import Markdown, { MarkdownIt, type RenderRules } from 'react-native-markdown-display'
import { paleta } from '@/features/atletica'

/** Subconjunto do Markdown restrito (convenções §10.8): sem HTML, títulos, imagens ou código. */
const parser = MarkdownIt('zero').enable(['emphasis', 'list', 'link', 'newline', 'escape'])

const LINK_HTTPS = /^https:\/\/[^\s/?#@]+\.[^\s/?#@]+(?:[/?#]\S*)?$/i

function ehLinkSeguro(url: string): boolean {
  return LINK_HTTPS.test(url.trim())
}

function abrir(url: string) {
  void WebBrowser.openBrowserAsync(url)
}

/** Link não `https://` vira texto comum: nunca abre `javascript:`, `http:` ou esquemas do app. */
const regras: RenderRules = {
  link: (node, children) => {
    const href = String(node.attributes.href ?? '')
    if (!ehLinkSeguro(href)) return <Text key={node.key}>{children}</Text>
    return (
      <Text
        key={node.key}
        accessibilityRole="link"
        accessibilityHint="Abre no navegador"
        style={estilos.link}
        onPress={() => abrir(href)}
      >
        {children}
      </Text>
    )
  },
}

export function ConteudoMarkdown({ conteudo }: { conteudo: string }) {
  return (
    <Markdown markdownit={parser} rules={regras} style={estilos} onLinkPress={() => false}>
      {conteudo}
    </Markdown>
  )
}

const estilos = StyleSheet.create({
  body: { color: paleta.texto, fontSize: 16, lineHeight: 24 },
  paragraph: { marginTop: 0, marginBottom: 12 },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  link: { color: paleta.texto, textDecorationLine: 'underline', fontWeight: '600' },
  bullet_list: { marginBottom: 12 },
  ordered_list: { marginBottom: 12 },
  list_item: { marginBottom: 4 },
  bullet_list_icon: { color: paleta['texto-suave'] },
  ordered_list_icon: { color: paleta['texto-suave'] },
})
