import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { serviceMessage } from '@/lib/core-api';
import { useDeleteCountry } from './api';
import type { Country } from './schema';

interface DeleteCountryDialogProps {
  /** The country to delete; null keeps the dialog closed. */
  country: Country | null;
  onClose: () => void;
}

/**
 * Asks before deleting a country. The service refuses a country that a client, an expense or a recurring expense
 * uses, and the last active one that uses US dollars; its message says which, and is shown in the dialog.
 */
export function DeleteCountryDialog({ country, onClose }: DeleteCountryDialogProps) {
  const remove = useDeleteCountry();
  return (
    <ConfirmDialog
      open={country !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Delete country “${country?.nicename ?? ''}”?`}
      description="This cannot be undone. A country that a client, an expense or a recurring expense uses cannot be deleted."
      confirmLabel="Delete country"
      fallbackFocusId="country-search"
      failureMessage={serviceMessage}
      onConfirm={async () => {
        if (country) await remove.mutateAsync(country.id);
      }}
    />
  );
}
