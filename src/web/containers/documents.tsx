import { useState } from 'react';

import { DocumentsSection, type ICustomArtifact } from '#/web/components/documents.tsx';

import { AddDocumentDialog } from './add-document.tsx';

// The Documents section of the Posting tab, with its add Dialog: a Custom Artifact of the Posting, or an
// Annex in the Profile, which the page shows once the fetcher revalidates it
export function Documents({
  reference,
  customArtifactList,
}: Readonly<{ reference: string; customArtifactList: ICustomArtifact[] }>) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  return (
    <>
      <DocumentsSection
        customArtifactList={customArtifactList}
        onAdd={() => {
          setIsAddOpen(true);
        }}
      />
      <AddDocumentDialog
        reference={reference}
        interviewNumber={null}
        isAnnexAllowed
        isFromPanel={false}
        isOpen={isAddOpen}
        onOpenChange={setIsAddOpen}
      />
    </>
  );
}
