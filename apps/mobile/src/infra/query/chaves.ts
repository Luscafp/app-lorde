export type Filtros = Record<string, unknown>

const me = Object.assign(() => ['me'] as const, {
  estatisticas: () => ['me', 'estatisticas'] as const,
  preferencias: () => ['me', 'preferencias-notificacao'] as const,
})

export const chaves = {
  atletica: () => ['atletica'] as const,
  me,
  modalidades: (f?: Filtros) => ['modalidades', f] as const,
  times: {
    todos: () => ['times'] as const,
    lista: (f: Filtros) => ['times', 'lista', f] as const,
    detalhe: (id: string) => ['times', 'detalhe', id] as const,
    elenco: (id: string) => ['times', 'detalhe', id, 'elenco'] as const,
  },
  eventos: {
    todos: () => ['eventos'] as const,
    lista: (f: Filtros) => ['eventos', 'lista', f] as const,
    detalhe: (id: string) => ['eventos', 'detalhe', id] as const,
    presencas: (id: string) => ['eventos', 'detalhe', id, 'presencas'] as const,
  },
  noticias: {
    todos: () => ['noticias'] as const,
    lista: (f: Filtros) => ['noticias', 'lista', f] as const,
    detalhe: (id: string) => ['noticias', 'detalhe', id] as const,
  },
  tags: (f: Filtros) => ['tags', f] as const,
  banners: () => ['banners'] as const,
  solicitacoes: (f: Filtros) => ['solicitacoes', f] as const,
  painel: {
    todos: () => ['painel'] as const,
    noticias: {
      lista: (f: Filtros) => ['painel', 'noticias', 'lista', f] as const,
      detalhe: (id: string) => ['painel', 'noticias', 'detalhe', id] as const,
    },
    banners: {
      lista: () => ['painel', 'banners', 'lista'] as const,
      detalhe: (id: string) => ['painel', 'banners', 'detalhe', id] as const,
    },
    adversarias: {
      lista: (f: Filtros) => ['painel', 'atleticas-adversarias', 'lista', f] as const,
      detalhe: (id: string) => ['painel', 'atleticas-adversarias', 'detalhe', id] as const,
    },
    alcanceAviso: (f: Filtros) => ['painel', 'avisos', 'alcance', f] as const,
  },
  usuarios: {
    todos: () => ['usuarios'] as const,
    lista: (f: Filtros) => ['usuarios', 'lista', f] as const,
    detalhe: (id: string) => ['usuarios', 'detalhe', id] as const,
  },
  auditoria: (f: Filtros) => ['auditoria', f] as const,
}
