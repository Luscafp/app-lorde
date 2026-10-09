import type { PrismaService } from '../../infra/prisma/prisma.service'
import { idsCitados, ReferenciasAuditoria } from './referencias'

const ANA = '7c2e4b9a-1d3f-4a5b-8c6d-0e1f2a3b4c5d'
const EXCLUIDO = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const EVENTO = '3e7d9c1b-5a4f-4e2d-8b6a-9c0d1e2f3a4b'
const MEMBRO = 'a1a1a1a1-0000-4000-8000-000000000001'

const vazio = () => ({ findMany: jest.fn().mockResolvedValue([]) })

function criar() {
  const futsal = { nome: 'Futsal' }
  const db = {
    vinculoAtletica: {
      findMany: jest.fn().mockResolvedValue([
        { usuarioId: ANA, usuario: { nome: 'Ana', excluidoEm: null } },
        { usuarioId: EXCLUIDO, usuario: { nome: 'Usuário excluído', excluidoEm: new Date() } },
      ]),
    },
    evento: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: EVENTO,
          tipo: 'JOGO',
          inicio: new Date('2026-10-12T22:00:00.000Z'),
          time: futsal,
        },
      ]),
    },
    membroTime: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: MEMBRO, usuario: { nome: 'Zé', excluidoEm: new Date() }, time: futsal },
        ]),
    },
    time: vazio(),
    serieRecorrencia: vazio(),
    solicitacaoEntrada: vazio(),
    modalidade: vazio(),
    atletica: vazio(),
    noticia: vazio(),
    banner: vazio(),
  }
  return { referencias: new ReferenciasAuditoria({ db } as unknown as PrismaService), db }
}

describe('idsCitados', () => {
  it('coleta UUIDs em qualquer nível, em minúsculas', () => {
    const dados = {
      antes: null,
      depois: { capitaoId: ANA.toUpperCase(), nome: 'Futsal' },
      contexto: { presentes: [EXCLUIDO], evento: { id: EVENTO } },
    }
    expect(idsCitados(dados)).toEqual(new Set([ANA, EXCLUIDO, EVENTO]))
  })
})

describe('ReferenciasAuditoria.resolver', () => {
  it('usuários separados dos demais registros; anonimizado vira "Usuário excluído"', async () => {
    const { referencias } = criar()
    expect(await referencias.resolver([ANA, EXCLUIDO, EVENTO, MEMBRO])).toEqual({
      usuarios: { [ANA]: 'Ana', [EXCLUIDO]: 'Usuário excluído' },
      registros: {
        [EVENTO]: 'Jogo Futsal 12/10/2026 19:00',
        [MEMBRO]: 'Usuário excluído · Futsal',
      },
    })
  })

  it('sem ids não consulta o banco', async () => {
    const { referencias, db } = criar()
    expect(await referencias.resolver([])).toEqual({ usuarios: {}, registros: {} })
    expect(db.vinculoAtletica.findMany).not.toHaveBeenCalled()
  })
})
