import { paginacaoQuerySchema } from '@atletica/shared'
import { StyleSheet, Text, View } from 'react-native'
import { ambiente } from '@/config/ambiente'

// Tela provisória: substituída pelos grupos (publico) e (app)/(abas) na #51.
const paginacaoPadrao = paginacaoQuerySchema.parse({})

export default function Inicio() {
  return (
    <View style={estilos.container}>
      <Text style={estilos.titulo}>Atlética</Text>
      <Text>
        Paginação padrão: página {paginacaoPadrao.page}, {paginacaoPadrao.limit} itens
      </Text>
      <Text>Ambiente: {ambiente.nome}</Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  titulo: { fontSize: 24, fontWeight: '600' },
})
