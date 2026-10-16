import type { PlannedDialogSpec, PlannedSpec } from '@/features/planned/types';

export const caseStudyDialog: PlannedDialogSpec = {
  title: 'Case study',
  previewLabel: 'Preview the case study dialog',
  summary: 'Write up a project so it can be shown to a client.',
  fields: [
    'Project, from the Projects list',
    'Title',
    'Summary',
    'Industry',
    'Technologies, from the Technologies list',
    'Screenshots in order, each with a caption',
    'Whether the client’s name may be shown',
    'Published',
  ],
  happens: [
    'Saved to the case study library.',
    'Screenshots are stored with it. The service has no file storage yet, so that has to be added.',
    'With the client’s name not shown, it reads as anonymous on every link.',
    'Only a published case study can be added to a link.',
  ],
};

export const portfolioLinkDialog: PlannedDialogSpec = {
  title: 'New portfolio link',
  previewLabel: 'Preview the portfolio link dialog',
  summary: 'Make a link for one client with just the case studies that fit what they asked for.',
  fields: [
    'Client, from the Clients list',
    'Case studies, chosen from the library and put in order',
    'A note on what they asked for, shown at the top',
    'Expires on',
  ],
  happens: [
    'A unique link that cannot be guessed is made, and can be copied to send.',
    'The public site shows only the chosen case studies, in that order, under the note.',
    'The list of links shows who each was made for, when it expires and whether it has been opened.',
    'A link can be switched off at any time.',
  ],
};

export const portfolioSpec: PlannedSpec = {
  id: 'portfolio',
  title: 'Portfolio',
  summary:
    'Curate case studies from your projects, then send a client a link to just the ones that fit what they asked for.',
  surface: 'page',
  home: 'Work › Portfolio',
  size: 'L',
  needs: [],
  does: [
    'A library of case studies, each built from a project: title, summary, industry, technologies and screenshots of the app.',
    'A portfolio link for a client: choose and order case studies, add a note on what they asked for, set an expiry. Every link has its own address.',
    'The public site shows that selection and nothing else. It lives in apps/external/portfolio, which is a generated starter with one Home page today, and is not sketched here.',
    'A list of links showing who each was made for, when it expires and whether it has been opened. Any link can be switched off.',
  ],
  buildsOn: [
    'Projects, Clients and the Technologies list, which supply the project facts, who a link is for and the stack.',
    'The octa-website Work pages, where client names and work must not lead until permission is confirmed.',
    'The public portfolio app in this workspace.',
  ],
  decisions: [
    'Where screenshots live. The core service has no file storage today, so this needs an upload endpoint and somewhere to keep the files.',
    'Permission to show each client’s name, and whether an anonymous version is allowed. The website notes say permission is unconfirmed for every client.',
    'Who can open a link: anyone with the address, or also a password. And whether a link expires by default.',
    'Whether opens are recorded, and how much: a count, or each visit with its time. Clients may not expect to be tracked.',
    'Whether case studies written here also feed the website’s Work pages, or stay separate from them.',
    'How the public site reads them: a public read endpoint on the service, or a published snapshot.',
  ],
  dialogs: [caseStudyDialog, portfolioLinkDialog],
};
