/** A dialog that is sketched but not built: the fields it will have and what saving it does. */
export interface PlannedDialogSpec {
  /** The dialog's title, as it will read when built. */
  title: string;
  /** The label of the button on the page that previews it. */
  previewLabel: string;
  summary: string;
  fields: string[];
  happens: string[];
}

export type PlannedSize = 'S' | 'S–M' | 'M' | 'M–L' | 'L';

/** A piece of work that is described but not built. The registry's order is the suggested build order. */
export interface PlannedSpec {
  /** Also the route under `/planned`, for a piece that has a page. */
  id: string;
  title: string;
  /** One sentence: what a partner gets. */
  summary: string;
  /** `page` has a skeleton page; `none` is described on the index only. */
  surface: 'page' | 'none';
  /** Where it will live in the sidebar once built, e.g. "Finance › Cash flow". */
  home: string;
  size: PlannedSize;
  /** Ids of pieces to build first, because this one stores or reads what they change. */
  needs: string[];
  does: string[];
  buildsOn: string[];
  decisions: string[];
  dialogs: PlannedDialogSpec[];
}
