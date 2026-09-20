import { usePortfolio } from '@/state/portfolio';
import { findNote } from '@/lib/contentStore';
import { Empty } from '@/components/ui/Ui';
import type { AppProps } from '../registry';
import './apps.css';

/** Plain text files. Tone changes the styling, not the structure. */
export function NoteApp({ win }: AppProps) {
  const portfolio = usePortfolio();
  const note = findNote(portfolio, win.payload.noteId);

  if (!note) return <Empty title="File not found" />;

  return (
    <div className="note" data-tone={note.tone}>
      <div className="note__head mono">
        <span>{note.title}</span>
        <span>{note.body.split('\n').length} lines</span>
      </div>
      <pre className="note__body">{note.body}</pre>
    </div>
  );
}
