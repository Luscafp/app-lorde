import { useState } from 'react'
import { C } from '../../theme'
import { ROLE_LABEL, fmtFull, initials, canManageRoles, getMeByRole } from '../../utils'
import { Card, Chip, Av, Pill, IcoBack, IcoCheck, IcoAlert, IcoUsers, IcoClipboard, IcoShield } from '../../components/atoms'
import { EmptyState } from '../../components/shared'
import { useApp } from '../../AppContext'
import type { Usuario, Role } from '../../types'

const ROLE_COLORS: Record<Role, string> = {
  atleta: C.muted, diretor: C.blue, vice: C.blue, presidente: C.yellow, admin: C.red,
}

const ROLE_ORDER: Role[] = ['atleta', 'diretor', 'vice', 'presidente', 'admin']

function roleLevel(r: Role): number {
  return ({ atleta: 0, diretor: 1, vice: 2, presidente: 2, admin: 3 } as Record<Role, number>)[r]
}

// ─── Alterar cargo sheet ──────────────────────────────────────────────────────
function AlterarCargoSheet({ target, allUsers, onSave, onClose }:
  { target: Usuario; allUsers: Usuario[]; onSave: (id: string, role: Role) => void; onClose: () => void }) {
  const { showToast } = useApp()
  const [selectedRole, setSelectedRole] = useState<Role>(target.role)
  const [conflictMsg, setConflictMsg] = useState<string | null>(null)

  const isLastAdmin = allUsers.filter(u => u.role === 'admin' && u.ativo).length === 1 && target.role === 'admin'

  function tryAssign(r: Role) {
    if (isLastAdmin && target.role === 'admin' && r !== 'admin') {
      setConflictMsg('Não é possível: este é o único Administrador ativo.')
      setSelectedRole(target.role)
      return
    }
    setConflictMsg(null)
    setSelectedRole(r)
  }

  // Conflict detection for presidente/vice
  const conflictUser = selectedRole === 'presidente' || selectedRole === 'vice'
    ? allUsers.find(u => u.id !== target.id && u.role === selectedRole && u.ativo)
    : null

  function confirm() {
    if (isLastAdmin && target.role === 'admin' && selectedRole !== 'admin') {
      showToast('Não é possível remover o último administrador', 'error')
      return
    }
    onSave(target.id, selectedRole)
    showToast('Cargo alterado — usuário notificado', 'success')
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full rounded-t-3xl p-5 a-up" style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="f-sora font-black text-base" style={{ color: C.text }}>Alterar cargo</h3>
          <button onClick={onClose}><span style={{ color: C.muted, fontSize: 18 }}>✕</span></button>
        </div>
        <p className="f-mono text-xs mb-3" style={{ color: C.muted }}>
          Cargo atual de <span style={{ color: C.text }}>{target.nome.split(' ')[0]}</span>:{' '}
          <span style={{ color: ROLE_COLORS[target.role] }}>{ROLE_LABEL[target.role]}</span>
        </p>

        {conflictMsg && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3" style={{ background: '#450a0a', border: '1px solid rgba(244,63,94,.3)' }}>
            <IcoAlert size={14} color="#f87171" />
            <p className="f-mono text-[10px]" style={{ color: '#f87171' }}>{conflictMsg}</p>
          </div>
        )}

        {conflictUser && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-3" style={{ background: C.yellow + '15', border: `1px solid ${C.yellow}33` }}>
            <IcoAlert size={14} color={C.yellow} />
            <p className="f-mono text-[10px] leading-relaxed" style={{ color: C.yellow }}>
              {conflictUser.nome} é o {ROLE_LABEL[selectedRole]} atual e passará a ser Diretor. Confirmar?
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 mb-5">
          {ROLE_ORDER.map(r => (
            <button key={r} onClick={() => tryAssign(r)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
              style={{ background: selectedRole === r ? ROLE_COLORS[r] + '22' : C.card2, border: `1px solid ${selectedRole === r ? ROLE_COLORS[r] + '55' : C.bdr}` }}>
              <div className="w-3 h-3 rounded-full" style={{ background: ROLE_COLORS[r] }} />
              <div className="flex-1">
                <div className="f-sora font-semibold text-sm" style={{ color: selectedRole === r ? ROLE_COLORS[r] : C.text }}>
                  {ROLE_LABEL[r]}
                </div>
              </div>
              {selectedRole === r && <IcoCheck size={14} color={ROLE_COLORS[r]} />}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl f-sora font-semibold text-sm"
            style={{ background: C.card2, color: C.muted, border: `1px solid ${C.bdr}` }}>Cancelar</button>
          <button onClick={confirm} disabled={selectedRole === target.role}
            className="flex-1 py-3 rounded-2xl f-sora font-bold text-sm"
            style={{ background: selectedRole !== target.role ? C.red : C.dim, color: '#fff' }}>Confirmar</button>
        </div>
      </div>
    </div>
  )
}

// ─── User detail ──────────────────────────────────────────────────────────────
function UserDetail({ user, allUsers, myRole, onBack, onToggleAtivo, onChangeRole }:
  { user: Usuario; allUsers: Usuario[]; myRole: Role; onBack: () => void; onToggleAtivo: (id: string) => void; onChangeRole: (id: string, r: Role) => void }) {
  const { showConfirm, showToast, times: TIMES, eventos } = useApp()
  const [showRoleSheet, setShowRoleSheet] = useState(false)
  const myTime = TIMES.find(t => t.id === user.timeId)

  const isSelf = user.id === getMeByRole(myRole).id
  const canToggle = !isSelf && roleLevel(user.role) < roleLevel(myRole)
  const canRole   = canManageRoles(myRole)

  function handleToggle() {
    if (!canToggle) { showToast('Você não pode alterar usuários de nível igual ou superior', 'error'); return }
    showConfirm(
      user.ativo ? 'Desativar conta' : 'Reativar conta',
      `${user.ativo ? 'Desativar' : 'Reativar'} a conta de ${user.nome}?`,
      () => onToggleAtivo(user.id)
    )
  }

  const memberTimes = TIMES.filter(t => t.atletas?.includes(user.nome) || t.capitao === user.nome || t.id === user.timeId)
  const memberTimeIds = new Set(memberTimes.map(t => t.id))
  const stats = [
    { label: 'Jogos',   v: eventos.filter(e => memberTimeIds.has(e.timeLordeId) && e.tipo === 'JOGO').length },
    { label: 'Treinos', v: eventos.filter(e => memberTimeIds.has(e.timeLordeId) && e.tipo === 'TREINO').length },
    { label: 'Cargo',   v: ROLE_LABEL[user.role] },
  ]

  return (
    <div className="flex flex-col gap-4 pb-6 a-up relative">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>Detalhes do usuário</h3>
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center gap-3 py-4">
        <Av s={initials(user.nome)} size={64} bg={user.ativo ? ROLE_COLORS[user.role] : C.dim} />
        <div className="text-center">
          <h3 className="f-sora font-black text-lg" style={{ color: user.ativo ? C.text : C.muted }}>{user.nome}</h3>
          <p className="f-mono text-[10px]" style={{ color: C.muted }}>{user.email}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Chip label={ROLE_LABEL[user.role]} color={ROLE_COLORS[user.role]} />
            {myTime && <Chip label={myTime.nome} color={C.blue} />}
            {!user.ativo && <Chip label="INATIVO" color={C.muted} />}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-4">
        <Card pad="p-4">
          <div className="flex justify-around">
            {stats.map(({ label, v }) => (
              <div key={label} className="text-center">
                <div className="f-sora font-black text-xl" style={{ color: C.red }}>{v}</div>
                <div className="f-mono text-[9px]" style={{ color: C.muted }}>{label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Permission warning */}
      {!canToggle && (
        <div className="mx-4 flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: C.yellow + '15', border: `1px solid ${C.yellow}33` }}>
          <IcoAlert size={14} color={C.yellow} />
          <p className="f-mono text-[10px] leading-relaxed" style={{ color: C.yellow }}>
            {isSelf ? 'Você não pode desativar a própria conta.' : 'Só é possível alterar usuários de nível inferior ao seu.'}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 px-4">
        <button onClick={handleToggle}
          className="w-full py-3.5 rounded-2xl f-sora font-semibold text-sm active:scale-95"
          style={{
            background: (user.ativo ? '#f43f5e' : C.green) + (canToggle ? '' : '44'),
            color: canToggle ? '#fff' : C.muted,
            opacity: canToggle ? 1 : .6,
          }}>
          {user.ativo ? 'Desativar conta' : 'Reativar conta'}
        </button>
        {canRole && (
          <button onClick={() => setShowRoleSheet(true)}
            className="w-full py-3.5 rounded-2xl f-sora font-semibold text-sm active:scale-95"
            style={{ background: C.blue + '22', color: C.blueL, border: `1px solid ${C.bdrB}` }}>
            <span className="flex items-center justify-center gap-2">
              <IcoShield size={15} color={C.blueL} /> Alterar cargo
            </span>
          </button>
        )}
      </div>

      {showRoleSheet && (
        <AlterarCargoSheet
          target={user}
          allUsers={allUsers}
          onSave={(id, role) => { onChangeRole(id, role); setShowRoleSheet(false) }}
          onClose={() => setShowRoleSheet(false)}
        />
      )}
    </div>
  )
}

// ─── Main UsuariosSection ─────────────────────────────────────────────────────
export default function UsuariosSection() {
  const {
    role: myRole, showToast, usuarios, setUsuarios, auditoria: AUDIT_LOG,
    audit, times: TIMES,
  } = useApp()
  const [tab, setTab] = useState<'usuarios' | 'auditoria'>('usuarios')
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<'Todos' | Role>('Todos')
  const [selected, setSelected] = useState<Usuario | null>(null)
  const [auditFilter, setAuditFilter] = useState('Todos')

  function toggleAtivo(id: string) {
    setUsuarios(p => p.map(u => u.id === id ? { ...u, ativo: !u.ativo } : u))
    const u = usuarios.find(x => x.id === id)
    if (u) audit('Usuários', u.ativo ? 'Desativou usuário' : 'Reativou usuário', u.nome)
    showToast(u?.ativo ? 'Conta desativada' : 'Conta reativada!', u?.ativo ? 'error' : 'success')
  }

  function changeRole(id: string, role: Role) {
    setUsuarios(p => {
      let updated = p.map(u => u.id === id ? { ...u, role } : u)
      // Downgrade conflicting presidente/vice
      if (role === 'presidente' || role === 'vice') {
        updated = updated.map(u => u.id !== id && u.role === role ? { ...u, role: 'diretor' } : u)
      }
      return updated
    })
    const user = usuarios.find(u => u.id === id)
    if (user) audit('Cargos', 'Alterou cargo', `${user.nome} → ${ROLE_LABEL[role]}`)
  }

  if (selected) {
    const live = usuarios.find(u => u.id === selected.id) ?? selected
    return (
      <UserDetail
        user={live}
        allUsers={usuarios}
        myRole={myRole}
        onBack={() => setSelected(null)}
        onToggleAtivo={toggleAtivo}
        onChangeRole={changeRole}
      />
    )
  }

  const filtered = usuarios.filter(u => {
    const matchSearch = !search || u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === 'Todos' || u.role === filterRole
    return matchSearch && matchRole
  })

  const auditTypes = ['Todos', 'Eventos', 'Resultados', 'Presenças', 'Times e elencos', 'Modalidades', 'Solicitações', 'Notícias', 'Banners', 'Usuários', 'Cargos']
  const filteredAudit = AUDIT_LOG.filter(log => auditFilter === 'Todos' || log.entidade === auditFilter)
    .sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="px-4">
        <div className="grid grid-cols-2 rounded-xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
          <button onClick={() => setTab('usuarios')}
            className="py-2.5 f-sora font-semibold text-xs flex items-center justify-center gap-1.5"
            style={{ background: tab === 'usuarios' ? C.red : 'transparent', color: tab === 'usuarios' ? '#fff' : C.muted }}>
            <IcoUsers size={12} color={tab === 'usuarios' ? '#fff' : C.muted} /> Usuários
          </button>
          <button onClick={() => setTab('auditoria')}
            className="py-2.5 f-sora font-semibold text-xs flex items-center justify-center gap-1.5"
            style={{ background: tab === 'auditoria' ? C.red : 'transparent', color: tab === 'auditoria' ? '#fff' : C.muted }}>
            <IcoClipboard size={12} color={tab === 'auditoria' ? '#fff' : C.muted} /> Auditoria
          </button>
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
            {(['Todos', ...ROLE_ORDER] as ('Todos' | Role)[]).map(r => (
              <Pill key={r} label={r === 'Todos' ? 'Todos' : ROLE_LABEL[r as Role]}
                active={filterRole === r} color={r === 'Todos' ? C.muted : ROLE_COLORS[r as Role]}
                onClick={() => setFilterRole(r as 'Todos' | Role)} />
            ))}
          </div>
          <div className="flex flex-col gap-2 px-4">
            {filtered.length === 0
              ? <EmptyState message="Nenhum usuário encontrado" />
              : filtered.map(u => (
                <Card key={u.id} onClick={() => setSelected(u)} pad="p-3">
                  <div className="flex items-center gap-3">
                    <Av s={initials(u.nome)} size={40}
                      bg={u.ativo ? ROLE_COLORS[u.role] : C.dim} />
                    <div className="flex-1 min-w-0">
                      <div className="f-sora font-semibold text-sm" style={{ color: u.ativo ? C.text : C.muted }}>{u.nome}</div>
                      <div className="f-mono text-[10px] mt-px" style={{ color: C.dim }}>{u.email}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Chip label={ROLE_LABEL[u.role]} color={ROLE_COLORS[u.role]} />
                      {!u.ativo && <Chip label="OFF" color={C.dim} />}
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
            {auditTypes.map(t => (
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
                    <div className="flex-1">
                      <div>
                        <span className="f-sora font-semibold text-sm" style={{ color: C.text }}>{log.nomeUsuario}</span>
                        <span className="f-sora text-sm" style={{ color: C.muted }}> {log.acao}</span>
                      </div>
                      <div className="f-mono text-[10px] mt-0.5" style={{ color: C.dim }}>
                        {log.entidade} · {log.alvo} · {fmtFull(log.data)}
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
