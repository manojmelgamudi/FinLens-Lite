import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 40, className = '' }) => {
  return (
    <img
      src="/finlens-icon.png"
      alt="FinLens"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`block shrink-0 object-contain select-none ${className}`}
      draggable={false}
    />
  );
};

interface BrandNameProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const BRAND_SIZE_CLASSES: Record<NonNullable<BrandNameProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base sm:text-lg',
  lg: 'text-lg',
  xl: 'text-2xl',
};

export const BrandName: React.FC<BrandNameProps> = ({ size = 'md', className = '' }) => {
  const finClass = BRAND_SIZE_CLASSES[size];
  return (
    <span className={`inline-flex items-baseline leading-none select-none ${className}`}>
      <span
        className={`${finClass} font-bold tracking-tight bg-gradient-to-r from-[#1677FF] via-[#06B6D4] to-[#10B981] bg-clip-text text-transparent`}
      >
        FinLens
      </span>
    </span>
  );
};
