import { registerRootComponent } from 'expo';

// Defer loading App until Expo (Expo.fx) has finished its setup; avoids racing
// the native TurboModule bridge during static import hoisting.
registerRootComponent(require('./App').default);
