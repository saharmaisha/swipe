'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { ProductCard } from './ProductCard';
import { Button } from '@/components/ui/button';
import { CheckCircle, RotateCcw, X, Heart } from 'lucide-react';
import Link from 'next/link';
import type { ProductResult } from '@/lib/types/database';

interface ProductSwipeDeckProps {
  products: ProductResult[];
  currentIndex: number;
  onSave: (product: ProductResult) => void;
  onSkip: (product: ProductResult) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

const SWIPE_THRESHOLD = 100;

export function ProductSwipeDeck({
  products,
  currentIndex,
  onSave,
  onSkip,
  onUndo,
  canUndo = false,
}: ProductSwipeDeckProps) {
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const [showUndoPill, setShowUndoPill] = useState(false);
  const [keyboardFlash, setKeyboardFlash] = useState<'left' | 'right' | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);

  const currentProduct = products[currentIndex];
  const nextProduct = products[currentIndex + 1];
  const isFinished = currentIndex >= products.length;

  const clearUndoTimeout = useCallback(() => {
    if (undoTimeoutRef.current !== null) {
      window.clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
  }, []);

  const showTemporaryUndoPill = useCallback(() => {
    if (!onUndo) return;

    clearUndoTimeout();
    setShowUndoPill(true);
    undoTimeoutRef.current = window.setTimeout(() => {
      setShowUndoPill(false);
      undoTimeoutRef.current = null;
    }, 6000);
  }, [clearUndoTimeout, onUndo]);

  const handleUndoClick = useCallback(() => {
    if (!onUndo || !canUndo) return;

    clearUndoTimeout();
    setShowUndoPill(false);
    onUndo();
  }, [canUndo, clearUndoTimeout, onUndo]);

  const handleSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (!currentProduct) return;
      setExitDirection(direction);

      setTimeout(() => {
        if (direction === 'right') {
          onSave(currentProduct);
        } else {
          onSkip(currentProduct);
        }
        showTemporaryUndoPill();
        setExitDirection(null);
      }, 200);
    },
    [currentProduct, onSave, onSkip, showTemporaryUndoPill]
  );

  useEffect(() => {
    return () => clearUndoTimeout();
  }, [clearUndoTimeout]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndoClick();
      } else if (e.key === 'ArrowLeft') {
        setKeyboardFlash('left');
        setTimeout(() => setKeyboardFlash(null), 150);
        handleSwipe('left');
      } else if (e.key === 'ArrowRight') {
        setKeyboardFlash('right');
        setTimeout(() => setKeyboardFlash(null), 150);
        handleSwipe('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipe, handleUndoClick]);

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <CheckCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-medium">All caught up</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            You&apos;ve reviewed all {products.length} products. Head back to try another board.
          </p>
        </div>
        {onUndo && canUndo && (
          <Button
            data-tour="undo-button"
            variant="secondary"
            size="sm"
            className="min-h-11 rounded-full px-4 gap-2"
            onClick={handleUndoClick}
          >
            <RotateCcw className="h-4 w-4" />
            Undo last action
          </Button>
        )}
        <Link href="/boards">
          <Button variant="outline" size="sm" className="mt-2">
            Back to boards
          </Button>
        </Link>
        <Link href="/saved">
          <Button size="sm" className="mt-1">
            View saved items
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 pb-8">
      <div className="text-xs text-muted-foreground tabular-nums">
        {currentIndex + 1} / {products.length}
      </div>

      <div className="relative w-full max-w-sm" data-tour="swipe-deck">
        {/* Invisible in-flow card to set container height */}
        <div className="invisible">
          <ProductCard product={currentProduct || products[0]} />
        </div>

        {nextProduct && (
          <div className="absolute inset-0 scale-[0.96] opacity-50 pointer-events-none">
            <ProductCard product={nextProduct} />
          </div>
        )}

        <AnimatePresence mode="wait" custom={exitDirection}>
          {currentProduct && !exitDirection && (
            <SwipeableCard
              key={currentProduct.id}
              product={currentProduct}
              onSwipe={handleSwipe}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-8" data-tour="action-buttons">
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="outline"
              size="lg"
              className={`h-14 w-14 rounded-full border-2 transition-all ${
                keyboardFlash === 'left'
                  ? 'scale-110 border-destructive bg-destructive/10'
                  : 'hover:border-destructive hover:bg-destructive/10'
              }`}
              onClick={() => handleSwipe('left')}
            >
              <X className="h-6 w-6 text-destructive" />
            </Button>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded border">←</kbd>
              Skip
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="outline"
              size="lg"
              className={`h-14 w-14 rounded-full border-2 transition-all ${
                keyboardFlash === 'right'
                  ? 'scale-110 border-green-500 bg-green-500/10'
                  : 'hover:border-green-500 hover:bg-green-500/10'
              }`}
              onClick={() => handleSwipe('right')}
            >
              <Heart className="h-6 w-6 text-green-500" />
            </Button>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              Save
              <kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded border">→</kbd>
            </span>
          </div>
        </div>

        <AnimatePresence>
          {showUndoPill && onUndo && canUndo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <Button
                variant="secondary"
                size="sm"
                className="min-h-11 rounded-full px-4 gap-2 shadow-sm relative overflow-hidden"
                onClick={handleUndoClick}
              >
                <RotateCcw className="h-4 w-4" />
                Undo
                <motion.div
                  className="absolute bottom-0 left-0 h-0.5 bg-foreground/20"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 6, ease: 'linear' }}
                />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const cardVariants = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: (direction: 'left' | 'right' | null) => ({
    x: direction === 'left' ? -300 : 300,
    opacity: 0,
    transition: { duration: 0.2 },
  }),
};

function SwipeableCard({
  product,
  onSwipe,
}: {
  product: ProductResult;
  onSwipe: (direction: 'left' | 'right') => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const leftIndicatorOpacity = useTransform(x, [-150, -50, 0], [1, 0.5, 0]);
  const rightIndicatorOpacity = useTransform(x, [0, 50, 150], [0, 0.5, 1]);

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      style={{ x, rotate, opacity }}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 500) {
          onSwipe('right');
        } else if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -500) {
          onSwipe('left');
        }
      }}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <motion.div
        className="absolute top-6 left-4 z-10 bg-destructive text-white px-3 py-1.5 rounded-lg font-semibold text-sm -rotate-12"
        style={{ opacity: leftIndicatorOpacity }}
      >
        SKIP
      </motion.div>
      <motion.div
        className="absolute top-6 right-4 z-10 bg-foreground text-background px-3 py-1.5 rounded-lg font-semibold text-sm rotate-12"
        style={{ opacity: rightIndicatorOpacity }}
      >
        SAVE
      </motion.div>

      <ProductCard product={product} />
    </motion.div>
  );
}
