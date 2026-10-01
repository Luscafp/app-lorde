import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { C, ATLETICA } from '../theme'
import { fmtShortDate, fmtFull, canAccessPanel, initials } from '../utils'
import { eventoNaAgenda, timeVisivel } from '../domain'
import { Card, SH, Chip, Av, Pill, IcoChev, IcoCode, IcoTrophy, IcoCal, IcoSport, IcoBack, IcoNewspaper } from '../components/atoms'
import { EmptyState, ListaGate, RichText, useEstadoLista } from '../components/shared'
import { EventoCard } from '../components/EventoDetalhe'
import { useApp } from '../AppContext'
import type { Noticia } from '../types'

type HView = 'home' | 'news-list' | 'news-detail'

const dataNoticia = (n: Noticia) => n.publicadaEm ?? n.criadaEm

// ─── News detail ──────────────────────────────────────────────────────────────
function NewsDetail({ n, onBack }: { n: Noticia; onBack: () => void }) {
  const { nomeUsuario } = useApp()
  return (
    <div className="flex flex-col pb-4 a-up">
      <div className="relative" style={{ height: 200, background: n.imagem }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(7,9,13,.9))' }} />
        <button onClick={onBack}
          className="absolute top-4 left-4 flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)', border: `1px solid ${C.bdr}` }}>
          <IcoBack />
        </button>
      </div>
      <div className="px-4 pt-4">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {n.tags.map(t => <Chip key={t} label={t} color={C.red} />)}
        </div>
        <h2 className="f-sora font-black text-2xl leading-tight mb-2" style={{ color: C.text }}>{n.titulo}</h2>
        <p className="f-mono text-[10px] mb-4" style={{ color: C.dim }}>
          {n.autorId ? `${nomeUsuario(n.autorId)} · ` : ''}{fmtFull(dataNoticia(n))}
        </p>
        <RichText text={n.conteudo} />
      </div>
    </div>
  )
}

// ─── News list (UC05) ─────────────────────────────────────────────────────────
function NewsList({ onBack, onSelect }: { onBack: () => void; onSelect: (n: Noticia) => void }) {
  const { noticias, demo, setDemo } = useApp()
  const { estado, tentarNovamente } = useEstadoLista(demo, setDemo)
  const published = noticias.filter(n => n.status === 'Publicada')
  const allTags = Array.from(new Set(published.flatMap(n => n.tags)))
  const [tag, setTag] = useState<string | null>(null)

  const filtered = tag ? published.filter(n => n.tags.includes(tag)) : published
  const sorted = [...filtered].sort((a, b) => dataNoticia(b).localeCompare(dataNoticia(a)))

  return (
    <div className="flex flex-col gap-4 pb-4 a-up">
      <div className="px-4 pt-5 flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center justify-center rounded-xl"
          style={{ width: 36, height: 36, background: C.card, border: `1px solid ${C.bdr}` }}>
          <IcoBack />
        </button>
        <div>
          <h2 className="f-sora font-black text-xl" style={{ color: C.text }}>Notícias</h2>
          <p className="f-mono text-[10px]" style={{ color: C.muted }}>{sorted.length} publicações</p>
        </div>
      </div>
      <div className="flex gap-2 px-4 overflow-x-auto pb-1">
        <Pill label="Todas" active={tag === null} color={C.red} onClick={() => setTag(null)} />
        {allTags.map(t => (
          <Pill key={t} label={t} active={tag === t} color={C.red} onClick={() => setTag(tag === t ? null : t)} />
        ))}
      </div>
      <div className="flex flex-col gap-3 px-4">
        <ListaGate estado={estado} onRetry={tentarNovamente}>
          {sorted.length === 0
            ? <EmptyState message="Nenhuma notícia para esta tag" action="Limpar filtro" onAction={() => setTag(null)} />
            : sorted.map(n => (
              <Card key={n.id} onClick={() => onSelect(n)} pad="p-0">
                <div className="rounded-t-2xl" style={{ height: 130, background: n.imagem }} />
                <div className="p-4">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {n.tags.map(t => <Chip key={t} label={t} color={C.red} />)}
                  </div>
                  <h3 className="f-sora font-bold text-base leading-tight mb-1.5" style={{ color: C.text }}>{n.titulo}</h3>
                  <span className="f-mono text-[10px]" style={{ color: C.dim }}>{fmtFull(dataNoticia(n))}</span>
                </div>
              </Card>
            ))}
        </ListaGate>
      </div>
    </div>
  )
}

// ─── Home (UC01) ──────────────────────────────────────────────────────────────
function HomeMain({ onNewsAll, onNewsDetail }: { onNewsAll: () => void; onNewsDetail: (n: Noticia) => void }) {
  const {
    me, setScreen, openAgenda, abrirEvento, showToast, banners, eventos, times, noticias, modalidades, demo, setDemo,
  } = useApp()
  const { estado, tentarNovamente } = useEstadoLista(demo, setDemo)
  const [bannerIdx, setBannerIdx] = useState(0)

  // RN34: apenas banners ativos, na ordem definida
  const activeBanners = banners.filter(b => b.ativo).sort((a, b) => a.ordem - b.ordem)
  const idx = activeBanners.length ? bannerIdx % activeBanners.length : 0
  const banner = activeBanners[idx]

  // Carrossel: avança sozinho a cada 5 s
  useEffect(() => {
    if (activeBanners.length < 2) return
    const t = setInterval(() => setBannerIdx(i => i + 1), 5000)
    return () => clearInterval(t)
  }, [activeBanners.length])

  // RN18: agendados e em andamento; cancelados continuam visíveis até a data prevista
  const proxEvents = eventos
    .filter(e => timeVisivel(times, modalidades, e.timeId) && eventoNaAgenda(e))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, 4)

  const ultimas = noticias.filter(n => n.status === 'Publicada')
    .sort((a, b) => dataNoticia(b).localeCompare(dataNoticia(a)))
    .slice(0, 3)

  const atalhos: { Icon: FC<{ size: number; color: string }>; label: string; color: string; onClick: () => void }[] = [
    { Icon: IcoCal,       label: 'Agenda',   color: C.blue,   onClick: () => openAgenda('eventos') },
    { Icon: IcoTrophy,    label: 'Placar',   color: C.yellow, onClick: () => openAgenda('placar') },
    { Icon: IcoSport,     label: 'Times',    color: C.red,    onClick: () => setScreen('modalidades') },
    { Icon: IcoNewspaper, label: 'Notícias', color: C.muted,  onClick: onNewsAll },
  ]

  return (
    <div className="flex flex-col gap-4 pb-4 a-up">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 pt-5">
        <div>
          <p className="f-mono text-[10px]" style={{ color: C.muted }}>// Olá, {me.nome.split(' ')[0]}</p>
          <h1 className="f-sora font-black text-xl" style={{ color: C.text }}>{ATLETICA.nome}</h1>
        </div>
        <div className="flex items-center gap-2">
          {canAccessPanel(me.role) && (
            <button onClick={() => setScreen('painel')} title="Painel da Diretoria"
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: C.red + '22', border: `1px solid ${C.bdrR}` }}>
              <IcoCode size={16} color={C.red} />
            </button>
          )}
          <button onClick={() => setScreen('perfil')}>
            <Av s={initials(me.nome)} size={38} bg={`linear-gradient(135deg,${C.red},${C.redD})`} />
          </button>
        </div>
      </div>

      {/* Carrossel de banners (RF11) */}
      {banner && (
        <div className="px-4">
          <div role="button" className="w-full relative rounded-2xl overflow-hidden active:scale-[.98] transition-all cursor-pointer"
            style={{ height: 138, background: banner.imagem }}
            onClick={() => banner.link && showToast(`Abrindo ${banner.link}`, 'success')}>
            <div className="absolute right-[-24px] top-[-24px] rounded-full opacity-[.08]"
              style={{ width: 140, height: 140, background: '#fff' }} />
            <div className="relative z-10 p-4 flex flex-col justify-between h-full">
              <div className="flex items-center gap-2">
                <IcoTrophy size={13} color={C.yellow} />
                <span className="f-mono text-[9px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,.55)' }}>
                  {ATLETICA.sigla}
                </span>
              </div>
              <h2 className="f-sora font-black text-xl text-white leading-tight pr-10">{banner.titulo}</h2>
            </div>
            {activeBanners.length > 1 && (
              <div className="absolute bottom-3 right-4 flex gap-1.5 z-20">
                {activeBanners.map((_, i) => (
                  <button key={i} onClick={e => { e.stopPropagation(); setBannerIdx(i) }}
                    className="rounded-full transition-all"
                    style={{ width: i === idx ? 20 : 6, height: 6, background: i === idx ? '#fff' : 'rgba(255,255,255,.3)' }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Atalhos */}
      <div className="px-4 grid grid-cols-4 gap-2">
        {atalhos.map(({ Icon, label, color, onClick }) => (
          <button key={label} onClick={onClick}
            className="flex flex-col items-center gap-1.5 py-2.5 rounded-2xl active:scale-95 transition-all"
            style={{ background: C.card, border: `1px solid ${C.bdr}` }}>
            <Icon size={20} color={color} />
            <span className="text-[10px] font-medium" style={{ color: C.muted }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Próximos eventos (RF08) */}
      <div className="px-4">
        <SH title="Próximos eventos" action="Ver agenda" onAction={() => openAgenda('eventos')} />
        <ListaGate estado={estado} onRetry={tentarNovamente} n={2}>
          {proxEvents.length === 0
            ? <p className="f-mono text-xs py-4 text-center" style={{ color: C.muted }}>Nenhum evento agendado</p>
            : (
              <div className="flex flex-col gap-2">
                {proxEvents.map(ev => <EventoCard key={ev.id} ev={ev} onClick={() => abrirEvento(ev.id)} right={<IcoChev />} />)}
              </div>
            )}
        </ListaGate>
      </div>

      {/* Últimas notícias (RF09) */}
      <div className="px-4">
        <SH title="Últimas notícias" action="Ver todas" onAction={onNewsAll} />
        <ListaGate estado={estado} onRetry={tentarNovamente} n={2}>
          {ultimas.length === 0
            ? <EmptyState message="Nenhuma notícia publicada" />
            : (
              <div className="flex flex-col gap-2">
                {ultimas.map(n => (
                  <Card key={n.id} onClick={() => onNewsDetail(n)} pad="p-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl shrink-0" style={{ width: 50, height: 50, background: n.imagem }} />
                      <div className="flex-1 min-w-0">
                        <p className="f-sora font-semibold text-sm leading-tight line-clamp-2" style={{ color: C.text }}>
                          {n.titulo}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {n.tags.slice(0, 2).map(tag => <Chip key={tag} label={tag} color={C.red} />)}
                          <span className="f-mono text-[10px]" style={{ color: C.muted }}>{fmtShortDate(dataNoticia(n))}</span>
                        </div>
                      </div>
                      <IcoChev />
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </ListaGate>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [view, setView] = useState<HView>('home')
  const [origem, setOrigem] = useState<'home' | 'news-list'>('home')
  const [selectedNews, setSelectedNews] = useState<Noticia | null>(null)

  function abrirNoticia(n: Noticia, de: 'home' | 'news-list') {
    setSelectedNews(n); setOrigem(de); setView('news-detail')
  }

  if (view === 'news-detail' && selectedNews) {
    return <NewsDetail n={selectedNews} onBack={() => setView(origem)} />
  }
  if (view === 'news-list') {
    return <NewsList onBack={() => setView('home')} onSelect={n => abrirNoticia(n, 'news-list')} />
  }
  return <HomeMain onNewsAll={() => setView('news-list')} onNewsDetail={n => abrirNoticia(n, 'home')} />
}
