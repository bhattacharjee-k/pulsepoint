// All dashboard UX copy. Verbatim from docs/brand-ui.md — the source of truth.
// Change copy here, never inline in components.
export const copy = {
  login: {
    title: 'PulsePoint',
    tagline: 'Collect feedback from your product. Triage it in one calm workspace.',
    emailLabel: 'Work email',
    passwordLabel: 'Password',
    submit: 'Sign in',
    error: "We couldn't sign you in. Check your email and password."
  },
  nav: {
    inbox: 'Inbox',
    settings: 'Widget setup',
    signOut: 'Sign out'
  },
  inbox: {
    title: 'Feedback inbox',
    loading: 'Loading feedback…',
    error: 'Couldn’t load feedback. Refresh the page or try again in a moment.',
    emptyHeadline: 'No feedback yet',
    emptyBody: 'Embed the PulsePoint widget on your site. Submissions land here for your team to triage.',
    emptyCta: 'Open widget setup',
    filteredHeadline: 'No matches',
    filteredBody: 'Nothing matches these filters. Clear status, type, or search to see more.',
    searchPlaceholder: 'Search message or submitter',
    keyboardHint: 'j / k navigate · Esc clear selection'
  },
  stats: {
    loading: 'Updating overview…',
    avgRating: 'Average rating',
    noRating: 'No ratings yet'
  },
  detail: {
    empty: 'Select an item from the inbox to review details, update status, and add internal notes.',
    notesTitle: 'Internal notes',
    notesPlaceholder: 'Add context for your team…',
    notesSubmit: 'Add note',
    anonymous: 'Anonymous visitor'
  },
  settings: {
    title: 'Widget setup',
    subtitle: 'Configure how feedback appears on your site and copy the embed snippet.',
    installTitle: 'Install on your site',
    installBody: 'Place this script before </body> on pages where you want the feedback launcher.',
    publicKeyHint: 'Used by the widget to submit feedback. Keep it out of general app code except the embed tag.',
    rotationTitle: 'Key rotation',
    rotationBody:
      'Rotating keys invalidates old embeds until you update the snippet. Rate limits and monitoring are the first line of defense — full rotation UI is planned.',
    demoKeysNote: 'Demo keys: pk_alpha_demo (Alpha) · pk_delta_demo (Delta)'
  },
  member: {
    settingsBlocked: 'Widget setup is available to workspace admins only.'
  }
} as const;
