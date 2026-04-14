'use client';

import { useEffect, useRef } from 'react';
import { useTour, type TourPage } from './TourProvider';

/**
 * Hook to auto-start a tour on first visit to a page.
 * For first-time users, this starts the connected flow tour.
 * For returning users, this triggers per-page tours via the help button only.
 */
export function useTourTrigger(page: TourPage, delay = 800) {
  const {
    startTour,
    hasSeenTour,
    markTourSeen,
    isReady,
    flowTourActive,
    flowTourCompleted,
    startFlowTour,
  } = useTour();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!isReady || hasTriggered.current) return;

    // If flow tour is active, don't trigger per-page tours
    // The flow tour handles everything
    if (flowTourActive) return;

    // For first-time users on the boards page, start the flow tour
    if (page === 'boards' && !flowTourCompleted) {
      hasTriggered.current = true;

      const timeout = setTimeout(() => {
        startFlowTour();
      }, delay);

      return () => clearTimeout(timeout);
    }

    // For returning users who completed the flow tour,
    // per-page tours are only triggered via help button (not auto)
    // So we don't auto-trigger anything here

  }, [isReady, page, flowTourActive, flowTourCompleted, startFlowTour, delay]);
}

/**
 * Hook for manual tour trigger (help button).
 * This always triggers the per-page tour regardless of flow state.
 */
export function useManualTourTrigger() {
  const { startTour, markTourSeen } = useTour();

  const triggerTour = (page: TourPage) => {
    startTour(page);
    markTourSeen(page);
  };

  return { triggerTour };
}
