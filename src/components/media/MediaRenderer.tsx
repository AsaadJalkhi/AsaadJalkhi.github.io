/**
 * Media dispatch.
 *
 * One registry maps a media `type` to its adapter. Adding a new content type
 * is three steps and touches nothing else:
 *   1. add the name to `mediaTypes` in src/types/content.ts
 *   2. write an adapter that takes AdapterProps
 *   3. add one line to ADAPTERS below
 */
import type { ComponentType } from 'react';
import type { MediaType } from '@/types/content';
import { GalleryMedia, ImageMedia } from './adapters/ImageMedia';
import { VideoMedia } from './adapters/VideoMedia';
import { EmbedMedia } from './adapters/EmbedMedia';
import { InstagramMedia } from './adapters/InstagramMedia';
import { DriveMedia } from './adapters/DriveMedia';
import { WebsiteMedia } from './adapters/WebsiteMedia';
import { PdfMedia } from './adapters/PdfMedia';
import { GenerativeMedia } from './adapters/GenerativeMedia';
import type { AdapterProps } from './types';
import './media.css';

const ADAPTERS: Record<MediaType, ComponentType<AdapterProps>> = {
  image: ImageMedia,
  gallery: GalleryMedia,
  video: VideoMedia,
  youtube: EmbedMedia,
  vimeo: EmbedMedia,
  embed: EmbedMedia,
  instagram: InstagramMedia,
  drive: DriveMedia,
  website: WebsiteMedia,
  pdf: PdfMedia,
  // Deprecated and no longer offered in the Studio, but existing content still
  // contains these, so the renderer still knows how to draw one.
  generative: GenerativeMedia,
};

export function MediaRenderer(props: AdapterProps) {
  const Adapter = ADAPTERS[props.media.type] ?? ImageMedia;
  return <Adapter {...props} />;
}

/** Human label for a media type — used in file lists and chips. */
export const MEDIA_LABELS: Record<MediaType, string> = {
  image: 'Image',
  gallery: 'Gallery',
  video: 'Video',
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  instagram: 'Instagram',
  drive: 'Drive video',
  website: 'Website',
  pdf: 'Document',
  embed: 'Embed',
  generative: 'Motion',
};
