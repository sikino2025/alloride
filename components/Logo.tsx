import React from 'react';

export const Logo = ({ size = 100, className = "" }: { size?: number, className?: string }) => {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Black Card Shape */}
      <rect x="0" y="0" width="200" height="130" rx="25" fill="black" />
      
      {/* The "Hole" at bottom left (simulated by a circle mask or just drawing over it with background color if we knew background, 
          but SVG mask is better. Simpler approach: construct path with hole. 
          For simplicity in this component, I'll use a white circle if background is white, but proper way is mask or path subtraction.
          Let's assume white background for now based on app theme, or use a path.) */}
      
      {/* Path with hole cutout at bottom left */}
      <path 
        fill="black" 
        d="M25 0H175C188.807 0 200 11.1929 200 25V105C200 118.807 188.807 130 175 130H65H55C55 130 55 130 55 130V130C55 130 55 130 55 130C55 116.193 43.8071 105 30 105C16.1929 105 5 116.193 5 130H0V25C0 11.1929 11.1929 0 25 0Z"
      />
      {/* Decorative circle to make the cutout look deliberate if needed, 
          but the path above essentially draws a rectangle with a bite taken out of the bottom left corner 
          (if we treat the corner as 0,0 relative to the cutout).
          Let's refine the shape to match the 'tag' look more closely. */}
       
       <path 
         d="M20 0H180C191.046 0 200 8.9543 200 20V110C200 121.046 191.046 130 180 130H60C60 113.431 46.5685 100 30 100C13.4315 100 0 113.431 0 130V20C0 8.95431 8.9543 0 20 0Z" 
         fill="black"
       />

      {/* Text: ALLORIDE */}
      <text x="100" y="65" textAnchor="middle" fill="white" fontFamily="sans-serif" fontWeight="900" fontSize="38" letterSpacing="-1">
        ALLORIDE
      </text>

      {/* Text: EXPRESS */}
      <text x="100" y="95" textAnchor="middle" fill="white" fontFamily="sans-serif" fontWeight="700" fontSize="18" letterSpacing="1">
        EXPRESS
      </text>
    </svg>
  );
};