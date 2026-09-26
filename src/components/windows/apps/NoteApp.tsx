import { usePortfolio } from '@/state/portfolio';
import { findNote } from '@/lib/contentStore';
import { Empty } from '@/components/ui/Ui';
import type { AppProps } from '../registry';
import './apps.css';

/**
 * Plain text files. Tone changes the styling, not the structure. The filename
 * is the window title, so the body starts straight on the text — no header,
 * no line count.
 */
export function NoteApp({ win }: AppProps) {
  const portfolio = usePortfolio();
  const note = findNote(portfolio, win.payload.noteId);

  if (!note) return <Empty title="File not found" />;

  return (
    <div className="note" data-tone={note.tone}>
      <pre className="note__body">{note.body}</pre>
    </div>
  );
}
