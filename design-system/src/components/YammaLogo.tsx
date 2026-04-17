'use client';

import React from 'react';

import type { YammaLogoProps } from './YammaLogo.shared';

export type { YammaLogoProps } from './YammaLogo.shared';

export function YammaLogo({
  className = '',
  width = 140,
  height = 28,
}: YammaLogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 246.52704 49.878159"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Yamma"
      preserveAspectRatio="xMinYMid meet"
    >
      <defs>
        <linearGradient id="yammaFoodGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FF8A00" />
          <stop offset="100%" stopColor="#FF4D00" />
        </linearGradient>
      </defs>
      <text
        x="-4.4249411"
        y="49.878159"
        fontFamily="Nunito, Quicksand, Poppins, Arial, sans-serif"
        fontSize="72px"
        fontWeight="700"
        letterSpacing="-1"
        fill="url(#yammaFoodGradient)"
      >
        Yamma
      </text>
    </svg>
  );
}
