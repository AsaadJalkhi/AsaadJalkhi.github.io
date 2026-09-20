import { ArrowUpRight, Globe, Lock } from 'lucide-react';
import { hostOf } from '@/lib/paths';
import { Poster } from '@/components/ui/Poster';
import { Btn, Empty } from '@/components/ui/Ui';
import type { AppProps } from '../registry';
import './apps.css';

/**
 * In-OS browser.
 *
 * Deliberately does NOT iframe arbitrary sites — most refuse to be framed and
 * a blank grey box is worse than an honest preview card with a real link out.
 */
export function BrowserApp({ win }: AppProps) {
  const url = win.payload.url;
  if (!url) return <Empty title="No address" icon={<Globe />} />;

  const host = hostOf(url);
  const open = () => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <div className="browser">
      <div className="browser__chrome">
        <Lock className="browser__lock" strokeWidth={1.5} />
        <span className="browser__address mono">{url}</span>
        <Btn size="sm" variant="ghost" iconEnd={<ArrowUpRight />} onClick={open}>
          Open
        </Btn>
      </div>

      <div className="browser__page">
        <Poster seed={`browser-${host}`} label={host} discipline="digital" bare />
        <div className="browser__overlay">
          <p className="mono browser__host">{host}</p>
          <p className="browser__note">
            External sites open in a new tab — ASAAD.OS does not embed pages it does not control.
          </p>
          <Btn variant="primary" iconEnd={<ArrowUpRight />} onClick={open}>
            Visit {host}
          </Btn>
        </div>
      </div>
    </div>
  );
}
