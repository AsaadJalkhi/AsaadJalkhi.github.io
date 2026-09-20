/**
 * Portfolio context.
 *
 * The validated content is provided once at the root. Everything downstream
 * reads it through `usePortfolio()`, which is the seam to swap in a CMS later:
 * change the provider's source, not a single consumer.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { Portfolio } from '@/types/content';

const PortfolioContext = createContext<Portfolio | null>(null);

export function PortfolioProvider({ value, children }: { value: Portfolio; children: ReactNode }) {
  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio(): Portfolio {
  const value = useContext(PortfolioContext);
  if (!value) throw new Error('usePortfolio must be used inside <PortfolioProvider>');
  return value;
}
