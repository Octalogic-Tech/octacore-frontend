import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlannedFeature } from '@/features/planned/planned-feature';
import { SkillsDialog } from './skills-dialog';
import { skillsSpec, skillsDialog } from './spec';

/** Skeleton: describes the page and previews its dialog. Replace it with the real page when this is picked up. */
export function SkillsPage() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PlannedFeature
        spec={skillsSpec}
        actions={
          <Button variant="quiet" id="preview-skills" onClick={() => setOpen(true)}>
            {skillsDialog.previewLabel}
          </Button>
        }
      />
      <SkillsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
