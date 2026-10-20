import { useCallback } from 'react';
import { useController, type Control } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import type { QuoteFormValues } from './schema';

type DescriptionName = `sections.${number}.lines.${number}.description`;

interface LineDescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The editor's own form: the dialog sits in a portal outside the `<form>`, so it writes to the form by its control. */
  control: Control<QuoteFormValues>;
  name: DescriptionName;
  /** The line's number in the whole quote, from 1. */
  number: number;
  /** The line's title as it stands, to say which line this is. */
  title: string;
}

/**
 * A line's description, out of the line so the table stays compact. It holds no state of its own: every keystroke is in
 * the form, so Done, Escape and the close mark all keep what was typed, and Save sends it.
 */
export function LineDescriptionDialog({ open, onOpenChange, control, name, number, title }: LineDescriptionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Description</DialogTitle>
        <DialogDescription>{`Line ${number}: ${title.trim() || 'untitled'}`}</DialogDescription>
        <div className="mt-6 grid gap-6">
          <DescriptionField control={control} name={name} id={`line-${number}-description`} />
          <div>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mounted only while the dialog is open, so the quote never has more than this one description text area. It opens with
 * the caret after the text, so typing adds to it: the caret is put there before the dialog focuses the field, and focus
 * keeps it.
 */
function DescriptionField({ control, name, id }: { control: Control<QuoteFormValues>; name: DescriptionName; id: string }) {
  const { field } = useController({ control, name });
  const { ref } = field;
  const attach = useCallback(
    (element: HTMLTextAreaElement | null) => {
      ref(element);
      if (element) element.setSelectionRange(element.value.length, element.value.length);
    },
    [ref],
  );
  return (
    <Field label="Description" htmlFor={id}>
      <Textarea
        id={id}
        rows={6}
        name={field.name}
        ref={attach}
        value={field.value}
        onChange={field.onChange}
        onBlur={field.onBlur}
      />
    </Field>
  );
}
