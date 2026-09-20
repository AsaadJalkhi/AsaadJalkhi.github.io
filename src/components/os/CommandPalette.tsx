/**
 * Command palette — Ctrl/Cmd + K.
 *
 * Searches projects, folders, media, notes, companies, skills and apps, and
 * also runs system commands. The index is built once per content load; matching
 * is a linear scan, which is instant at this size.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { useOs } from '@/state/os';
import { usePortfolio } from '@/state/portfolio';
import { useViewport } from '@/hooks/useEnvironment';
import { buildIndex, searchEntries, type SearchEntry } from '@/lib/search';
import { cx } from '@/lib/utils';

const KIND_LABEL: Record<SearchEntry['kind'], string> = {
  app: 'App',
  project: 'Project',
  folder: 'Folder',
  note: 'File',
  media: 'Media',
  skill: 'Skill',
  company: 'Company',
  action: 'Action',
};

export function CommandPalette() {
  const portfolio = usePortfolio();
  const viewport = useViewport();
  const open = useOs((state) => state.paletteOpen);
  const setPalette = useOs((state) => state.setPalette);
  const openWindow = useOs((state) => state.openWindow);
  const setView = useOs((state) => state.setView);
  const tidy = useOs((state) => state.tidy);
  const closeAll = useOs((state) => state.closeAll);
  const resetDesktop = useOs((state) => state.resetDesktop);
  const cursorEnabled = useOs((state) => state.cursorEnabled);
  const setCursorEnabled = useOs((state) => state.setCursorEnabled);

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => buildIndex(portfolio), [portfolio]);
  const results = useMemo(() => searchEntries(index, query), [index, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  const run = (entry: SearchEntry) => {
    setPalette(false);
    const { action } = entry;
    switch (action.type) {
      case 'window':
        openWindow({
          app: action.app,
          title: action.title,
          subtitle: action.subtitle,
          payload: action.payload,
        });
        break;
      case 'view':
        setView(action.view);
        break;
      case 'url':
        window.open(action.url, '_blank', 'noopener,noreferrer');
        break;
      case 'command':
        if (action.command === 'tidy') tidy(viewport);
        if (action.command === 'closeAll') closeAll();
        if (action.command === 'reset') resetDesktop();
        if (action.command === 'cursor') setCursorEnabled(!cursorEnabled);
        break;
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = results[active];
      if (entry) run(entry);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setPalette(false);
    }
  };

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
      <button
        type="button"
        className="palette__scrim"
        aria-label="Close search"
        onClick={() => setPalette(false)}
      />

      <div className="palette__panel">
        <div className="palette__field">
          <input
            ref={inputRef}
            className="palette__input"
            type="text"
            value={query}
            placeholder="Search projects, files, skills, commands…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search"
            aria-controls="palette-results"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="mono palette__esc">esc</kbd>
        </div>

        <ul className="palette__results" id="palette-results" role="listbox">
          {results.length === 0 && (
            <li className="palette__none">No matches for “{query}”</li>
          )}
          {results.map((entry, i) => (
            <li key={entry.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={cx('palette__item', i === active && 'palette__item--active')}
                onPointerEnter={() => setActive(i)}
                onClick={() => run(entry)}
              >
                <span className="palette__item-main">
                  <span className="palette__item-title">{entry.title}</span>
                  {entry.subtitle && <span className="palette__item-sub">{entry.subtitle}</span>}
                </span>
                <span className="mono palette__item-kind">{KIND_LABEL[entry.kind]}</span>
                {i === active && <CornerDownLeft className="palette__item-enter" strokeWidth={1.5} />}
              </button>
            </li>
          ))}
        </ul>

        <div className="palette__footer mono">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
