export type SecaoDocumentoLegal = { titulo: string; paragrafos: string[] }

export type DocumentoLegal = {
  titulo: string
  /** Texto provisório até a versão definitiva aprovada pelo PO. */
  provisorio: boolean
  secoes: SecaoDocumentoLegal[]
}
