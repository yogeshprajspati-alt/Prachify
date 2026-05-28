import React from 'react';

export default function Preloader({ size = 'md' }) {
  const sizes = { sm: 'w-4 h-4 border-[2px]', md: 'w-6 h-6 border-[2px]', lg: 'w-8 h-8 border-[3px]' };
  return (
    <div className={`${sizes[size]} rounded-full border-white/20 border-t-white animate-spin`} />
  );
}
