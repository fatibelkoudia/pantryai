import type { en } from './en.js';

// French catalog. Right now it's just a copy of the English one so the app
// doesn't break when someone switches to French. The real translations will be
// filled in later in one pass. The `typeof en` type makes sure we can't forget
// a key once we do.
export const fr: typeof en = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Something went wrong. Please try again.',
  },
  profile: {
    title: 'Profile',
    account: 'Account',
    name: 'Name',
    namePlaceholder: 'Your name',
    email: 'Email',
    chooseAvatar: 'Choose your avatar',
    xp: '{{count}} XP',
    challengesDone: '{{done}} / {{total}} challenges done',
    viewChallenges: 'View challenges',
    logout: 'Log out',
    emailTaken: 'This email is already used by another account.',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    languages: {
      en: 'English',
      fr: 'French',
    },
    recipeMinMatchedItems: 'Minimum items from my stock',
    recipeMinMatchedItemsHint: 'Only suggest recipes that use at least this many items you have.',
    recipeMatchThreshold: 'Ingredient match',
    recipeMatchThresholdHint:
      'Only suggest recipes where you own at least this share of the ingredients.',
    expiringSoonDays: 'Expiring soon window',
    expiringSoonDaysHint: 'Days before the date where an item counts as expiring soon.',
    daysUnit: '{{count}} days',
    lowStockThreshold: 'Low stock threshold',
    lowStockThresholdHint: 'Quantity at or below this goes on the shopping list.',
    defaultStockLocation: 'Default storage location',
    locations: {
      FRIDGE: 'Fridge',
      FREEZER: 'Freezer',
      PANTRY: 'Pantry',
    },
    unsavedHint: 'You have unsaved changes.',
    unsavedTitle: 'Unsaved changes',
    unsavedBody: 'Your settings changes are not saved yet. Leave without saving?',
    discard: 'Leave without saving',
    keepEditing: 'Keep editing',
  },
  password: {
    title: 'Change password',
    current: 'Current password',
    new: 'New password',
    submit: 'Update password',
    success: 'Password updated.',
    wrongCurrent: 'The current password is not right.',
    tooShort: 'The new password must be at least 8 characters.',
  },
  deleteAccount: {
    title: 'Delete account',
    hint: 'Permanently removes your account and all your data (RGPD Article 17).',
    confirmTitle: 'Delete account?',
    confirmBody: 'This permanently deletes your account and all your data. This cannot be undone.',
    confirm: 'Delete my account',
    deleting: 'Deleting…',
    failed: 'Could not delete your account. Please try again.',
  },
};
