/**
 * Export / import.
 *
 * The Studio's entire publishing story, stated plainly rather than faked.
 */
import { useRef, useState } from 'react';
import { Check, ClipboardCopy, Download, RotateCcw, Upload } from 'lucide-react';
import { copyText, download } from '@/lib/utils';
import { Btn } from '@/components/ui/Ui';
import type { DraftApi } from '../useDraft';

const STEPS = [
  'Download portfolio.json using the button above.',
  'Replace src/content/portfolio.json in your project with the downloaded file.',
  'Commit the change and push it to GitHub.',
  'GitHub Actions rebuilds the site and Pages redeploys it — usually under two minutes.',
];

export function ExportPanel({ api }: { api: DraftApi }) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const blocked = !api.validation.ok;

  const handleImport = async (file: File) => {
    const text = await file.text();
    const result = api.importJson(text);
    setMessage(
      result.ok
        ? { tone: 'ok', text: `Imported ${file.name}. Review the panels, then export again.` }
        : { tone: 'bad', text: result.message },
    );
  };

  return (
    <div className="studio-panel">
      <header className="studio-panel__head">
        <h2 className="studio-panel__title">Export &amp; publish</h2>
        <p className="studio-panel__lede">
          This site is a static build. The Studio cannot write to your repository — doing so from
          the browser would require a GitHub token in client-side code, which would be readable by
          anyone who opened the page. Export the file and commit it instead.
        </p>
      </header>

      <div className="studio-export__actions">
        <Btn
          variant="primary"
          icon={<Download />}
          disabled={blocked}
          onClick={() => download('portfolio.json', api.json)}
        >
          Download portfolio.json
        </Btn>

        <Btn
          variant="outline"
          icon={copied ? <Check /> : <ClipboardCopy />}
          disabled={blocked}
          onClick={async () => {
            if (!(await copyText(api.json))) return;
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? 'Copied' : 'Copy JSON'}
        </Btn>

        <Btn variant="outline" icon={<Upload />} onClick={() => fileInput.current?.click()}>
          Import JSON
        </Btn>

        <Btn variant="ghost" icon={<RotateCcw />} onClick={api.reset}>
          Discard changes
        </Btn>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImport(file);
            event.target.value = '';
          }}
        />
      </div>

      {blocked && (
        <p className="studio-export__blocked">
          Export is disabled while the draft has validation problems — see the list above. This
          stops a broken file from reaching your live site.
        </p>
      )}

      {message && (
        <p className={`studio-export__message studio-export__message--${message.tone}`}>
          {message.text}
        </p>
      )}

      <section className="studio-export__steps">
        <h3 className="mono studio-export__steps-title">How to publish</h3>
        <ol>
          {STEPS.map((step, index) => (
            <li key={step}>
              <span className="mono studio-export__step-n">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="studio-export__preview">
        <h3 className="mono studio-export__steps-title">Preview</h3>
        <pre className="studio-export__json">{api.json.slice(0, 4000)}</pre>
        {api.json.length > 4000 && (
          <p className="mono studio-export__truncated">
            …truncated for display — the download contains the whole file.
          </p>
        )}
      </section>
    </div>
  );
}
