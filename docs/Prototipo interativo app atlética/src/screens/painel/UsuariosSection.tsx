import { useState } from 'react'
import { C } from '../../theme'
import { ROLE_LABEL, fmtFull, initials, canManageRoles, roleLevel } from '../../utils'
import { estatisticas, timesDoUsuario } from '../../domain'
import { Card, Chip, Av, Pill, IcoBack, IcoCheck, IcoAlert, IcoUsers, IcoClipboard, IcoShield } from '../../components/atoms'
import { EmptyState, Sheet } from '../../components/shared'
import { useApp } from '../../AppContext'
import type { Usuario, Role, AuditEntity } from '../../types'

const ROLE_COLORS: Record<Role, string> = {
  atleta: C.muted, diretor: C.blue, vice: C.yellow, presidente: C.yellow, admin: C.red,
}

const ROLE_ORDER: Role[] = ['atleta', 'diretor', 'vice', 'presidente', 'admin']

const ativosCom = (us: Usuario[], r: Role) => us.filter(u => u.role === r && u.ativo && !u.excluido)

// ─── Alterar cargo (UC24) ─────────────────────────────────────────────────────
function AlterarCargoSheet({ target, onClose }: { target: Usuario; onClose: () => void }) {
  const { usuarios, setUsuarios, showToast, showConfirm, audit, online } = useApp()
  const [selected, setSelected] = useState<Role>(target.role)
  // RN08: o último Administrador ativo não pode perder o cargo
  const ultimoAdmin = target.role === 'admin' && ativosCom(usuarios, 'admin').length === 1
  // RN07: no máximo um Presidente e um Vice
  const atual = (selected === 'presidente' || selected === 'vice')
    ? ativosCom(usuarios, selected).find(u => u.id !== target.id) : undefined

  function aplicar() {
    if (!online()) return
    setUsuarios(p => p.map(u => {
      if (u.id === target.id) return { ...u, role: selected }
      if (atual && u.id === atual.id) return { ...u, role: 'diretor' }
      return u
    }))
    audit('Cargos', 'Alterou cargo', `${target.nome}: ${ROLE_LABEL[target.role]} → ${ROLE_LABEL[selected]}`)
    if (atual) audit('Cargos', 'Alterou cargo', `${atual.nome}: ${ROLE_LABEL[selected]} → Diretor`)
    showToast('Cargo alterado — usuário notificado', 'success')
    onClose()
  }

  function confirmar() {
    if (ultimoAdmin && selected !== 'admin') return
    if (atual) {
      showConfirm(`Substituir ${ROLE_LABEL[selected]}`,
        `${atual.nome} é o atual ${ROLE_LABEL[selected]} e passará a Diretor. Confirmar?`, aplicar, 'Confirmar')
      return
    }
    aplicar()
  }

  return (
    <Sheet onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>Alterar cargo</h3>
        <button onClick={onClose} style={{ color: C.muted, fontSize: 18 }}>✕</button>
      </div>
      <p className="f-mono text-xs mb-3" style={{ color: C.muted }}>
        Cargo atual de <span style={{ color: C.text }}>{target.nome}</span>:{' '}
        <span style={{ color: ROLE_COLORS[target.role] }}>{ROLE_LABEL[target.role]}</span>
      </p>

      {ultimoAdmin && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-xl mb-3" style={{ background: '#450a0a', border: '1px solid rgba(244,63,94,.3)' }}>
          <IcoAlert size={14} color="#f87171" />
          <p className="f-mono text-[10px]" style={{ color: '#f87171' }}>Este é o único Administrador ativo e não pode perder o cargo.</p>
        </div>
      )}
      {atual && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-3" style={{ background: C.yellow + '15', border: `1px solid ${C.yellow}33` }}>
          <IcoAlert size={14} color={C.yellow} />
          <p className="f-mono text-[10px] leading-relaxed" style={{ color: C.yellow }}>
            {atual.nome} é o atual {ROLE_LABEL[selected]} e passará a Diretor.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 mb-5">
        {ROLE_ORDER.map(r => {
          const bloqueado = ultimoAdmin && r !== 'admin'
          return (
            <button key={r} onClick={() => !bloqueado && setSelected(r)} disabled={bloqueado}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
              style={{ background: selected === r ? ROLE_COLORS[r] + '22' : C.card2, border: `1px solid ${selected === r ? ROLE_COLORS[r] + '55' : C.bdr}`, opacity: bloqueado ? .4 : 1 }}>
              <div className="w-3 h-3 rounded-full" style={{ background: ROLE_COLORS[r] }} />
              <div className="flex-1 f-sora font-semibold text-sm" style={{ color: selected === r ? ROLE_COLORS[r] : C.text }}>
                {ROLE_LABEL[r]}
              </div>
              {selected === r && <IcoCheck size={14} color={ROLE_COLORS[r]} />}
            </button>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 rounded-2xl f-sora font-semibold text-sm"
          style={{ background: C.card2, color: C.muted, border: `1px solid ${C.bdr}` }}>Cancelar</button>
        <button onClick={confirmar} disabled={selected === target.role}
          className="flex-1 py-3 rounded-2xl f-sora font-bold text-sm"
          style={{ background: selected !== target.role ? C.red : C.dim, color: '#fff' }}>Salvar</button>
      </div>
    </Sheet>
  )
}

// ─── Detalhe do usuário (UC23 passo 3) ────────────────────────────────────────
function UserDetail({ userId, onBack }: { userId: string; onBack: () => void }) {
  const { me, usuarios, setUsuarios, times, membros, eventos, participacoes, showConfirm, showToast, audit, online } = useApp()
  const [cargoSheet, setCargoSheet] = useState(false)
  const user = usuarios.find(u => u.id === userId)
  if (!user) return null

  const isSelf = user.id === me.id
  // UC23 A1: só usuários de nível inferior (inclusive entre Presidente e Vice)
  const podeAlterar = !isSelf && !user.excluido && roleLevel(user.role) < roleLevel(me.role)
  const meusTimes = timesDoUsuario(membros, user.id).map(id => times.find(t => t.id === id)?.nome).filter(Boolean)
  const st = estatisticas(participacoes, eventos, user.id)

  function toggleAtivo() {
    const alvo = user!
    showConfirm(alvo.ativo ? 'Desativar conta' : 'Reativar conta',
      alvo.ativo ? `${alvo.nome} não poderá mais fazer login até ser reativado.` : `${alvo.nome} poderá voltar a fazer login.`,
      () => {
        if (!online()) return
        setUsuarios(p => p.map(u => u.id === alvo.id ? { ...u, ativo: !u.ativo } : u))
        audit('Usuários', alvo.ativo ? 'Desativou usuário' : 'Reativou usuário', alvo.nome)
        showToast(alvo.ativo ? 'Conta desativada' : 'Conta reativada', 'success')
      }, alvo.ativo ? 'Desativar' : 'Reativar')
  }

  const motivo = isSelf ? 'Você não pode desativar a própria conta.'
    : user.excluido ? 'Conta excluída pelo próprio usuário (dados anonimizados).'
    : 'Só é possível alterar usuários de nível de acesso inferior ao seu.'

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>Detalhes do usuário</h3>
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <Av s={initials(user.nome)} size={64} bg={user.ativo ? ROLE_COLORS[user.role] : C.dim} />
        <div className="text-center px-4">
          <h3 className="f-sora font-black text-lg" style={{ color: user.ativo ? C.text : C.muted }}>{user.nome}</h3>
          <p className="f-mono text-[10px]" style={{ color: C.muted }}>{user.email}</p>
          <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
            <Chip label={ROLE_LABEL[user.role].toUpperCase()} color={ROLE_COLORS[user.role]} />
            {meusTimes.map(n => <Chip key={n} label={n!.toUpperCase()} color={C.blue} />)}
            {!user.ativo && <Chip label={user.excluido ? 'EXCLUÍDO' : 'DESATIVADO'} color={C.muted} />}
          </div>
        </div>
      </div>

      <div className="mx-4">
        <Card pad="p-4">
          <div className="flex justify-around">
            {[
              { label: 'Jogos', v: st.jogos },
              { label: 'Treinos', v: st.treinos },
              { label: 'Presença', v: st.taxa === null ? '—' : `${st.taxa}%` },
            ].map(({ label, v }) => (
              <div key={label} className="text-center">
                <div className="f-sora font-black text-xl" style={{ color: C.red }}>{v}</div>
                <div className="f-mono text-[9px]" style={{ color: C.muted }}>{label}</div>
              </div>
            ))}
          </div>
          <p className="f-mono text-[9px] text-center mt-2" style={{ color: C.dim }}>Presenças registradas pela diretoria</p>
        </Card>
      </div>

      {!podeAlterar && (
        <div className="mx-4 flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: C.yellow + '15', border: `1px solid ${C.yellow}33` }}>
          <IcoAlert size={14} color={C.yellow} />
          <p className="f-mono text-[10px] leading-relaxed" style={{ color: C.yellow }}>{motivo}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 px-4">
        <button onClick={toggleAtivo} disabled={!podeAlterar}
          className="w-full py-3.5 rounded-2xl f-sora font-semibold text-sm active:scale-95"
          style={{ background: podeAlterar ? (user.ativo ? '#f43f5e' : C.green) : C.card2, color: podeAlterar ? '#fff' : C.dim, border: `1px solid ${C.bdr}` }}>
          {user.ativo ? 'Desativar conta' : 'Reativar conta'}
        </button>
        {canManageRoles(me.role) && !user.excluido && (
          <button onClick={() => setCargoSheet(true)}
            className="w-full py-3.5 rounded-2xl f-sora font-semibold text-sm active:scale-95"
            style={{ background: C.blue + '22', color: C.blueL, border: `1px solid ${C.bdrB}` }}>
            <span className="flex items-center justify-center gap-2">
              <IcoShield size={15} color={C.blueL} /> Alterar cargo
            </span>
          </button>
        )}
      </div>

      {cargoSheet && <AlterarCargoSheet target={user} onClose={() => setCargoSheet(false)} />}
    </div>
  )
}

// ─── Seção Usuários e Auditoria ───────────────────────────────────────────────
const AUDIT_FILTROS: ('Todos' | AuditEntity)[] = [
  'Todos', 'Eventos', 'Resultados', 'Presenças', 'Times e elencos', 'Modalidades', 'Solicitações', 'Notícias', 'Banners', 'Avisos', 'Usuários', 'Cargos',
]

export default function UsuariosSection() {
  const { usuarios, auditoria } = useApp()
  const [tab, setTab] = useState<'usuarios' | 'auditoria'>('usuarios')
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<'Todos' | Role>('Todos')
  const [selId, setSelId] = useState<string | null>(null)
  const [auditFilter, setAuditFilter] = useState<'Todos' | AuditEntity>('Todos')

  if (selId) return <UserDetail userId={selId} onBack={() => setSelId(null)} />

  const q = search.trim().toLowerCase()
  const filtered = usuarios
    .filter(u => (!q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) && (filterRole === 'Todos' || u.role === filterRole))
    .sort((a, b) => roleLevel(b.role) - roleLevel(a.role) || a.nome.localeCompare(b.nome))

  const filteredAudit = auditoria.filter(log => auditFilter === 'Todos' || log.entidade === auditFilter)
    .sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="px-4">
        <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
          {([['usuarios', 'Usuários', IcoUsers], ['auditoria', 'Auditoria', IcoClipboard]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className="py-2.5 f-sora font-semibold text-xs flex items-center justify-center gap-1.5"
              style={{ background: tab === id ? C.red : 'transparent', color: tab === id ? '#fff' : C.muted }}>
              <Icon size={12} color={tab === id ? '#fff' : C.muted} /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'usuarios' && (
        <>
          <div className="px-4">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="w-full px-4 py-2.5 rounded-xl f-sora text-sm outline-none"
              style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
          </div>
          <div className="flex gap-1.5 px-4 overflow-x-auto">
            {(['Todos', ...ROLE_ORDER] as const).map(r => (
              <Pill key={r} label={r === 'Todos' ? 'Todos' : ROLE_LABEL[r]}
                active={filterRole === r} color={r === 'Todos' ? C.muted : ROLE_COLORS[r]}
                onClick={() => setFilterRole(r)} />
            ))}
          </div>
          <div className="flex flex-col gap-2 px-4">
            {filtered.length === 0
              ? <EmptyState message="Nenhum usuário encontrado" />
              : filtered.map(u => (
                <Card key={u.id} onClick={() => setSelId(u.id)} pad="p-3">
                  <div className="flex items-center gap-3">
                    <Av s={initials(u.nome)} size={40} bg={u.ativo ? ROLE_COLORS[u.role] : C.dim} />
                    <div className="flex-1 min-w-0">
                      <div className="f-sora font-semibold text-sm truncate" style={{ color: u.ativo ? C.text : C.muted }}>{u.nome}</div>
                      <div className="f-mono text-[10px] mt-px truncate" style={{ color: C.dim }}>{u.email}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Chip label={ROLE_LABEL[u.role].toUpperCase()} color={ROLE_COLORS[u.role]} />
                      {!u.ativo && <Chip label={u.excluido ? 'EXCLUÍDO' : 'DESATIVADO'} color={C.dim} />}
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        </>
      )}

      {tab === 'auditoria' && (
        <>
          <div className="flex gap-1.5 px-4 overflow-x-auto">
            {AUDIT_FILTROS.map(t => (
              <Pill key={t} label={t} active={auditFilter === t} color={C.muted} onClick={() => setAuditFilter(t)} />
            ))}
          </div>
          <div className="flex flex-col gap-2 px-4">
            {filteredAudit.length === 0
              ? <EmptyState message="Nenhum registro" />
              : filteredAudit.map(log => (
                <Card key={log.id} pad="p-3">
                  <div className="flex items-start gap-3">
                    <Av s={initials(log.nomeUsuario)} size={36} bg={C.blue} />
                    <div className="flex-1 min-w-0">
                      <div>
                        <span className="f-sora font-semibold text-sm" style={{ color: C.text }}>{log.nomeUsuario}</span>
                        <span className="f-sora text-sm" style={{ color: C.muted }}> · {log.acao}</span>
                      </div>
                      <div className="f-mono text-[10px] mt-0.5" style={{ color: C.text }}>{log.alvo}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Chip label={log.entidade.toUpperCase()} color={C.muted} />
                        <span className="f-mono text-[10px]" style={{ color: C.dim }}>{fmtFull(log.data)}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        </>
      )}
    </div>
  )
}
