import type { Metadata } from 'next';

/** Keep search and shared-link descriptions consistent across public pages. */
export function pageMetadata(title: string, description: string, path?: string): Metadata {
  return {
    title,
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      title, description, siteName: 'ValueArena', type: 'website',
      ...(path ? { url: path } : {}),
      images: [{ url: '/laisr-preview.png', width: 1200, height: 630, alt: 'LAISR Lab pixel logo' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/laisr-preview.png'] },
  };
}
