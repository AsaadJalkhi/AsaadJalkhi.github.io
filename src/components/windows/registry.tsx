/**
 * Application registry.
 *
 * The window manager knows nothing about individual apps — it looks them up
 * here. Registering a new app is one entry: id, label, icon, component.
 */
import type { ComponentType } from 'react';
import {
  Briefcase,
  CircleAlert,
  FileText,
  FolderOpen,
  Layers,
  Mail,
  MonitorPlay,
  Sparkles,
  StickyNote,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppId, WindowInstance } from '@/state/os';

import { ProjectsApp } from './apps/ProjectsApp';
import { ProjectApp } from './apps/ProjectApp';
import { NoteApp } from './apps/NoteApp';
import { MediaApp } from './apps/MediaApp';
import { BrowserApp } from './apps/BrowserApp';
import { AboutApp } from './apps/AboutApp';
import { CvApp } from './apps/CvApp';
import { ContactApp } from './apps/ContactApp';
import { SkillsApp } from './apps/SkillsApp';
import { ExperienceApp } from './apps/ExperienceApp';
import { AlertApp } from './apps/AlertApp';

/*
 * The Studio is NOT in this registry, on purpose.
 *
 * It is not an app inside ASAAD.OS any more: it is a separate full-screen mode
 * reachable only by typing `#/studio`, lazily imported by App.tsx. Keeping it
 * out of the registry is what guarantees it cannot leak back into the dock, the
 * command palette or search — there is simply no entry to find.
 */

export interface AppProps {
  win: WindowInstance;
}

export interface AppDefinition {
  id: AppId;
  label: string;
  icon: LucideIcon;
  component: ComponentType<AppProps>;
  /** Shown in the dock. Contextual windows (project, note, media) are not. */
  inDock?: boolean;
}

export const APPS: Record<AppId, AppDefinition> = {
  projects: { id: 'projects', label: 'Projects', icon: FolderOpen, component: ProjectsApp, inDock: true },
  project: { id: 'project', label: 'Case Study', icon: Layers, component: ProjectApp },
  note: { id: 'note', label: 'Notes', icon: StickyNote, component: NoteApp },
  media: { id: 'media', label: 'Media', icon: MonitorPlay, component: MediaApp },
  browser: { id: 'browser', label: 'Browser', icon: Sparkles, component: BrowserApp },
  about: { id: 'about', label: 'About', icon: User, component: AboutApp, inDock: true },
  skills: { id: 'skills', label: 'Capabilities', icon: Sparkles, component: SkillsApp, inDock: true },
  experience: { id: 'experience', label: 'Experience', icon: Briefcase, component: ExperienceApp, inDock: true },
  cv: { id: 'cv', label: 'CV', icon: FileText, component: CvApp, inDock: true },
  contact: { id: 'contact', label: 'Contact', icon: Mail, component: ContactApp },
  alert: { id: 'alert', label: 'System', icon: CircleAlert, component: AlertApp },
};

/*
 * The dock is for things worth launching. Contact lives in the menu bar
 * instead — it is one click either way, and a dock full of every app dilutes
 * the ones that matter.
 */
export const DOCK_APPS: AppDefinition[] = [
  APPS.projects,
  APPS.about,
  APPS.skills,
  APPS.experience,
  APPS.cv,
];
