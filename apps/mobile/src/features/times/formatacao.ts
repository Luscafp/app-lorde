export const rotuloAtletica = ({ nome, sigla }: { nome: string; sigla: string | null }) =>
  sigla ? `${nome} (${sigla})` : nome

export const contar = (total: number, singular: string, plural: string) =>
  `${total} ${total === 1 ? singular : plural}`
