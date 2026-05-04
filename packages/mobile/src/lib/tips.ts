import * as SecureStore from 'expo-secure-store';

// Whether the user has turned conservation tips off (risk F5). It's just a flag,
// not a secret, but SecureStore is already a dependency so we reuse it instead of
// pulling in AsyncStorage just for this.
const TIPS_DISABLED_KEY = 'pantryai.tipsDisabled';

export async function getTipsDisabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(TIPS_DISABLED_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setTipsDisabled(disabled: boolean): Promise<void> {
  try {
    if (disabled) {
      await SecureStore.setItemAsync(TIPS_DISABLED_KEY, 'true');
    } else {
      await SecureStore.deleteItemAsync(TIPS_DISABLED_KEY);
    }
  } catch {
    // if the store isn't working we just don't persist the choice
  }
}
