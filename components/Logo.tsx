import React from 'react';

export const Logo = ({ size = 48, className = "" }: { size?: number, className?: string }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="paint0_linear" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1"/>
          <stop offset="1" stopColor="#ec4899"/>
        </linearGradient>
      </defs>
      {/* Outer Glow Circle */}
      <circle cx="50" cy="50" r="45" fill="url(#paint0_linear)" fillOpacity="0.1"/>
      
      {/* Main Pin Shape */}
      <path 
        d="M50 20C35 20 23 32 23 47C23 68 50 90 50 90C50 90 77 68 77 47C77 32 65 20 50 20Z" 
        fill="url(#paint0_linear)"
        className="drop-shadow-sm"
      />
      
      {/* Stylized 'a' or road curve inside */}
      <path 
        d="M50 35C43.3726 35 38 40.3726 38 47C38 53.6274 43.3726 59 50 59C56.6274 59 62 53.6274 62 47" 
        stroke="white" 
        strokeWidth="6" 
        strokeLinecap="round"
      />
      <circle cx="50" cy="47" r="5" fill="white"/>
    </svg>
  );
};