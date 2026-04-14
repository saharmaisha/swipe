import type { DriveStep } from 'driver.js';

export type FlowTourPage = 'boards' | 'boardDetail' | 'results' | 'saved';

export interface FlowStep extends DriveStep {
  page: FlowTourPage;
  isActionStep?: boolean;
  nextRoutePattern?: string;
}

export const flowSteps: FlowStep[] = [
  // ========== BOARDS PAGE ==========
  {
    page: 'boards',
    element: '[data-tour="board-url-input"]',
    popover: {
      title: 'Welcome to Veri!',
      description: 'Start by pasting a public Pinterest board URL here to import your outfit inspiration.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    page: 'boards',
    element: '[data-tour="boards-grid"]',
    popover: {
      title: 'Your boards',
      description: 'Imported boards appear here. Click any board to view its pins and search for products.',
      side: 'top',
      align: 'center',
    },
  },
  {
    page: 'boards',
    isActionStep: true,
    nextRoutePattern: '/boards/',
    popover: {
      title: 'Open a board',
      description: 'Click on any board to continue and explore its pins.',
    },
  },

  // ========== BOARD DETAIL PAGE ==========
  {
    page: 'boardDetail',
    element: '[data-tour="pins-grid"]',
    popover: {
      title: 'Your pins',
      description: 'These are all the pins from this board. Browse through them to find outfit inspiration.',
      side: 'top',
      align: 'center',
    },
  },
  {
    page: 'boardDetail',
    element: '[data-tour="pin-card"]',
    popover: {
      title: 'Select pins',
      description: 'Tap or click pins to select which ones you want to search for. Selected pins get a purple ring.',
      side: 'right',
      align: 'start',
    },
  },
  {
    page: 'boardDetail',
    element: '[data-tour="filter-panel"]',
    popover: {
      title: 'Refine your search',
      description: 'Use filters to narrow down results by occasion, style, length, sleeve, or color.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    page: 'boardDetail',
    element: '[data-tour="budget-input"]',
    popover: {
      title: 'Set your budget',
      description: "Enter your maximum price per item. We'll prioritize products within your range.",
      side: 'bottom',
      align: 'start',
    },
  },
  {
    page: 'boardDetail',
    element: '[data-tour="search-button"]',
    popover: {
      title: 'Find where to buy it',
      description: "Hit search and we'll find real, buyable versions of these outfits from actual retailers.",
      side: 'bottom',
      align: 'end',
    },
  },
  {
    page: 'boardDetail',
    isActionStep: true,
    nextRoutePattern: '/results/',
    popover: {
      title: 'Run a search',
      description: 'Select some pins (or search all) and click the Search button to find matching products.',
    },
  },

  // ========== RESULTS PAGE ==========
  {
    page: 'results',
    element: '[data-tour="swipe-deck"]',
    popover: {
      title: 'Product matches',
      description: "Here are products that match your pins. Swipe through to find pieces you love.",
      side: 'bottom',
      align: 'center',
    },
  },
  {
    page: 'results',
    element: '[data-tour="action-buttons"]',
    popover: {
      title: 'Save or skip',
      description: 'Click the heart to SAVE or X to SKIP. Use arrow keys for quick navigation. Cmd/Ctrl+Z to undo.',
      side: 'top',
      align: 'center',
    },
  },
  {
    page: 'results',
    isActionStep: true,
    nextRoutePattern: '/saved',
    popover: {
      title: 'Build your wishlist',
      description: 'Save a few items you like, then head to the Saved tab to see your collection.',
    },
  },

  // ========== SAVED PAGE ==========
  {
    page: 'saved',
    element: '[data-tour="saved-grid"]',
    popover: {
      title: 'Your saved items',
      description: 'All the products you saved appear here. Click any item to view details or visit the store.',
      side: 'top',
      align: 'center',
    },
  },
  {
    page: 'saved',
    popover: {
      title: "You're all set!",
      description: 'You now know how to turn Pinterest inspiration into shoppable finds. Happy shopping!',
    },
  },
];

export function getStepsForPage(page: FlowTourPage): FlowStep[] {
  return flowSteps.filter((step) => step.page === page);
}

export function getStepIndexForPage(page: FlowTourPage): number {
  return flowSteps.findIndex((step) => step.page === page);
}

export function getPageForStepIndex(index: number): FlowTourPage | null {
  const step = flowSteps[index];
  return step ? step.page : null;
}

export default flowSteps;
