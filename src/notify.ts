import { Alert, Platform } from 'react-native';

/** Blocking message that survives navigation (a toast on a screen that is closing would vanish). */
export function notify(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Cami', message);
}
