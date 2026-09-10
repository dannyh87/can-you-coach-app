import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Can You Coach',
    short_name: 'Can You Coach',
    description: 'Track coaching sessions, fitness tests and match day observations.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#172554',
    icons: [
      {
        src: '/brand/logo_noWordsOrBackground.png',
        sizes: '1254x1254',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/logo_noWordsOrBackground.png',
        sizes: '1254x1254',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
