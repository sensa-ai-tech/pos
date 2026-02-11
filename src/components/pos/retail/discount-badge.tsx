'use client';

interface DiscountBadgeProps {
  discount: number; // percentage off, e.g. 20 means 20% off
}

export function DiscountBadge({ discount }: DiscountBadgeProps) {
  if (discount <= 0) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      -{discount}%
    </span>
  );
}
