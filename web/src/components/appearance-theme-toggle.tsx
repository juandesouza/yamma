'use client';

import { Button, useColorMode } from '@yamma/design-system';

export function AppearanceThemeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 rounded-2xl border border-[var(--yamma-border)] bg-[var(--yamma-surface-elevated)] px-6 py-6 text-center md:max-w-lg">
      <div>
        <p className="text-sm font-medium text-[var(--yamma-text)]">Appearance</p>
        <p className="mt-1 text-xs text-[var(--yamma-text-muted)] md:text-sm">
          Switch between dark and light theme. Your choice is saved on this device.
        </p>
      </div>
      <Button type="button" variant="secondary" size="lg" fullWidth onClick={toggleColorMode}>
        {colorMode === 'dark' ? 'Use light theme' : 'Use dark theme'}
      </Button>
    </div>
  );
}
