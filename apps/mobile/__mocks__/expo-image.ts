import { createElement } from 'react'
import { View, type ViewProps } from 'react-native'

/** A view nativa do `expo-image` não roda no Jest; as props ficam visíveis aos testes. */
export function Image(props: ViewProps) {
  return createElement(View, props)
}
