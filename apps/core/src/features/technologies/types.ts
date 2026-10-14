export interface Technology {
  id: number;
  name: string;
  description: string;
  category?: string;
  /** Legacy MUI icon names. Kept in the data, no longer shown. */
  iconType?: string;
  iconName?: string;
}
