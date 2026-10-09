import { router } from 'expo-router'
import { TelaBannersPainel, type NavegacaoBanners } from '@/features/banners'

const ir: NavegacaoBanners = {
  novo: () => router.push('/painel/banners/novo'),
  editar: (id) => router.push(`/painel/banners/${id}`),
}

export default function BannersPainel() {
  return <TelaBannersPainel ir={ir} />
}
