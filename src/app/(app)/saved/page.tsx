'use client';

import { useEffect, useMemo, useState } from 'react';
import { SavedItemCard } from '@/components/saved/SavedItemCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingState } from '@/components/shared/LoadingState';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import type { SavedItemWithProduct } from '@/lib/types/database';
import { useTourTrigger } from '@/components/tour/useTourTrigger';

export default function SavedPage() {
  const [items, setItems] = useState<SavedItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useTourTrigger('saved');

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedRes = await fetch('/api/saved');
        const savedData = await savedRes.json();

        if (!savedRes.ok) {
          throw new Error(savedData.error || 'Failed to load saved items');
        }

        setItems(savedData.items || []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load saved items');
      } finally {
        setLoading(false);
      }
    };

    void loadData();
    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'saved_page_viewed',
        path: '/saved',
      }),
    }).catch(() => {});
  }, []);

  const savedProducts = useMemo(
    () => items.filter((item) => item.product).map((item) => item.product),
    [items]
  );

  const handleDelete = async (productResultId: string) => {
    try {
      const response = await fetch('/api/saved', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_result_id: productResultId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete item');
      }

      setItems((prev) => prev.filter((item) => item.product.id !== productResultId));
      toast.success('Item removed from saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete item');
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (savedProducts.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Saved Items</h1>
        <EmptyState
          icon={Heart}
          title="No saved items yet"
          description="Swipe right on products you like to save them here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Saved Items</h1>
        <p className="text-muted-foreground">{savedProducts.length} items saved</p>
      </div>

      <div data-tour="saved-grid" className="grid gap-3">
        {items.map((item) => (
          <SavedItemCard
            key={item.id}
            product={item.product}
            savedAt={item.created_at}
            onDelete={() => handleDelete(item.product.id)}
          />
        ))}
      </div>
    </div>
  );
}
