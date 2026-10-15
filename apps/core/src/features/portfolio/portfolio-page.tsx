import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlannedFeature } from '@/features/planned/planned-feature';
import { CaseStudyDialog } from './case-study-dialog';
import { PortfolioLinkDialog } from './portfolio-link-dialog';
import { caseStudyDialog, portfolioLinkDialog, portfolioSpec } from './spec';

/** Skeleton: describes the page and previews its two dialogs. Replace it with the real page when this is picked up. */
export function PortfolioPage() {
  const [caseStudy, setCaseStudy] = useState(false);
  const [link, setLink] = useState(false);
  return (
    <>
      <PlannedFeature
        spec={portfolioSpec}
        actions={
          <>
            <Button variant="quiet" id="preview-case-study" onClick={() => setCaseStudy(true)}>
              {caseStudyDialog.previewLabel}
            </Button>
            <Button variant="quiet" id="preview-portfolio-link" onClick={() => setLink(true)}>
              {portfolioLinkDialog.previewLabel}
            </Button>
          </>
        }
      />
      <CaseStudyDialog open={caseStudy} onOpenChange={setCaseStudy} />
      <PortfolioLinkDialog open={link} onOpenChange={setLink} />
    </>
  );
}
