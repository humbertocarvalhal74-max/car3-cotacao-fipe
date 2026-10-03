import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'CAR3 Cotação FIPE', short_name: 'CAR3', lang: 'pt-BR',
    start_url: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#ffffff' };
}
