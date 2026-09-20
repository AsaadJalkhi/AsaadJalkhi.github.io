import { Download, FileText } from 'lucide-react';
import { asset } from '@/lib/paths';
import { SmartImage } from '@/components/ui/SmartImage';
import { Btn } from '@/components/ui/Ui';
import { MediaFrame } from '../MediaFrame';
import { FALLBACK_RATIO, isAuto, useImageRatio } from '../aspect';
import type { AdapterProps } from '../types';

/**
 * PDF / document.
 *
 * Inline PDF viewers are heavy and inconsistent across browsers, so the
 * default is a cover + explicit "Open" action. `iframe: true` embeds it.
 */
export function PdfMedia({ media, seed, discipline, mode }: AdapterProps) {
  const href = asset(media.src ?? media.url);
  const open = () => href && window.open(href, '_blank', 'noopener,noreferrer');

  // Auto: a document's shape is its cover's shape. Failing that, 3:2 — closer
  // to a landscape deck than to A4, which is what people actually attach here.
  const auto = isAuto(media.aspect);
  const coverRatio = useImageRatio(auto ? media.thumbnail : undefined);
  const ratio = auto ? (coverRatio ?? FALLBACK_RATIO.pdf) : undefined;

  const body =
    media.iframe && href ? (
      <object className="media-fill media-pdf" data={href} type="application/pdf">
        <p className="media-pdf__fallback">
          This browser cannot display the PDF inline.{' '}
          <a href={href} target="_blank" rel="noopener noreferrer">
            Open it in a new tab
          </a>
          .
        </p>
      </object>
    ) : (
      <button type="button" className="media-facade" onClick={open} disabled={!href}>
        <SmartImage
          src={media.thumbnail}
          alt={media.alt ?? media.caption ?? 'Document cover'}
          seed={`${seed}-${media.id}`}
          discipline={discipline}
          label={media.caption}
          className="media-fill"
        />
        <span className="media-facade__play media-facade__play--soft" aria-hidden="true">
          <FileText strokeWidth={1.5} />
        </span>
        <span className="media-facade__note mono">{href ? 'Open document' : 'No file attached'}</span>
      </button>
    );

  if (mode === 'card' || mode === 'focus') return body;

  return (
    <MediaFrame
      aspect={media.aspect}
      ratio={ratio}
      title={media.title}
      caption={media.caption}
      credit={media.credit}
      demo={media.demo}
      kindLabel="PDF"
      actions={
        href ? (
          <Btn size="sm" variant="ghost" iconEnd={<Download />} onClick={open}>
            Open
          </Btn>
        ) : undefined
      }
    >
      {body}
    </MediaFrame>
  );
}
