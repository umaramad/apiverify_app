/**
 * Feature registry — the app's top-level tools.
 *
 * Each feature renders as a card on the Home landing page and scopes the
 * sidebar to its own menu items. To add a new feature later: create its page(s),
 * register them in PageRouter + AppHeader, then add one entry to FEATURES here
 * (with the page ids it owns) — the landing page and sidebar pick it up.
 */
import type { ComponentType } from 'react'
import DashboardIcon from '@mui/icons-material/Dashboard'
import FolderCopyIcon from '@mui/icons-material/FolderCopy'
import DnsIcon from '@mui/icons-material/Dns'
import SchemaIcon from '@mui/icons-material/Schema'
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import BarChartIcon from '@mui/icons-material/BarChart'
import ScheduleIcon from '@mui/icons-material/Schedule'
import TerminalIcon from '@mui/icons-material/Terminal'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import {
  LINUX_SEARCH_ASSISTANT_PAGE_ID,
  LOCAL_LOG_VIEWER_PAGE_ID,
} from '../../../modules/linuxSearchAssistant/models'
import type { ActivePage } from '../store/app.store'

export type MenuItemDef = {
  id: ActivePage
  label: string
  /** Loose component type so any MUI icon (or custom svg) is assignable. */
  icon: ComponentType<{ sx?: object }>
  countKey: string | null
}

/** Menus shown while the REST API Validator feature is active. */
export const API_VERIFY_MENU_ITEMS: MenuItemDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, countKey: null },
  { id: 'projects', label: 'Workspaces', icon: FolderCopyIcon, countKey: 'projects' },
  { id: 'environments', label: 'Environments', icon: DnsIcon, countKey: 'environments' },
  { id: 'apis', label: 'API Specifications', icon: SchemaIcon, countKey: 'specs' },
  { id: 'runner', label: 'Validation Runner', icon: PlayCircleOutlinedIcon, countKey: null },
  { id: 'scheduler', label: 'Scheduler', icon: ScheduleIcon, countKey: 'schedulesCompleted' },
  { id: 'results', label: 'Validation Results', icon: AssignmentTurnedInIcon, countKey: 'history' },
  { id: 'reports', label: 'Reports', icon: BarChartIcon, countKey: null },
]

export const LINUX_SEARCH_MENU_ITEM: MenuItemDef = {
  id: LINUX_SEARCH_ASSISTANT_PAGE_ID,
  label: 'Linux Search Assistant',
  icon: TerminalIcon,
  countKey: null,
}

export const LOCAL_LOG_VIEWER_MENU_ITEM: MenuItemDef = {
  id: LOCAL_LOG_VIEWER_PAGE_ID,
  label: 'Local Log Viewer',
  icon: DescriptionOutlinedIcon,
  countKey: null,
}

/** Always-available launcher item at the top of the sidebar. */
export const HOME_MENU_ITEM: MenuItemDef = {
  id: 'home',
  label: 'Home',
  icon: HomeOutlinedIcon,
  countKey: null,
}

export interface FeatureDef {
  /** Stable id, used for sidebar scoping. */
  id: string
  name: string
  tagline: string
  description: string
  /** Loose component type so any MUI icon (or custom svg) is assignable. */
  icon: ComponentType<{ sx?: object }>
  /** CSS gradient for the card's icon tile. */
  gradient: string
  /** Page to open when the feature card is clicked. */
  defaultPage: ActivePage
  /** Every page owned by this feature — used to scope the sidebar. */
  pageIds: ActivePage[]
}

export const REST_VALIDATOR_FEATURE: FeatureDef = {
  id: 'rest-validator',
  name: 'REST API Validator',
  tagline: 'Design, run, and validate your APIs',
  description: 'OpenAPI workspaces, environments, collections, scheduling, and compliance reports.',
  icon: SchemaIcon,
  gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
  defaultPage: 'dashboard',
  pageIds: API_VERIFY_MENU_ITEMS.map((item) => item.id),
}

export const LINUX_SEARCH_FEATURE: FeatureDef = {
  id: 'linux-search',
  name: 'Linux Search Assistant',
  tagline: 'Inspect servers and logs',
  description: 'Grep logs over SSH, replay recent actions, analyze output with AI, and read local logs.',
  icon: TerminalIcon,
  gradient: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
  defaultPage: LINUX_SEARCH_ASSISTANT_PAGE_ID,
  pageIds: [LINUX_SEARCH_ASSISTANT_PAGE_ID, LOCAL_LOG_VIEWER_PAGE_ID],
}

export const FEATURES: FeatureDef[] = [REST_VALIDATOR_FEATURE, LINUX_SEARCH_FEATURE]

/** Which feature owns the given page (null for global pages like home/settings). */
export function findFeatureByPage(page: ActivePage): FeatureDef | null {
  return FEATURES.find((feature) => feature.pageIds.includes(page)) ?? null
}
