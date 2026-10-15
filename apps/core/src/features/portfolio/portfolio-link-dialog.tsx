import { PlannedDialog, type PlannedDialogToggle } from '@/features/planned/planned-dialog';
import { portfolioLinkDialog } from './spec';

export function PortfolioLinkDialog(props: PlannedDialogToggle) {
  return <PlannedDialog {...props} spec={portfolioLinkDialog} fallbackFocusId="preview-portfolio-link" />;
}
