import { useState } from 'react';
import { ArrowUpRight, Check, Copy, Mail } from 'lucide-react';
import { usePortfolio } from '@/state/portfolio';
import { copyText } from '@/lib/utils';
import { Btn, Meta } from '@/components/ui/Ui';
import type { AppProps } from '../registry';
import './apps.css';

/**
 * Contact. No backend — a static site should not pretend to have one, so this
 * is a mailto plus real links, which is what people use anyway.
 *
 * The headline is authored in full (`profile.contact.headline`). It used to be
 * assembled as "Open to " + `profile.availability`, which read as "Open to open
 * to marketing, creative and digital roles" the moment availability was written
 * as a sentence. Gluing prose together in a template is how that happens; one
 * editable string is both simpler and correct.
 */
export function ContactApp(_props: AppProps) {
  const { profile } = usePortfolio();
  const [copied, setCopied] = useState(false);

  const headline = profile.contact.headline ?? profile.availability ?? 'Open to new work.';

  const handleCopy = async () => {
    const ok = await copyText(profile.email);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="contact">
      <Meta>Contact</Meta>
      <h1 className="contact__title">{headline}</h1>

      <div className="contact__email">
        <span className="contact__email-address">{profile.email}</span>
        <div className="contact__email-actions">
          <Btn
            size="sm"
            variant={copied ? 'quiet' : 'outline'}
            icon={copied ? <Check /> : <Copy />}
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy'}
          </Btn>
          <Btn
            size="sm"
            variant="primary"
            icon={<Mail />}
            onClick={() => window.open(`mailto:${profile.email}`, '_self')}
          >
            Email
          </Btn>
        </div>
      </div>

      <ul className="contact__socials">
        {profile.socials.map((social) => (
          <li key={social.url}>
            <a
              className="contact__social"
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="contact__social-label">{social.label}</span>
              <span className="contact__social-handle">{social.handle ?? social.url}</span>
              <ArrowUpRight className="contact__social-arrow" strokeWidth={1.5} />
            </a>
          </li>
        ))}
      </ul>

      {profile.contact.note && <p className="contact__note">{profile.contact.note}</p>}
    </div>
  );
}
