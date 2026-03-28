import type { ShoppingProvider } from './types';
import { MockShoppingProvider } from './mock';
import { SerpApiTextShoppingProvider } from './text-search';
import { SerpApiLensProvider } from './lens-search';

type ProviderMode = 'mock' | 'text' | 'image' | 'full';

export function getProviders(): ShoppingProvider[] {
  const mode = (process.env.SHOPPING_PROVIDER_MODE || 'mock') as ProviderMode;

  switch (mode) {
    case 'mock':
      return [new MockShoppingProvider()];
    case 'text':
      return [new SerpApiTextShoppingProvider()];
    case 'image':
      return [new SerpApiLensProvider()];
    case 'full':
      return [
        new SerpApiTextShoppingProvider(),
        new SerpApiLensProvider(),
      ];
    default:
      return [new MockShoppingProvider()];
  }
}

export function getTextProvider(): ShoppingProvider {
  const mode = (process.env.SHOPPING_PROVIDER_MODE || 'mock') as ProviderMode;
  if (mode === 'mock') return new MockShoppingProvider();
  return new SerpApiTextShoppingProvider();
}

export function getImageProvider(): ShoppingProvider {
  const mode = (process.env.SHOPPING_PROVIDER_MODE || 'mock') as ProviderMode;
  if (mode === 'mock') return new MockShoppingProvider();
  return new SerpApiLensProvider();
}
