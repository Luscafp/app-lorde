import { useState } from 'react'
import { C, ATLETICA } from '../theme'
import { EVENTOS, TIMES, MODALIDADES } from '../data'
import { ROLE_LABEL, canAccessPanel, getMeByRole, fmtCard, initials } from '../utils'
import { Card, SH, Chip, Av, Toggle, IcoBell, IcoCode, IcoShield, IcoUser, IcoCheck, IcoX, IcoPlus, IcoBack, IcoAlert } from '../components/atoms'
import { useApp } from '../AppContext'

type PView = 'main' | 'settings' | 'edit-profile' | 'change-password' | 'notif-settings' | 'about' | 'delete-account'

// ─── Chevron right icon (inline) ─────────────────────────────────────────────
function ChevR() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: 'rgba(107,114,128,.5)' }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

function IcoEye({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

// ─── Sub-page header ─────────────────────────────────────────────────────────
function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.bdr}` }}>
      <button onClick={onBack}
        className="flex items-center justify-center rounded-xl"
        style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}>
        <IcoBack />
      </button>
      <h2 className="f-sora font-black text-lg" style={{ color: C.text }}>{title}</h2>
    </div>
  )
}

// ─── Edit profile ─────────────────────────────────────────────────────────────
function EditProfile({ nome: initNome, onBack }: { nome: string; onBack: () => void }) {
  const { showToast } = useApp()
  const [nome, setNome] = useState(initNome)
  return (
    <div className="flex flex-col h-full a-up">
      <SubHeader title="Editar perfil" onBack={onBack} />
      <div className="flex flex-col gap-5 px-4 pt-5 flex-1">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Av s={initials(nome)} size={80} bg={`linear-gradient(135deg,${C.red},${C.redD})`} />
            <button className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full"
              style={{ width: 28, height: 28, background: C.blue, border: `2px solid ${C.bg}` }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.5}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          </div>
          <p className="f-mono text-[10px]" style={{ color: C.muted }}>Toque para alterar a foto</p>
        </div>
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: C.muted }}>Nome</label>
          <input value={nome} onChange={e => setNome(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl f-sora text-sm outline-none"
            style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
        </div>
        <button onClick={() => { showToast('Perfil atualizado!', 'success'); onBack() }}
          className="w-full py-4 rounded-2xl f-sora font-bold text-sm active:scale-95"
          style={{ background: C.red, color: '#fff', boxShadow: '0 4px 20px rgba(225,29,72,.4)' }}>
          Salvar alterações
        </button>
      </div>
    </div>
  )
}

// ─── Change password ──────────────────────────────────────────────────────────
function ChangePassword({ onBack }: { onBack: () => void }) {
  const { showToast } = useApp()
  const [cur, setCur]   = useState('')
  const [nw, setNw]     = useState('')
  const [conf, setConf] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNw, setShowNw]   = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function submit() {
    if (cur !== '123456') { setErr('Senha atual incorreta.'); return }
    if (nw.length < 8)    { setErr('Nova senha deve ter ao menos 8 caracteres.'); return }
    if (nw !== conf)      { setErr('As senhas não coincidem.'); return }
    setErr(null)
    showToast('Senha alterada!', 'success')
    onBack()
  }

  function PwField({ label, val, setVal, show, toggleShow }: { label: string; val: string; setVal: (v: string) => void; show: boolean; toggleShow: () => void }) {
    return (
      <div>
        <label className="f-mono text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: C.muted }}>{label}</label>
        <div className="relative">
          <input type={show ? 'text' : 'password'} value={val} onChange={e => setVal(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-2xl f-sora text-sm outline-none"
            style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
          <button type="button" onClick={toggleShow}
            className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: C.muted }}>
            <IcoEye open={show} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full a-up">
      <SubHeader title="Alterar senha" onBack={onBack} />
      <div className="flex flex-col gap-4 px-4 pt-5">
        {err && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl"
            style={{ background: '#450a0a', border: '1px solid rgba(244,63,94,.3)' }}>
            <IcoX size={14} color="#f87171" />
            <p className="f-mono text-xs" style={{ color: '#f87171' }}>{err}</p>
          </div>
        )}
        <PwField label="Senha atual" val={cur} setVal={setCur} show={showCur} toggleShow={() => setShowCur(v => !v)} />
        <PwField label="Nova senha"  val={nw}  setVal={setNw}  show={showNw}  toggleShow={() => setShowNw(v => !v)} />
        <PwField label="Confirmar nova senha" val={conf} setVal={setConf} show={false} toggleShow={() => {}} />
        <p className="f-mono text-[10px]" style={{ color: C.dim }}>Senha demo: 123456</p>
        <button onClick={submit} disabled={!cur || !nw || !conf}
          className="w-full py-4 rounded-2xl f-sora font-bold text-sm active:scale-95"
          style={{ background: (cur && nw && conf) ? C.red : C.dim, color: '#fff' }}>
          Alterar senha
        </button>
      </div>
    </div>
  )
}

// ─── Notification settings ────────────────────────────────────────────────────
const NOTIF_CATS = [
  { key: 'eventos',    label: 'Novos eventos' },
  { key: 'alteracoes', label: 'Alterações e cancelamentos' },
  { key: 'lembretes',  label: 'Lembretes' },
  { key: 'resultados', label: 'Resultados' },
  { key: 'noticias',   label: 'Notícias' },
  { key: 'solics',     label: 'Solicitações' },
  { key: 'avisos',     label: 'Avisos da diretoria' },
] as const

const ANTECEDENCIAS = ['1 h', '2 h', '6 h', '24 h'] as const

function NotifSettings({ onBack }: { onBack: () => void }) {
  const { showToast } = useApp()
  const [global, setGlobal] = useState(true)
  const [cats, setCats] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIF_CATS.map(c => [c.key, true]))
  )
  const [antecedencia, setAntecedencia] = useState<string>('2 h')
  const [androidDenied] = useState(false)

  function toggleGlobal() {
    const next = !global
    setGlobal(next)
    showToast(next ? 'Notificações ativadas!' : 'Notificações desativadas', 'success')
  }
  function toggleCat(key: string) {
    setCats(p => ({ ...p, [key]: !p[key] }))
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto a-up">
      <SubHeader title="Notificações" onBack={onBack} />
      <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
        {androidDenied && (
          <div className="flex items-start gap-3 p-4 rounded-2xl"
            style={{ background: '#1c1209', border: `1px solid ${C.yellow}33` }}>
            <IcoAlert size={18} color={C.yellow} />
            <div className="flex-1">
              <p className="f-sora font-bold text-sm mb-0.5" style={{ color: C.yellow }}>Permissão negada</p>
              <p className="f-mono text-xs mb-2" style={{ color: C.muted }}>
                Notificações estão bloqueadas nas configurações do sistema.
              </p>
              <button className="f-mono text-xs font-semibold" style={{ color: C.blueL }}>
                Abrir configurações →
              </button>
            </div>
          </div>
        )}

        {/* Global toggle */}
        <Card pad="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="f-sora font-semibold text-sm" style={{ color: C.text }}>Notificações push</p>
              <p className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>Ativar ou desativar todas</p>
            </div>
            <Toggle on={global} onChange={toggleGlobal} />
          </div>
        </Card>

        {/* Per-category toggles */}
        <Card pad="p-0">
          <p className="f-mono text-[9px] uppercase tracking-widest px-4 pt-4 pb-2" style={{ color: C.dim }}>Categorias</p>
          {NOTIF_CATS.map((cat, i) => (
            <div key={cat.key} className="flex items-center justify-between px-4 py-3.5"
              style={{ borderTop: i > 0 ? `1px solid ${C.bdr}` : 'none', opacity: global ? 1 : .4 }}>
              <span className="f-sora font-medium text-sm" style={{ color: C.text }}>{cat.label}</span>
              <Toggle on={cats[cat.key] && global} onChange={() => global && toggleCat(cat.key)} />
            </div>
          ))}
        </Card>

        {/* Antecedência */}
        <div>
          <p className="f-mono text-[9px] uppercase tracking-widest mb-3" style={{ color: C.dim }}>Antecedência do lembrete</p>
          <div className="grid grid-cols-4 gap-2">
            {ANTECEDENCIAS.map(a => (
              <button key={a} onClick={() => setAntecedencia(a)}
                className="py-2.5 rounded-xl f-mono text-xs font-semibold transition-all"
                style={{
                  background: antecedencia === a ? C.red : C.card,
                  color: antecedencia === a ? '#fff' : C.muted,
                  border: `1px solid ${antecedencia === a ? C.red : C.bdr}`,
                  opacity: global ? 1 : .4,
                }}>
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── About ────────────────────────────────────────────────────────────────────
function About({ onBack, onTermos, onPrivacidade }: { onBack: () => void; onTermos: () => void; onPrivacidade: () => void }) {
  const items = [
    { label: 'Termos de Uso', onClick: onTermos },
    { label: 'Política de Privacidade', onClick: onPrivacidade },
    { label: 'Versão do app', right: 'v1.0.0 (build 1)' },
    { label: 'Contato da diretoria', right: 'diretoria@atleticalorde.ufma.br' },
  ]
  return (
    <div className="flex flex-col h-full a-up">
      <SubHeader title="Sobre" onBack={onBack} />
      <div className="px-4 pt-5">
        <Card pad="p-0">
          {items.map((item, i) => (
            <button key={item.label} onClick={item.onClick}
              className="w-full flex items-center justify-between px-4 py-4"
              style={{ borderBottom: i < items.length - 1 ? `1px solid ${C.bdr}` : 'none', textAlign: 'left' }}>
              <span className="f-sora font-medium text-sm" style={{ color: C.text }}>{item.label}</span>
              {item.right
                ? <span className="f-mono text-[10px]" style={{ color: C.muted }}>{item.right}</span>
                : <ChevR />}
            </button>
          ))}
        </Card>
        <div className="mt-8 text-center">
          <p className="f-sora font-black text-2xl" style={{ color: C.text }}>{ATLETICA.sigla}</p>
          <p className="f-mono text-[10px] mt-1" style={{ color: C.dim }}>{ATLETICA.nome} · {ATLETICA.curso}</p>
          <p className="f-mono text-[9px] mt-0.5" style={{ color: C.dim }}>UFMA</p>
        </div>
      </div>
    </div>
  )
}

// ─── Delete account ───────────────────────────────────────────────────────────
function DeleteAccount({ onBack }: { onBack: () => void }) {
  const { showToast } = useApp()
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function submit() {
    if (pw !== '123456') { setErr('Senha incorreta.'); return }
    showToast('Conta excluída', 'error')
    onBack()
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto a-up">
      <SubHeader title="Excluir conta" onBack={onBack} />
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
        <div className="p-4 rounded-2xl" style={{ background: '#450a0a', border: '1px solid rgba(244,63,94,.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <IcoAlert size={18} color="#f87171" />
            <p className="f-sora font-bold text-sm" style={{ color: '#f87171' }}>Ação irreversível</p>
          </div>
          <p className="f-mono text-xs leading-loose" style={{ color: C.muted }}>
            Ao excluir sua conta:{'\n'}
            {['Seus dados pessoais serão anonimizados', 'Você será removido de todos os times', 'Solicitações pendentes serão canceladas', 'Confirmações de presença serão removidas'].map(item => (
              <span key={item} className="flex items-start gap-2 mt-1">
                <IcoX size={10} color="#f87171" />
                {item}
              </span>
            ))}
          </p>
        </div>

        {err && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl"
            style={{ background: '#450a0a', border: '1px solid rgba(244,63,94,.3)' }}>
            <IcoX size={14} color="#f87171" />
            <p className="f-mono text-xs" style={{ color: '#f87171' }}>{err}</p>
          </div>
        )}

        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: C.muted }}>
            Confirme sua senha
          </label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-2xl f-sora text-sm outline-none"
              style={{ background: C.card2, border: `1px solid #f43f5e44`, color: C.text, caretColor: '#f43f5e' }} />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: C.muted }}>
              <IcoEye open={showPw} />
            </button>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <button onClick={() => setConfirmed(v => !v)}
            className="shrink-0 mt-0.5 rounded-lg flex items-center justify-center transition-all"
            style={{ width: 20, height: 20, background: confirmed ? '#f43f5e' : C.card2, border: `1.5px solid ${confirmed ? '#f43f5e' : C.dim}` }}>
            {confirmed && <IcoCheck size={12} color="#fff" />}
          </button>
          <p className="f-mono text-[10px] leading-relaxed" style={{ color: C.muted }}>
            Entendo que esta ação é irreversível e que meus dados serão apagados permanentemente.
          </p>
        </div>

        <button onClick={submit} disabled={!pw || !confirmed}
          className="w-full py-4 rounded-2xl f-sora font-bold text-sm active:scale-95"
          style={{ background: (pw && confirmed) ? '#f43f5e' : C.dim, color: '#fff' }}>
          Excluir minha conta
        </button>
      </div>
    </div>
  )
}

// ─── Settings menu ────────────────────────────────────────────────────────────
function SettingsMenu({ onBack, setView, showConfirm }: { onBack: () => void; setView: (v: PView) => void; showConfirm: (t: string, m: string, cb: () => void) => void }) {
  const { showToast } = useApp()

  const sections = [
    {
      title: 'Conta',
      items: [
        { Icon: IcoUser,    label: 'Editar perfil',    onClick: () => setView('edit-profile') },
        { Icon: IcoShield,  label: 'Alterar senha',    onClick: () => setView('change-password') },
      ],
    },
    {
      title: 'Notificações',
      items: [
        { Icon: IcoBell, label: 'Configurar notificações', onClick: () => setView('notif-settings') },
      ],
    },
    {
      title: 'Sobre',
      items: [
        { Icon: IcoCode, label: 'Sobre o app', onClick: () => setView('about') },
      ],
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto a-up">
      <SubHeader title="Configurações" onBack={onBack} />
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
        {sections.map(sec => (
          <div key={sec.title}>
            <p className="f-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: C.dim }}>{sec.title}</p>
            <Card pad="p-0">
              {sec.items.map((item, i) => (
                <button key={item.label} onClick={item.onClick}
                  className="w-full flex items-center gap-3 px-4 py-4 text-left"
                  style={{ borderBottom: i < sec.items.length - 1 ? `1px solid ${C.bdr}` : 'none' }}>
                  <item.Icon size={16} color={C.muted} />
                  <span className="flex-1 f-sora font-medium text-sm" style={{ color: C.text }}>{item.label}</span>
                  <ChevR />
                </button>
              ))}
            </Card>
          </div>
        ))}

        {/* Sign out */}
        <button onClick={() => showConfirm('Sair da conta', 'Tem certeza que deseja encerrar a sessão?', () => showToast('Sessão encerrada', 'error'))}
          className="w-full py-3.5 rounded-2xl f-sora font-semibold text-sm active:scale-95"
          style={{ background: C.red + '15', color: C.red, border: `1px solid rgba(225,29,72,.22)` }}>
          <span className="flex items-center justify-center gap-2">
            <IcoX size={15} color={C.red} /> Sair da conta
          </span>
        </button>

        {/* Delete account */}
        <button onClick={() => setView('delete-account')}
          className="f-mono text-xs text-center w-full py-2" style={{ color: '#f43f5e66' }}>
          Excluir conta
        </button>
      </div>
    </div>
  )
}

// ─── Main profile view ────────────────────────────────────────────────────────
function ProfileMain({ setView }: { setView: (v: PView) => void }) {
  const { role, setScreen, showToast } = useApp()
  const me = getMeByRole(role)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set(['e1', 'e5']))

  const myTime = TIMES.find(t => t.id === me.timeId)
  const proxEvents = EVENTOS
    .filter(e => (e.status === 'Agendado' || e.status === 'Em andamento') && e.timeLordeId === me.timeId)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, 5)

  const confirmedEvents = proxEvents.filter(e => confirmed.has(e.id))

  function toggleConf(id: string) {
    setConfirmed(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); showToast('Presença cancelada', 'error') }
      else               { next.add(id);   showToast('Presença confirmada!', 'success') }
      return next
    })
  }

  const presencaTotal = confirmedEvents.length
  const totalPossivel = proxEvents.length || 1
  const taxaPresenca  = Math.round((presencaTotal / totalPossivel) * 100)

  const stats = [
    { label: 'Jogos',    v: 14 },
    { label: 'Treinos',  v: 31 },
    { label: 'Presença', v: `${taxaPresenca}%` },
  ]

  return (
    <div className="flex flex-col gap-4 pb-4 a-up">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ paddingTop: 24, paddingBottom: 28 }}>
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 80% 0%,rgba(225,29,72,.16),transparent 55%), radial-gradient(ellipse at 15% 100%,rgba(37,99,235,.14),transparent 55%)' }} />
        <div className="relative flex flex-col items-center gap-3">
          <div className="relative">
            <Av s={initials(me.nome)} size={76} bg={`linear-gradient(135deg,${C.red},${C.redD} 55%,#1e3a8a)`} />
            <div className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center"
              style={{ width: 24, height: 24, background: C.green, border: `2px solid ${C.bg}` }}>
              <IcoShield size={12} color="#fff" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="f-sora font-black text-xl" style={{ color: C.text }}>{me.nome}</h2>
            <p className="f-mono text-[11px] mt-px" style={{ color: C.muted }}>{me.email}</p>
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <Chip label={ROLE_LABEL[me.role]} color={C.red} />
              {myTime && <Chip label={myTime.nome} color={C.blue} />}
              <Chip label={ATLETICA.sigla} color={C.muted} />
            </div>
          </div>
          {/* Stats */}
          <div className="flex items-center gap-8 mt-1">
            {stats.map(({ label, v }) => (
              <div key={label} className="text-center">
                <div className="f-sora font-black text-2xl" style={{ color: C.red }}>{v}</div>
                <div className="f-mono text-[10px]" style={{ color: C.muted }}>{label}</div>
              </div>
            ))}
          </div>
          <p className="f-mono text-[9px] text-center" style={{ color: C.dim }}>
            Contam apenas presenças registradas pela diretoria
          </p>
        </div>
      </div>

      {/* Panel access */}
      {canAccessPanel(role) && (
        <div className="px-4">
          <button onClick={() => setScreen('painel')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:scale-95 transition-all"
            style={{ background: C.red + '18', border: `1px solid rgba(225,29,72,.22)` }}>
            <div className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: C.red + '22' }}>
              <IcoCode size={18} color={C.red} />
            </div>
            <div className="flex-1 text-left">
              <div className="f-sora font-bold text-sm" style={{ color: C.text }}>Painel da Diretoria</div>
              <div className="f-mono text-[10px]" style={{ color: C.muted }}>Gerenciar eventos, times e mais</div>
            </div>
            <span className="f-mono text-xs" style={{ color: C.red }}>→</span>
          </button>
        </div>
      )}

      {/* My confirmed upcoming events */}
      {confirmedEvents.length > 0 && (
        <div className="px-4">
          <SH title="Meus eventos confirmados" sub={`${confirmedEvents.length} próximo${confirmedEvents.length !== 1 ? 's' : ''}`} />
          <div className="flex flex-col gap-2">
            {confirmedEvents.map(ev => {
              const tl  = TIMES.find(t => t.id === ev.timeLordeId)
              const mod = MODALIDADES.find(m => m.id === tl?.modalidadeId)
              return (
                <Card key={ev.id} pad="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center rounded-xl shrink-0 text-base"
                      style={{ width: 40, height: 40, background: C.green + '18', border: `1px solid ${C.green}33` }}>
                      {mod?.emoji ?? '🏅'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="f-sora font-semibold text-sm" style={{ color: C.text }}>
                        {ev.tipo === 'JOGO' ? 'Jogo' : 'Treino'} — {tl?.nome}
                      </span>
                      <div className="f-mono text-[10px]" style={{ color: C.muted }}>{fmtCard(ev.inicio)}</div>
                    </div>
                    <div className="flex items-center justify-center rounded-full"
                      style={{ width: 22, height: 22, background: C.green + '22' }}>
                      <IcoCheck size={12} color={C.green} />
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Presença nos eventos */}
      <div className="px-4">
        <SH title="Confirmação de Presença" sub="Confirme antes do início" />
        {proxEvents.length === 0
          ? <p className="f-mono text-xs py-3 text-center" style={{ color: C.muted }}>Sem eventos nos próximos dias</p>
          : (
            <div className="flex flex-col gap-2">
              {proxEvents.map(ev => {
                const tl   = TIMES.find(t => t.id === ev.timeLordeId)
                const mod  = MODALIDADES.find(m => m.id === tl?.modalidadeId)
                const conf = confirmed.has(ev.id)
                const isLive = ev.status === 'Em andamento'
                return (
                  <Card key={ev.id} pad="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center rounded-xl shrink-0"
                        style={{ width: 40, height: 40, background: (ev.tipo === 'JOGO' ? C.red : C.blue) + '1a', border: `1px solid ${(ev.tipo === 'JOGO' ? C.red : C.blue)}33` }}>
                        <span className="text-base">{mod?.emoji ?? '🏅'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-px">
                          <span className="f-sora font-semibold text-sm" style={{ color: C.text }}>
                            {ev.tipo === 'JOGO' ? 'Jogo' : 'Treino'} — {tl?.nome}
                          </span>
                          {isLive && <span className="a-pulse inline-block w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />}
                        </div>
                        <div className="f-mono text-[10px]" style={{ color: C.muted }}>{fmtCard(ev.inicio)}</div>
                      </div>
                      <button onClick={() => toggleConf(ev.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 active:scale-90"
                        style={{ background: conf ? C.green + '1a' : C.card2, color: conf ? C.green : C.muted, border: `1px solid ${conf ? C.green + '33' : C.bdr}` }}>
                        {conf ? <IcoCheck size={12} /> : <IcoPlus size={12} color={C.muted} />}
                        {conf ? 'Confirmado' : 'Confirmar'}
                      </button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
      </div>

      {/* Settings shortcut */}
      <div className="px-4">
        <button onClick={() => setView('settings')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
          <IcoUser size={17} color={C.muted} />
          <span className="flex-1 f-sora font-medium text-sm text-left" style={{ color: C.text }}>Configurações</span>
          <ChevR />
        </button>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function PerfilScreen() {
  const { showConfirm } = useApp()
  const [view, setView] = useState<PView>('main')

  if (view === 'settings')       return <SettingsMenu onBack={() => setView('main')} setView={setView} showConfirm={showConfirm} />
  if (view === 'edit-profile') {
    const { role } = useApp()
    const me = getMeByRole(role)
    return <EditProfile nome={me.nome} onBack={() => setView('settings')} />
  }
  if (view === 'change-password') return <ChangePassword onBack={() => setView('settings')} />
  if (view === 'notif-settings')  return <NotifSettings onBack={() => setView('settings')} />
  if (view === 'about')           return <About onBack={() => setView('settings')} onTermos={() => {}} onPrivacidade={() => {}} />
  if (view === 'delete-account')  return <DeleteAccount onBack={() => setView('settings')} />

  return <ProfileMain setView={setView} />
}
