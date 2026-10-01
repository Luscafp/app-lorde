import { useState, useRef } from 'react'
import { C } from '../../theme'
import { fmtDate, getMeByRole } from '../../utils'
import { Card, Chip, Pill, IcoBack, IcoPlus, IcoCheck, IcoX, IcoBin, IcoEdit, IcoImage } from '../../components/atoms'
import { EmptyState } from '../../components/shared'
import { useApp } from '../../AppContext'
import type { Noticia, Banner } from '../../types'

const GRADIENTS = [
  { id: 'g1', bg: 'linear-gradient(135deg,#e11d48,#9f1239)' },
  { id: 'g2', bg: 'linear-gradient(135deg,#2563eb,#1e3a8a)' },
  { id: 'g3', bg: 'linear-gradient(135deg,#7c3aed,#4c1d95)' },
  { id: 'g4', bg: 'linear-gradient(135deg,#0891b2,#164e63)' },
  { id: 'g5', bg: 'linear-gradient(135deg,#059669,#064e3b)' },
  { id: 'g6', bg: 'linear-gradient(135deg,#d97706,#92400e)' },
]

// ─── Notícias ─────────────────────────────────────────────────────────────────

function NoticiaEditor({ initial, onSave, onBack }: { initial?: Noticia; onSave: (n: Noticia) => void; onBack: () => void }) {
  const { showToast, role } = useApp()
  const [titulo, setTitulo]     = useState(initial?.titulo ?? '')
  const [conteudo, setConteudo] = useState(initial?.conteudo ?? '')
  const [imagem, setImagem]     = useState(initial?.imagem ?? GRADIENTS[0].bg)
  const [status, setStatus]     = useState<'Rascunho' | 'Publicada'>(initial?.status ?? 'Rascunho')
  const [tags, setTags]         = useState<string[]>(initial?.tags ?? [])
  const [novaTag, setNovaTag]   = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  function insertFormat(open: string, close: string) {
    const ta = textRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const sel = conteudo.slice(s, e)
    const next = conteudo.slice(0, s) + open + sel + close + conteudo.slice(e)
    setConteudo(next)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + open.length, e + open.length) }, 0)
  }

  function addTag() {
    const t = novaTag.trim()
    if (t && !tags.includes(t)) { setTags(p => [...p, t]); setNovaTag('') }
  }

  function save(s: 'Rascunho' | 'Publicada') {
    if (!titulo.trim()) { showToast('Informe o título', 'error'); return }
    onSave({
      id: initial?.id ?? `n${Date.now()}`,
      titulo, conteudo, imagem,
      status: s,
      tags,
      data: initial?.data ?? new Date().toISOString(),
      autorId: s === 'Publicada' ? (initial?.autorId ?? getMeByRole(role).id) : initial?.autorId,
      autorNome: s === 'Publicada' ? (initial?.autorNome ?? getMeByRole(role).nome) : initial?.autorNome,
      publicadaEm: s === 'Publicada' ? (initial?.publicadaEm ?? new Date().toISOString()) : initial?.publicadaEm,
    })
    showToast(s === 'Publicada' ? 'Notícia publicada!' : 'Rascunho salvo', 'success')
    onBack()
  }

  const canDelete = role === 'presidente' || role === 'vice' || role === 'admin'

  return (
    <div className="flex flex-col gap-4 pb-6 overflow-y-auto a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>
          {initial ? 'Editar notícia' : 'Nova notícia'}
        </h3>
      </div>

      <div className="flex flex-col gap-4 px-4">
        {/* Image */}
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color: C.muted }}>Imagem de capa</label>
          <div className="rounded-2xl mb-2 flex items-center justify-center"
            style={{ height: 100, background: imagem }}>
            <IcoImage size={28} color="rgba(255,255,255,.3)" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {GRADIENTS.map(g => (
              <button key={g.id} onClick={() => setImagem(g.bg)}
                className="rounded-xl transition-all"
                style={{ width: 36, height: 24, background: g.bg, border: `2px solid ${imagem === g.bg ? '#fff' : 'transparent'}` }} />
            ))}
          </div>
        </div>

        {/* Título */}
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>Título</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)}
            placeholder="Título da notícia"
            className="w-full px-4 py-2.5 rounded-xl f-sora font-semibold text-sm outline-none"
            style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
        </div>

        {/* Content */}
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>Conteúdo</label>
          {/* Formatting toolbar */}
          <div className="flex gap-1.5 mb-1.5">
            {[
              { label: 'B', title: 'Negrito', action: () => insertFormat('**', '**') },
              { label: '≡', title: 'Lista', action: () => insertFormat('\n- ', '') },
              { label: '🔗', title: 'Link', action: () => insertFormat('[texto](', ')') },
            ].map(btn => (
              <button key={btn.label} onClick={btn.action} title={btn.title}
                className="px-2.5 py-1 rounded-lg f-mono text-[11px] font-bold"
                style={{ background: C.card2, color: C.text, border: `1px solid ${C.bdr}` }}>
                {btn.label}
              </button>
            ))}
          </div>
          <textarea ref={textRef} value={conteudo} onChange={e => setConteudo(e.target.value)}
            placeholder="Conteúdo da notícia..."
            rows={6}
            className="w-full px-4 py-3 rounded-xl f-mono text-xs outline-none resize-none leading-loose"
            style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
        </div>

        {/* Tags */}
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: C.muted }}>Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(t => (
              <button key={t} onClick={() => setTags(p => p.filter(x => x !== t))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full f-mono text-[10px] font-semibold"
                style={{ background: C.red + '22', color: C.red, border: `1px solid ${C.red}44` }}>
                {t} <IcoX size={10} color={C.red} />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={novaTag} onChange={e => setNovaTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="Nova tag..."
              className="flex-1 px-3 py-2 rounded-xl f-mono text-xs outline-none"
              style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
            <button onClick={addTag} className="flex items-center justify-center rounded-xl px-3"
              style={{ background: C.red + '22', color: C.red }}>
              <IcoPlus size={14} color={C.red} />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => save('Rascunho')}
            className="flex-1 py-3 rounded-2xl f-sora font-semibold text-sm"
            style={{ background: C.card2, color: C.muted, border: `1px solid ${C.bdr}` }}>
            Salvar rascunho
          </button>
          <button onClick={() => save('Publicada')}
            className="flex-1 py-3 rounded-2xl f-sora font-bold text-sm"
            style={{ background: C.red, color: '#fff' }}>
            {initial?.status === 'Publicada' ? 'Atualizar' : 'Publicar'}
          </button>
        </div>
        {initial?.status === 'Publicada' && (
          <button onClick={() => save('Rascunho')}
            className="w-full py-3 rounded-2xl f-sora font-semibold text-sm"
            style={{ background: C.yellow + '18', color: C.yellow, border: `1px solid ${C.yellow}33` }}>
            Despublicar
          </button>
        )}
      </div>
    </div>
  )
}

function NoticiasTab({ showDelete }: { showDelete: boolean }) {
  const { showConfirm, showToast, noticias, setNoticias, audit } = useApp()
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [selected, setSelected] = useState<Noticia | null>(null)
  const [filter, setFilter] = useState<'Todos' | 'Rascunho' | 'Publicada'>('Todos')

  const filtered = noticias.filter(n => filter === 'Todos' || n.status === filter)
    .sort((a, b) => b.data.localeCompare(a.data))

  if (view === 'editor') {
    return (
      <NoticiaEditor
        initial={selected ?? undefined}
        onSave={n => {
          if (selected) setNoticias(p => p.map(x => x.id === n.id ? n : x))
          else setNoticias(p => [n, ...p])
          audit('Notícias', n.status === 'Publicada' ? 'Publicou notícia' : 'Salvou rascunho', n.titulo)
        }}
        onBack={() => { setView('list'); setSelected(null) }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 overflow-x-auto">
        {(['Todos', 'Publicada', 'Rascunho'] as const).map(f => (
          <Pill key={f} label={f} active={filter === f} color={f === 'Publicada' ? C.green : f === 'Rascunho' ? C.yellow : C.muted} onClick={() => setFilter(f)} />
        ))}
      </div>
      {filtered.length === 0
        ? <EmptyState message="Nenhuma notícia" />
        : filtered.map(n => (
          <Card key={n.id} pad="p-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl shrink-0" style={{ width: 48, height: 48, background: n.imagem }} />
              <div className="flex-1 min-w-0">
                <div className="f-sora font-semibold text-sm leading-tight" style={{ color: C.text }}>{n.titulo}</div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Chip label={n.status} color={n.status === 'Publicada' ? C.green : C.yellow} />
                  {n.tags.slice(0, 2).map(t => <Chip key={t} label={t} color={C.muted} />)}
                  <span className="f-mono text-[9px]" style={{ color: C.dim }}>{fmtDate(n.data)}</span>
                  {n.status === 'Publicada' && <span className="f-mono text-[9px]" style={{ color: C.dim }}>
                    {n.autorNome ?? 'Diretoria'} · {fmtDate(n.publicadaEm ?? n.data)}
                  </span>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => { setSelected(n); setView('editor') }}
                  className="flex items-center justify-center rounded-lg p-1.5" style={{ background: C.blue + '22' }}>
                  <IcoEdit size={14} />
                </button>
                {showDelete && (
                  <button onClick={() => showConfirm('Excluir notícia', 'Esta ação é irreversível.', () => {
                    setNoticias(p => p.filter(x => x.id !== n.id))
                    audit('Notícias', 'Excluiu notícia', n.titulo)
                    showToast('Notícia removida', 'error')
                  })} className="flex items-center justify-center rounded-lg p-1.5" style={{ background: '#f43f5e1a' }}>
                    <IcoBin size={14} color="#f43f5e" />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      <button onClick={() => { setSelected(null); setView('editor') }}
        className="w-full py-3.5 rounded-2xl f-sora font-bold text-sm flex items-center justify-center gap-2"
        style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
        <IcoPlus size={15} /> Nova notícia
      </button>
    </div>
  )
}

// ─── Banners ──────────────────────────────────────────────────────────────────

function BannerForm({ initial, onSave, onBack }: { initial?: Banner; onSave: (b: Banner) => void; onBack: () => void }) {
  const { showToast } = useApp()
  const [titulo, setTitulo] = useState(initial?.titulo ?? '')
  const [imagem, setImagem] = useState(initial?.imagem ?? GRADIENTS[0].bg)
  const [link, setLink]     = useState(initial?.link ?? '')
  const [ativo, setAtivo]   = useState(initial?.ativo ?? true)
  const [linkErr, setLinkErr] = useState<string | null>(null)

  function validateLink(v: string) {
    setLink(v)
    if (v && !v.startsWith('https://')) setLinkErr('O link deve começar com https://')
    else setLinkErr(null)
  }

  function save() {
    if (!titulo.trim()) { showToast('Informe o título', 'error'); return }
    if (link && !link.startsWith('https://')) { setLinkErr('O link deve começar com https://'); return }
    onSave({ id: initial?.id ?? `b${Date.now()}`, titulo, imagem, link: link || undefined, ordem: initial?.ordem ?? 99, ativo })
    showToast(initial ? 'Banner atualizado!' : 'Banner criado!', 'success')
    onBack()
  }

  return (
    <div className="flex flex-col gap-4 pb-6 a-up">
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}><IcoBack /></button>
        <h3 className="f-sora font-black text-base" style={{ color: C.text }}>
          {initial ? 'Editar banner' : 'Novo banner'}
        </h3>
      </div>
      <div className="flex flex-col gap-4 px-4">
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-2 block" style={{ color: C.muted }}>Imagem</label>
          <div className="rounded-2xl mb-2" style={{ height: 80, background: imagem }} />
          <div className="flex gap-1.5 flex-wrap">
            {GRADIENTS.map(g => (
              <button key={g.id} onClick={() => setImagem(g.bg)}
                className="rounded-xl" style={{ width: 36, height: 24, background: g.bg, border: `2px solid ${imagem === g.bg ? '#fff' : 'transparent'}` }} />
            ))}
          </div>
        </div>
        {[
          { label: 'Título', val: titulo, set: setTitulo, ph: 'Título do banner' },
        ].map(({ label, val, set, ph }) => (
          <div key={label}>
            <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>{label}</label>
            <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
              className="w-full px-4 py-2.5 rounded-xl f-sora text-sm outline-none"
              style={{ background: C.card2, border: `1px solid ${C.bdr}`, color: C.text, caretColor: C.red }} />
          </div>
        ))}
        <div>
          <label className="f-mono text-[10px] uppercase tracking-wider mb-1 block" style={{ color: C.muted }}>Link (opcional)</label>
          <input value={link} onChange={e => validateLink(e.target.value)} placeholder="https://..."
            className="w-full px-4 py-2.5 rounded-xl f-sora text-sm outline-none"
            style={{ background: C.card2, border: `1px solid ${linkErr ? '#f43f5e55' : C.bdr}`, color: C.text, caretColor: C.red }} />
          {linkErr && <p className="f-mono text-[10px] mt-1" style={{ color: '#f87171' }}>{linkErr}</p>}
        </div>
        <div className="flex items-center justify-between">
          <span className="f-sora font-medium text-sm" style={{ color: C.text }}>Ativo</span>
          <button onClick={() => setAtivo(v => !v)}
            className="rounded-full transition-all" style={{ width: 44, height: 24, background: ativo ? C.green : C.dim, padding: 3 }}>
            <div className="rounded-full transition-all" style={{ width: 18, height: 18, background: '#fff', transform: `translateX(${ativo ? 20 : 0}px)` }} />
          </button>
        </div>
        <button onClick={save}
          className="w-full py-4 rounded-2xl f-sora font-bold text-sm"
          style={{ background: C.red, color: '#fff', boxShadow: '0 4px 16px rgba(225,29,72,.35)' }}>
          Salvar banner
        </button>
      </div>
    </div>
  )
}

function BannersTab() {
  const { showToast, showConfirm, role, banners: storeBanners, setBanners, audit } = useApp()
  const banners = [...storeBanners].sort((a, b) => a.ordem - b.ordem)
  const [view, setView] = useState<'list' | 'form'>('list')
  const [selected, setSelected] = useState<Banner | null>(null)

  function moveUp(id: string) {
    setBanners(p => {
      const i = p.findIndex(b => b.id === id)
      if (i <= 0) return p
      const next = [...p]
      ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
      return next.map((b, j) => ({ ...b, ordem: j + 1 }))
    })
    const banner = banners.find(b => b.id === id)
    if (banner) audit('Banners', 'Reordenou banner', banner.titulo)
  }
  function moveDown(id: string) {
    setBanners(p => {
      const i = p.findIndex(b => b.id === id)
      if (i >= p.length - 1) return p
      const next = [...p]
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      return next.map((b, j) => ({ ...b, ordem: j + 1 }))
    })
    const banner = banners.find(b => b.id === id)
    if (banner) audit('Banners', 'Reordenou banner', banner.titulo)
  }
  function toggleAtivo(id: string) {
    setBanners(p => p.map(b => b.id === id ? { ...b, ativo: !b.ativo } : b))
    const banner = banners.find(b => b.id === id)
    if (banner) audit('Banners', banner.ativo ? 'Desativou banner' : 'Ativou banner', banner.titulo)
    showToast('Banner atualizado', 'success')
  }

  if (view === 'form') {
    return (
      <BannerForm
        initial={selected ?? undefined}
        onSave={b => {
          if (selected) setBanners(p => p.map(x => x.id === b.id ? b : x))
          else setBanners(p => [...p, { ...b, ordem: p.length + 1 }])
          audit('Banners', selected ? 'Atualizou banner' : 'Criou banner', b.titulo)
        }}
        onBack={() => { setView('list'); setSelected(null) }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {banners.length === 0 ? <EmptyState message="Nenhum banner" /> : banners.map((b, i) => (
        <Card key={b.id} pad="p-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl shrink-0" style={{ width: 56, height: 40, background: b.imagem }} />
            <div className="flex-1 min-w-0">
              <div className="f-sora font-semibold text-sm" style={{ color: C.text }}>{b.titulo}</div>
              <div className="f-mono text-[10px] mt-px" style={{ color: C.muted }}>Ordem #{b.ordem}</div>
            </div>
            {/* Reorder */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => moveUp(b.id)} disabled={i === 0}
                className="px-1 py-0.5 rounded text-xs" style={{ color: i === 0 ? C.dim : C.muted }}>▲</button>
              <button onClick={() => moveDown(b.id)} disabled={i === banners.length - 1}
                className="px-1 py-0.5 rounded text-xs" style={{ color: i === banners.length - 1 ? C.dim : C.muted }}>▼</button>
            </div>
            {/* Active toggle */}
            <button onClick={() => toggleAtivo(b.id)}
              className="rounded-full transition-all shrink-0"
              style={{ width: 40, height: 22, background: b.ativo ? C.green : C.dim, padding: 2 }}>
              <div className="rounded-full transition-all"
                style={{ width: 18, height: 18, background: '#fff', transform: `translateX(${b.ativo ? 18 : 0}px)` }} />
            </button>
            <button onClick={() => { setSelected(b); setView('form') }}
              className="flex items-center justify-center rounded-lg p-1.5" style={{ background: C.blue + '22' }}>
              <IcoEdit size={14} />
            </button>
            {(role === 'presidente' || role === 'vice' || role === 'admin') && (
              <button onClick={() => showConfirm('Excluir banner', `Excluir ${b.titulo}?`, () => {
                setBanners(p => p.filter(x => x.id !== b.id))
                audit('Banners', 'Excluiu banner', b.titulo)
              })} className="flex items-center justify-center rounded-lg p-1.5" style={{ background: '#f43f5e1a' }}>
                <IcoBin size={14} color="#f43f5e" />
              </button>
            )}
          </div>
        </Card>
      ))}
      <button onClick={() => { setSelected(null); setView('form') }}
        className="w-full py-3.5 rounded-2xl f-sora font-bold text-sm flex items-center justify-center gap-2"
        style={{ background: C.blue + '22', color: C.blueL, border: `1px solid ${C.bdrB}` }}>
        <IcoPlus size={14} color={C.blueL} /> Novo banner
      </button>
    </div>
  )
}

// ─── Main ConteudoSection ─────────────────────────────────────────────────────
export function NoticiasSection({ showDelete }: { showDelete: boolean }) {
  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <NoticiasTab showDelete={showDelete} />
    </div>
  )
}

export function BannersSection() {
  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <BannersTab />
    </div>
  )
}
