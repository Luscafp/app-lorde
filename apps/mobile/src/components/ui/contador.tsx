import { Texto } from './texto'

const formatarTotal = (total: number) => String(total).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** Caracteres usados de um campo com limite (ex.: `12/65`). */
export function Contador({ atual, maximo }: { atual: number; maximo: number }) {
  return (
    <Texto variante="legenda" className="text-right">
      {`${formatarTotal(atual)}/${formatarTotal(maximo)}`}
    </Texto>
  )
}
