export type CardSize = "small" | "medium" | "large" | "full";

export interface CardDimensions {
  width?: number;
  height?: number;
  colSpan?: 1 | 2 | 3;
}

export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

export interface CardSettings {
  id: string;
  order: number;
  pinned: boolean;
  size: CardSize;
  dimensions?: CardDimensions;
  // React-grid-layout properties
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export interface ProjectDashboardSettings {
  cardOrder: CardSettings[];
}

export interface UserSettings {
  id?: string;
  userId: string;
  projectDashboard: ProjectDashboardSettings;
  updatedAt: number;
}

// Grid layout: 12 columns
export const GRID_COLS = 12;
export const GRID_ROW_HEIGHT = 100;

export const DEFAULT_CARD_ORDER: CardSettings[] = [
  {
    id: "queue-status",
    order: 0,
    pinned: false,
    size: "full",
    x: 0,
    y: 0,
    w: 12,
    h: 2,
  },
  {
    id: "pipeline-progress",
    order: 1,
    pinned: false,
    size: "full",
    x: 0,
    y: 2,
    w: 12,
    h: 3,
  },
  {
    id: "project-details",
    order: 2,
    pinned: false,
    size: "medium",
    x: 0,
    y: 5,
    w: 4,
    h: 3,
  },
  {
    id: "quick-actions",
    order: 3,
    pinned: false,
    size: "medium",
    x: 4,
    y: 5,
    w: 4,
    h: 3,
  },
  {
    id: "statistics",
    order: 4,
    pinned: false,
    size: "medium",
    x: 8,
    y: 5,
    w: 4,
    h: 3,
  },
];

export const SIZE_TO_COL_SPAN: Record<CardSize, 1 | 2 | 3> = {
  small: 1,
  medium: 1,
  large: 2,
  full: 3,
};
