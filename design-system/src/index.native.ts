/**
 * Native-only entry: keep this minimal so Metro does not evaluate the full web
 * design-system barrel (DOM components, ThemeProvider/localStorage, etc.) during startup.
 */
export type { YammaLogoProps } from './components/YammaLogo.shared';
export { YammaLogo } from './components/YammaLogo';
