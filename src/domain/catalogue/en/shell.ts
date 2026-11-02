// The shell around every page: the Sidebar, its Candidate switcher, the theme toggle and the toasts
// of a switch (spec #125, DESIGN.md « Navigation (Sidebar) »)
export const SHELL_EN = {
  navigationLabel: 'Pages',
  link: {
    new: 'New',
    toApply: 'To Apply',
    applications: 'Applications',
    profile: 'Profile',
    watches: 'Watches',
    settings: 'Settings',
  },
  sidebar: {
    title: 'Menu',
    description: 'The pages of Job Finder',
    toggle: 'Collapse or expand the menu',
  },
  candidate: {
    switcherLabel: 'Switch Candidate',
    role: 'Candidate',
    noCandidate: 'Choose a Candidate',
    listLabel: 'Candidates',
    manage: 'Manage the Candidates',
    switched: 'You are reading {{candidateName}}’s Postings.',
  },
  theme: {
    toggle: 'Switch between light and dark mode',
  },
  localeSwitched: 'The interface is in English.',
};
