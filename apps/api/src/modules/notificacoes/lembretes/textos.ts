import { formatarHora } from '@atletica/shared'
import type { TipoEvento } from '../../../generated/prisma/client'
import { formatarDiaMes } from '../envio/mensagens'

export interface EventoDoTexto {
  tipo: TipoEvento
  inicio: Date
  local: string
  time: { nome: string }
}

interface Texto {
  titulo: string
  corpo: string
}

const NOME_TIPO: Record<TipoEvento, string> = { JOGO: 'jogo', TREINO: 'treino' }

/** Épico #36 §3.3, linha "Lembrete". */
export function textoLembrete(evento: EventoDoTexto, horas: number): Texto {
  return {
    titulo: `Lembrete: ${NOME_TIPO[evento.tipo]} em ${horas} h`,
    corpo: `${evento.time.nome} · ${formatarHora(evento.inicio)} · ${evento.local}`,
  }
}

/** Épico #36 §3.3, linha "Confirmação pendente". */
export function textoConfirmacaoPendente(evento: EventoDoTexto): Texto {
  const { inicio } = evento
  return {
    titulo: 'Você vai?',
    corpo: `Confirme presença no ${NOME_TIPO[evento.tipo]} de ${evento.time.nome} em ${formatarDiaMes(inicio)} às ${formatarHora(inicio)}.`,
  }
}
