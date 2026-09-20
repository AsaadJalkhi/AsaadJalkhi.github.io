/**
 * Portfolio Studio — local content management.
 *
 * IMPORTANT, and by design: this cannot publish. The site is a static build on
 * GitHub Pages, and writing to the repository from the browser would mean
 * shipping a GitHub token in client-side JavaScript, where anyone could read
 * it. So the Studio edits a draft, validates it, and hands you a file. You
 * commit that file. See the Export panel for the four steps.
 *
 * Swapping in a real CMS later means replacing `useDraft`'s load/save with API
 * calls — every panel below is already written against that interface.
 *
 * The navigation is grouped by what you are actually trying to do rather than
 * by the shape of the JSON: the work, then you, then the desktop it all sits
 * on, then publishing. Panels themselves are unchanged in capability.
 */
import { useState } from 'react';
import {
  Braces,
  Briefcase,
  Download,
  FolderTree,
  LayoutGrid,
  Palette,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  User,
  Wrench,
} from 'lucide-react';
import { useDraft, type DraftApi, type PanelProps, type StaleDraft } from './useDraft';
import { PinGate } from './PinGate';
import { ProjectsPanel } from './panels/ProjectsPanel';
import { FoldersPanel } from './panels/FoldersPanel';
import { ExperiencePanel } from './panels/ExperiencePanel';
import { SkillsPanel } from './panels/SkillsPanel';
import { ProfilePanel } from './panels/ProfilePanel';
import { DesktopPanel } from './panels/DesktopPanel';
import { AppearancePanel } from './panels/AppearancePanel';
import { ExportPanel } from './panels/ExportPanel';
import { StudioBoundary } from './panels/parts';
import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/lib/utils';
import './studio.css';

type TabId =
  | 'projects'
  | 'folders'
  | 'experience'
  | 'skills'
  | 'profile'
  | 'desktop'
  | 'appearance'
  | 'export';

interface Tab {
  id: TabId;
  label: string;
  icon: LucideIcon;
  panel: ComponentType<PanelProps>;
}

const GROUPS: Array<{ title: string; tabs: Tab[] }> = [
  {
    title: 'Your work',
    tabs: [
      { id: 'projects', label: 'Projects', icon: LayoutGrid, panel: ProjectsPanel },
      { id: 'folders', label: 'Folders', icon: FolderTree, panel: FoldersPanel },
    ],
  },
  {
    title: 'About you',
    tabs: [
      { id: 'profile', label: 'Profile & CV', icon: User, panel: ProfilePanel },
      { id: 'experience', label: 'Experience', icon: Briefcase, panel: ExperiencePanel },
      { id: 'skills', label: 'Capabilities', icon: Wrench, panel: SkillsPanel },
    ],
  },
  {
    title: 'The desktop',
    tabs: [
      { id: 'desktop', label: 'Desktop & dock', icon: Sparkles, panel: DesktopPanel },
      { id: 'appearance', label: 'Appearance', icon: Palette, panel: AppearancePanel },
    ],
  },
];

const ALL_TABS = GROUPS.flatMap((group) => group.tabs);

export function StudioApp() {
  return (
    <PinGate>
      <StudioWorkspace />
    </PinGate>
  );
}

/**
 * Shown when a saved draft was based on a DIFFERENT portfolio.json.
 *
 * This screen exists because the alternative — quietly loading the old draft —
 * destroyed real content once already (see the header of `useDraft.ts`). The
 * safe action is the primary one, and nothing is merged automatically. The old
 * draft stays in localStorage until the human picks, so closing the tab here
 * loses nothing.
 */
function StaleDraftRecovery({
  stale,
  onLoadCurrent,
  onRecover,
}: {
  stale: StaleDraft;
  onLoadCurrent: () => void;
  onRecover: () => void;
}) {
  const savedAt = stale.savedAt ? new Date(stale.savedAt) : null;

  const download = () => {
    const blob = new Blob([`${JSON.stringify(stale.data, null, 2)}\n`], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio.old-studio-draft.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="studio-recovery">
      <div className="studio-recovery__card">
        <TriangleAlert className="studio-recovery__icon" strokeWidth={1.4} />
        <h1>Your saved Studio draft was created from an older version of the portfolio.</h1>
        <p>
          Loading it would replace the content currently in <code>portfolio.json</code> — including
          anything added since{' '}
          {savedAt
            ? `this draft was saved on ${savedAt.toLocaleDateString()} at ${savedAt.toLocaleTimeString()}`
            : 'the draft was saved'}
          . Wallpapers, widgets and desktop shortcuts have been lost this way before.
        </p>
        <div className="studio-recovery__actions">
          <button type="button" className="studio-recovery__primary" onClick={onLoadCurrent}>
            Load current portfolio
          </button>
          <button type="button" className="studio-recovery__ghost" onClick={onRecover}>
            Recover old draft
          </button>
          <button type="button" className="studio-recovery__ghost" onClick={download}>
            <Download strokeWidth={1.4} />
            Download old draft
          </button>
        </div>
        <p className="studio-recovery__note">
          Not sure? Choose <strong>Load current portfolio</strong>. Download the old draft first if
          you want to compare the two by hand — nothing is deleted until you pick.
        </p>
      </div>
    </div>
  );
}

/** Confirmed "throw the draft away and re-read portfolio.json". */
function ReloadButton({ api }: { api: DraftApi }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className="studio__reload"
        onClick={() => setConfirming(true)}
        title="Discard this draft and start again from src/content/portfolio.json"
      >
        <RotateCcw strokeWidth={1.4} />
        <span>Reload from current portfolio</span>
      </button>
    );
  }

  return (
    <div className="studio__reload-confirm">
      <p>Discard every unexported change in this draft?</p>
      <div>
        <button
          type="button"
          className="studio__reload-yes"
          onClick={() => {
            api.reloadFromPortfolio();
            setConfirming(false);
          }}
        >
          Discard and reload
        </button>
        <button type="button" onClick={() => setConfirming(false)}>
          Keep editing
        </button>
      </div>
    </div>
  );
}

function StudioWorkspace() {
  const api = useDraft();
  const [tab, setTab] = useState<TabId>('projects');

  if (api.staleDraft) {
    return (
      <StaleDraftRecovery
        stale={api.staleDraft}
        onLoadCurrent={api.discardStaleDraft}
        onRecover={api.adoptStaleDraft}
      />
    );
  }

  const active = ALL_TABS.find((t) => t.id === tab);
  const Panel = active?.panel;
  const issues = api.validation.ok ? [] : api.validation.issues;

  return (
    <div className="studio">
      <aside className="studio__nav">
        {GROUPS.map((group) => (
          <div key={group.title} className="studio__group">
            <p className="studio__nav-title">{group.title}</p>
            {group.tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cx('studio__tab', tab === item.id && 'studio__tab--active')}
                  onClick={() => setTab(item.id)}
                >
                  <Icon strokeWidth={1.4} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}

        <div className="studio__group">
          <p className="studio__nav-title">Publish</p>
          <button
            type="button"
            className={cx('studio__tab', tab === 'export' && 'studio__tab--active')}
            onClick={() => setTab('export')}
          >
            <Braces strokeWidth={1.4} />
            <span>Export &amp; import</span>
          </button>
        </div>

        <div className="studio__status" data-ok={api.validation.ok || undefined}>
          <span className="studio__status-dot" />
          <span>
            {api.validation.ok
              ? 'Content is valid'
              : `${issues.length} problem${issues.length === 1 ? '' : 's'} to fix`}
          </span>
        </div>

        <ReloadButton api={api} />
      </aside>

      <div className="studio__main">
        {!api.validation.ok && (
          <div className="studio__issues">
            <p className="studio__issues-title">Fix these before exporting</p>
            <ul>
              {issues.slice(0, 8).map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>
                  <code>{issue.path}</code> {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/*
         * Outer boundary. Each Section carries its own (see parts.tsx), but a
         * panel does work above its sections too — building the dropdown lists,
         * for instance — and a throw there would otherwise unmount the whole
         * React root and leave a white page. Keyed by tab so switching away and
         * back re-attempts the render instead of latching the error forever.
         */}
        <StudioBoundary key={tab} what={tab === 'export' ? 'Export & import' : (active?.label ?? 'This panel')}>
          {tab === 'export' ? (
            <ExportPanel api={api} />
          ) : Panel ? (
            <Panel draft={api.draft} update={api.update} />
          ) : null}
        </StudioBoundary>
      </div>
    </div>
  );
}
