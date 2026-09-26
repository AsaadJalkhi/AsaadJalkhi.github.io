/**
 * Studio preview — the current, unsaved draft drawn by the live renderers.
 *
 * Before this existed, seeing an edit meant export → replace portfolio.json →
 * back to the OS → open the folder → open the project. Now the draft the
 * panel is editing is handed straight to the components the OS itself uses:
 *
 *   - **Project** is `CaseStudyBody`, the body of the project window —
 *     banner, header, facts, narrative, the media masonry, footer and links.
 *   - **Folder** is `WorkView`, the content of the Work window — the same
 *     filter row, ordering, cards, thumbnails and packed grid.
 *
 * There is no Studio copy of either layout. If the live case study or the Work
 * grid changes, this changes with it, because it is the same code.
 *
 * **Read-only, and isolated.** Both renderers take their data as props, so the
 * draft goes in and nothing comes out: no window is opened, the hash is not
 * touched, the published portfolio is not read or written, nothing is exported
 * or saved. Opening a card in Folder mode switches this overlay to Project
 * mode for that card — it never calls `openProject`.
 *
 * **Widths are container widths.** Desktop / Narrow / Mobile only resize the
 * stage the renderers sit in. The masonry and Work grid measure their own
 * container, so they respond exactly as they do in a resized window; rules
 * keyed to the *viewport* (a few `@media` queries in apps.css) do not, because
 * the viewport has not changed.
 *
 * Nothing here is mounted while the overlay is closed — the panel renders it
 * conditionally — so no media is loading behind the editor.
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Portfolio } from '@/types/content';
import { findProject } from '@/lib/contentStore';
import { readStore, storageKeys, writeStore } from '@/lib/storage';
import { cx } from '@/lib/utils';
import { Empty } from '@/components/ui/Ui';
import { CaseStudyBody } from '@/components/windows/apps/ProjectApp';
import { WorkView } from '@/components/windows/apps/ProjectsApp';
import { IconBtn, StudioBoundary } from './parts';

type Mode = 'project' | 'folder';
type Width = 'desktop' | 'narrow' | 'mobile';

const MODES: { value: Mode; label: string }[] = [
  { value: 'project', label: 'Project' },
  { value: 'folder', label: 'Folder' },
];

/** The pixel widths themselves live in studio.css, on `[data-width]`. */
const WIDTHS: { value: Width; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'narrow', label: 'Narrow' },
  { value: 'mobile', label: 'Mobile' },
];

export function ProjectPreview({
  draft,
  projectId,
  onClose,
}: {
  draft: Portfolio;
  projectId: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>('project');
  const [width, setWidthState] = useState<Width>(() => {
    const saved = readStore<Width>(storageKeys.studioPreviewWidth, 'desktop');
    return WIDTHS.some((option) => option.value === saved) ? saved : 'desktop';
  });
  // Starts on the project being edited; Folder mode can point it at another card.
  const [shownId, setShownId] = useState(projectId);
  const shown = findProject(draft, shownId) ?? findProject(draft, projectId);
  const [folder, setFolder] = useState<string | null>(shown?.folder ?? null);

  const setWidth = (next: Width) => {
    setWidthState(next);
    writeStore(storageKeys.studioPreviewWidth, next);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Focus Mode, opened from inside the preview, owns its own Escape. Close
      // one layer at a time.
      if (document.querySelector('.focus')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="studio-preview" role="dialog" aria-modal="true" aria-label="Draft preview">
      <header className="studio-preview__bar">
        <div className="studio-media__view" role="group" aria-label="Preview mode">
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cx('studio-media__view-btn', mode === option.value && 'is-on')}
              aria-pressed={mode === option.value}
              onClick={() => setMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="studio-media__view" role="group" aria-label="Preview width">
          {WIDTHS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cx('studio-media__view-btn', width === option.value && 'is-on')}
              aria-pressed={width === option.value}
              onClick={() => setWidth(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="mono studio-preview__note">
          Unsaved draft{shown ? ` · ${shown.title}` : ''} · nothing is exported
        </span>

        <IconBtn label="Close preview" onClick={onClose}>
          <X strokeWidth={1.5} />
        </IconBtn>
      </header>

      <div className="studio-preview__viewport">
        <div className="studio-preview__stage" data-mode={mode} data-width={width}>
          {/* Keyed so a render error in one project does not stick to the next. */}
          <StudioBoundary key={`${mode}-${shown?.id ?? ''}`} what="The preview">
            {mode === 'project' ? (
              shown ? (
                <CaseStudyBody project={shown} />
              ) : (
                <Empty title="Nothing to preview" hint="This project no longer exists in the draft." />
              )
            ) : (
              <WorkView
                portfolio={draft}
                activeFolder={folder}
                onFilter={setFolder}
                onOpen={(id) => {
                  setShownId(id);
                  setMode('project');
                }}
              />
            )}
          </StudioBoundary>
        </div>
      </div>
    </div>
  );
}
