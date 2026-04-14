'use client';

import { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { driver, Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { flowSteps, getStepIndexForPage, type FlowTourPage } from './tours/flowTour';

export type TourPage =
  | 'boards'
  | 'boardDetail'
  | 'results'
  | 'saved'
  | 'settings';

interface TourState {
  boards: boolean;
  boardDetail: boolean;
  results: boolean;
  saved: boolean;
  settings: boolean;
}

interface FlowTourState {
  active: boolean;
  step: number;
  completed: boolean;
}

interface TourContextValue {
  // Per-page tours (for help button)
  startTour: (page: TourPage) => void;
  hasSeenTour: (page: TourPage) => boolean;
  markTourSeen: (page: TourPage) => void;
  resetTours: () => void;
  isReady: boolean;
  // Flow tour
  flowTourActive: boolean;
  flowTourCompleted: boolean;
  startFlowTour: () => void;
  endFlowTour: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

const STORAGE_KEY = 'swipe_tour_state';
const FLOW_STORAGE_KEY = 'swipe_flow_tour';

const defaultState: TourState = {
  boards: false,
  boardDetail: false,
  results: false,
  saved: false,
  settings: false,
};

const defaultFlowState: FlowTourState = {
  active: false,
  step: 0,
  completed: false,
};

function getPageFromPathname(pathname: string): FlowTourPage | null {
  if (pathname === '/boards') return 'boards';
  if (pathname.startsWith('/boards/')) return 'boardDetail';
  if (pathname.startsWith('/results/')) return 'results';
  if (pathname === '/saved') return 'saved';
  return null;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [tourState, setTourState] = useState<TourState>(defaultState);
  const [flowState, setFlowState] = useState<FlowTourState>(defaultFlowState);
  const [driverInstance, setDriverInstance] = useState<Driver | null>(null);
  const [isReady, setIsReady] = useState(false);
  const flowResumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPathnameRef = useRef<string>('');

  // Load state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setTourState(JSON.parse(stored));
      } catch {
        // Invalid stored state, use default
      }
    }

    const flowStored = localStorage.getItem(FLOW_STORAGE_KEY);
    if (flowStored) {
      try {
        setFlowState(JSON.parse(flowStored));
      } catch {
        // Invalid stored state, use default
      }
    }

    setIsReady(true);
  }, []);

  // Initialize driver.js
  useEffect(() => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: 'rgba(0, 0, 0, 0.7)',
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: 'swipe-tour-popover',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      onDestroyStarted: () => {
        // User clicked X or tour ended
        if (flowState.active) {
          // Check if this was a natural end (last step) or user exit
          const currentStep = flowSteps[flowState.step];
          const isLastStep = flowState.step >= flowSteps.length - 1;
          const isActionStep = currentStep?.isActionStep;

          if (isLastStep) {
            // Tour completed naturally
            const newFlowState = { ...flowState, active: false, completed: true };
            localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(newFlowState));
            setFlowState(newFlowState);
          } else if (isActionStep) {
            // Pausing at action step - user needs to navigate
            // Keep active but don't do anything special
          } else {
            // User exited mid-tour
            const newFlowState = { ...flowState, active: false };
            localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(newFlowState));
            setFlowState(newFlowState);
          }
        }
      },
    });
    setDriverInstance(driverObj);

    return () => {
      driverObj.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle route changes for flow tour
  useEffect(() => {
    if (!isReady || !flowState.active || !driverInstance) return;
    if (pathname === lastPathnameRef.current) return;

    lastPathnameRef.current = pathname;
    const currentPage = getPageFromPathname(pathname);
    if (!currentPage) return;

    // Find the step we should be on based on the current route
    const currentStep = flowSteps[flowState.step];
    if (!currentStep) return;

    // Check if we're on the expected page for the current step
    const expectedPage = currentStep.page;

    // If current step is an action step and user navigated to the expected next route
    if (currentStep.isActionStep && currentStep.nextRoutePattern) {
      if (pathname.includes(currentStep.nextRoutePattern) || pathname === currentStep.nextRoutePattern) {
        // User completed the action! Advance to next step
        const nextStepIndex = flowState.step + 1;
        if (nextStepIndex < flowSteps.length) {
          const newFlowState = { ...flowState, step: nextStepIndex };
          localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(newFlowState));
          setFlowState(newFlowState);

          // Resume tour after a delay to let elements render
          if (flowResumeTimeoutRef.current) {
            clearTimeout(flowResumeTimeoutRef.current);
          }
          flowResumeTimeoutRef.current = setTimeout(() => {
            resumeFlowTourFromStep(nextStepIndex);
          }, 1200);
        }
        return;
      }
    }

    // If we're on the expected page but not at an action step, the tour should already be running
    // This handles the case of page refresh
    if (currentPage === expectedPage && !currentStep.isActionStep) {
      // Resume from current step after delay
      if (flowResumeTimeoutRef.current) {
        clearTimeout(flowResumeTimeoutRef.current);
      }
      flowResumeTimeoutRef.current = setTimeout(() => {
        resumeFlowTourFromStep(flowState.step);
      }, 1200);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isReady, flowState.active, flowState.step]);

  const resumeFlowTourFromStep = useCallback(
    (stepIndex: number) => {
      if (!driverInstance) return;

      // Get all steps for the current page section
      const currentStep = flowSteps[stepIndex];
      if (!currentStep) return;

      const currentPage = currentStep.page;
      const stepsForThisPageSection: typeof flowSteps = [];
      let localIndex = 0;

      // Collect consecutive steps for this page
      for (let i = stepIndex; i < flowSteps.length; i++) {
        const step = flowSteps[i];
        if (step.page !== currentPage) break;
        stepsForThisPageSection.push(step);
        if (step.isActionStep) {
          // Include the action step but stop after it
          break;
        }
      }

      if (stepsForThisPageSection.length === 0) return;

      // Convert to driver.js steps
      const driverSteps = stepsForThisPageSection.map((step) => ({
        element: step.element,
        popover: step.popover,
      }));

      driverInstance.setSteps(driverSteps);

      // Track which step we're on for the flow
      const handleStepChange = () => {
        localIndex++;
        const newGlobalIndex = stepIndex + localIndex;
        if (newGlobalIndex < flowSteps.length) {
          const newFlowState = { ...flowState, step: newGlobalIndex };
          localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(newFlowState));
          setFlowState(newFlowState);
        }
      };

      // Override the next button behavior
      driverInstance.setConfig({
        onNextClick: () => {
          handleStepChange();
          driverInstance.moveNext();
        },
        onPrevClick: () => {
          if (localIndex > 0) {
            localIndex--;
            const newGlobalIndex = stepIndex + localIndex;
            const newFlowState = { ...flowState, step: newGlobalIndex };
            localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(newFlowState));
            setFlowState(newFlowState);
          }
          driverInstance.movePrevious();
        },
      });

      driverInstance.drive();
    },
    [driverInstance, flowState]
  );

  const saveTourState = useCallback((newState: TourState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    setTourState(newState);
  }, []);

  const hasSeenTour = useCallback(
    (page: TourPage) => {
      return tourState[page];
    },
    [tourState]
  );

  const markTourSeen = useCallback(
    (page: TourPage) => {
      const newState = { ...tourState, [page]: true };
      saveTourState(newState);
    },
    [tourState, saveTourState]
  );

  const resetTours = useCallback(() => {
    saveTourState(defaultState);
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(defaultFlowState));
    setFlowState(defaultFlowState);
  }, [saveTourState]);

  const startTour = useCallback(
    (page: TourPage) => {
      if (!driverInstance) return;

      // Import tour steps dynamically based on page
      import(`./tours/${page}`).then((module) => {
        const steps = module.default || module.steps;
        if (steps && steps.length > 0) {
          driverInstance.setConfig({
            onNextClick: undefined,
            onPrevClick: undefined,
          });
          driverInstance.setSteps(steps);
          driverInstance.drive();
        }
      }).catch(() => {
        console.warn(`No tour found for page: ${page}`);
      });
    },
    [driverInstance]
  );

  const startFlowTour = useCallback(() => {
    if (!driverInstance || flowState.completed) return;

    const newFlowState = { active: true, step: 0, completed: false };
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(newFlowState));
    setFlowState(newFlowState);

    // Start from step 0 after short delay
    setTimeout(() => {
      resumeFlowTourFromStep(0);
    }, 500);
  }, [driverInstance, flowState.completed, resumeFlowTourFromStep]);

  const endFlowTour = useCallback(() => {
    if (driverInstance) {
      driverInstance.destroy();
    }
    const newFlowState = { ...flowState, active: false };
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(newFlowState));
    setFlowState(newFlowState);
  }, [driverInstance, flowState]);

  return (
    <TourContext.Provider
      value={{
        startTour,
        hasSeenTour,
        markTourSeen,
        resetTours,
        isReady,
        flowTourActive: flowState.active,
        flowTourCompleted: flowState.completed,
        startFlowTour,
        endFlowTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
