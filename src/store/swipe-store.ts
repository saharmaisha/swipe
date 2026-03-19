import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ProductResult,
  SearchRun,
  PinAnalysis,
  PinterestPin,
  SearchBoardSummary,
} from '@/lib/types/database';
import type { SearchSessionData } from '@/lib/types/products';

interface SwipeState {
  searchRun: SearchRun | null;
  analysis: PinAnalysis | null;
  analyses: PinAnalysis[];
  selectedPins: PinterestPin[];
  board: SearchBoardSummary | null;
  products: ProductResult[];
  currentIndex: number;
  skippedIds: Set<string>;
  savedIds: Set<string>;
  history: Array<{ productId: string; action: 'save' | 'skip'; index: number }>;

  setSearchData: (session: SearchSessionData) => void;
  skipProduct: (productId: string) => void;
  saveProduct: (productId: string) => void;
  unsaveProduct: (productId: string) => void;
  undoLastAction: () => { productId: string; action: 'save' | 'skip'; index: number } | null;
  nextCard: () => void;
  getCurrentProduct: () => ProductResult | null;
  getRemainingCount: () => number;
  reset: () => void;
}

// Serializable version for storage (Sets become arrays)
interface SerializableSwipeState {
  searchRun: SearchRun | null;
  products: ProductResult[];
  analyses: PinAnalysis[];
  selectedPins: PinterestPin[];
  board: SearchBoardSummary | null;
  currentIndex: number;
  skippedIds: string[];
  savedIds: string[];
  history: Array<{ productId: string; action: 'save' | 'skip'; index: number }>;
}

export const useSwipeStore = create<SwipeState>()(
  persist(
    (set, get) => ({
      searchRun: null,
      analysis: null,
      analyses: [],
      selectedPins: [],
      board: null,
      products: [],
      currentIndex: 0,
      skippedIds: new Set(),
      savedIds: new Set(),
      history: [],

      setSearchData: (session) =>
        set({
          searchRun: session.searchRun,
          products: session.products,
          analysis: session.analyses?.[0] || null,
          analyses: session.analyses || [],
          selectedPins: session.selectedPins || [],
          board: session.board || null,
          currentIndex: 0,
          skippedIds: new Set(),
          savedIds: new Set(),
          history: [],
        }),

      skipProduct: (productId) =>
        set((state) => {
          const newSkipped = new Set(state.skippedIds);
          newSkipped.add(productId);
          return {
            skippedIds: newSkipped,
            history: [...state.history, { productId, action: 'skip', index: state.currentIndex }],
          };
        }),

      saveProduct: (productId) =>
        set((state) => {
          const newSaved = new Set(state.savedIds);
          newSaved.add(productId);
          return {
            savedIds: newSaved,
            history: [...state.history, { productId, action: 'save', index: state.currentIndex }],
          };
        }),

      unsaveProduct: (productId) =>
        set((state) => {
          const newSaved = new Set(state.savedIds);
          newSaved.delete(productId);
          return { savedIds: newSaved };
        }),

      undoLastAction: () => {
        const state = get();
        const lastAction = state.history[state.history.length - 1];

        if (!lastAction) {
          return null;
        }

        set((currentState) => {
          const nextHistory = currentState.history.slice(0, -1);
          const nextSaved = new Set(currentState.savedIds);
          const nextSkipped = new Set(currentState.skippedIds);

          if (lastAction.action === 'save') {
            nextSaved.delete(lastAction.productId);
          } else {
            nextSkipped.delete(lastAction.productId);
          }

          return {
            currentIndex: lastAction.index,
            history: nextHistory,
            savedIds: nextSaved,
            skippedIds: nextSkipped,
          };
        });

        return lastAction;
      },

      nextCard: () =>
        set((state) => ({
          currentIndex: Math.min(state.currentIndex + 1, state.products.length),
        })),

      getCurrentProduct: () => {
        const { products, currentIndex } = get();
        return products[currentIndex] || null;
      },

      getRemainingCount: () => {
        const { products, currentIndex } = get();
        return Math.max(0, products.length - currentIndex);
      },

      reset: () =>
        set({
          searchRun: null,
          analysis: null,
          analyses: [],
          selectedPins: [],
          board: null,
          products: [],
          currentIndex: 0,
          skippedIds: new Set(),
          savedIds: new Set(),
          history: [],
        }),
    }),
    {
      name: 'swipe-session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state): SerializableSwipeState => ({
        searchRun: state.searchRun,
        products: state.products,
        analyses: state.analyses,
        selectedPins: state.selectedPins,
        board: state.board,
        currentIndex: state.currentIndex,
        // Convert Sets to arrays for serialization
        skippedIds: Array.from(state.skippedIds),
        savedIds: Array.from(state.savedIds),
        history: state.history,
      }),
      merge: (persisted, current) => {
        const stored = persisted as SerializableSwipeState | undefined;
        if (!stored) return current;

        return {
          ...current,
          searchRun: stored.searchRun,
          products: stored.products,
          analyses: stored.analyses,
          selectedPins: stored.selectedPins,
          board: stored.board,
          currentIndex: stored.currentIndex,
          // Convert arrays back to Sets
          skippedIds: new Set(stored.skippedIds || []),
          savedIds: new Set(stored.savedIds || []),
          history: stored.history || [],
        };
      },
    }
  )
);
