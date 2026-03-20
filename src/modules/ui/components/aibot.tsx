interface AIBotProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  isError?: boolean;
  animate?: boolean;
}

const AIBot = ({ 
    className = '', 
    size = 'md', 
    isError = false, 
    animate = false 
  }: AIBotProps) => {
    const sizeMap = {
      sm: { width: '16', height: '16', fontSize: '8' },
      md: { width: '20', height: '20', fontSize: '10' },
      lg: { width: '55', height: '55', fontSize: '12' }
    };
    
    const dimensions = sizeMap[size];
    
    return (
      <div className={`inline-flex ${className}`}>
        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox="0 0 120 120"
          className={animate ? 'animate-pulse' : ''}
        >
          <defs>
            {/* Gradients for the book cover */}
            <linearGradient id={`coverGradient-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isError ? "#FCA5A5" : "#60A5FA"} />
              <stop offset="50%" stopColor={isError ? "#EF4444" : "#3B82F6"} />
              <stop offset="100%" stopColor={isError ? "#DC2626" : "#1E40AF"} />
            </linearGradient>
            
            <linearGradient id={`spineGradient-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={isError ? "#DC2626" : "#1E40AF"} />
              <stop offset="50%" stopColor={isError ? "#B91C1C" : "#1E3A8A"} />
              <stop offset="100%" stopColor={isError ? "#DC2626" : "#1E40AF"} />
            </linearGradient>
            
            {/* Shadow filter */}
            <filter id={`bookShadow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="2" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.15)" />
            </filter>
          </defs>
          
          {/* Book Base/Back Cover */}
          <rect
            x="30"
            y="35"
            width="60"
            height="50"
            rx="3"
            fill={`url(#coverGradient-${size})`}
            filter={`url(#bookShadow-${size})`}
          />
          
          {/* Book Spine */}
          <rect
            x="30"
            y="35"
            width="6"
            height="50"
            rx="3"
            fill={`url(#spineGradient-${size})`}
          />
          
          {/* AI Text on Cover */}
          <text
            x="60"
            y="65"
            fill="white"
            fontSize={dimensions.fontSize}
            fontWeight="bold"
            textAnchor="middle"
            opacity="0.95"
          >
            AI
          </text>
          
          {/* Brain pattern dots on cover */}
          <g opacity="0.4">
            <circle cx="48" cy="48" r="1.5" fill="white" />
            <circle cx="72" cy="45" r="1" fill="white" />
            <circle cx="55" cy="72" r="0.8" fill="white" />
            <circle cx="75" cy="65" r="1.2" fill="white" />
            <circle cx="50" cy="58" r="0.6" fill="white" />
            <circle cx="68" cy="58" r="0.9" fill="white" />
          </g>
          
          {/* Book Pages - Static for bot icon */}
          <rect
            x="36"
            y="37"
            width="52"
            height="46"
            rx="2"
            fill="white"
            stroke="#e5e7eb"
            strokeWidth="0.5"
            opacity="0.9"
          />
          
          {/* Content lines on visible page */}
          <g opacity="0.25">
            <line x1="40" y1="44" x2="82" y2="44" stroke="#9CA3AF" strokeWidth="0.6" />
            <line x1="40" y1="48" x2="78" y2="48" stroke="#9CA3AF" strokeWidth="0.6" />
            <line x1="40" y1="52" x2="82" y2="52" stroke="#9CA3AF" strokeWidth="0.6" />
            <line x1="40" y1="56" x2="75" y2="56" stroke="#9CA3AF" strokeWidth="0.6" />
            <line x1="40" y1="60" x2="82" y2="60" stroke="#9CA3AF" strokeWidth="0.6" />
            <line x1="40" y1="64" x2="80" y2="64" stroke="#9CA3AF" strokeWidth="0.6" />
            <line x1="40" y1="68" x2="76" y2="68" stroke="#9CA3AF" strokeWidth="0.6" />
            <line x1="40" y1="72" x2="82" y2="72" stroke="#9CA3AF" strokeWidth="0.6" />
          </g>
          
          {/* Spiral binding rings */}
          <g fill={isError ? "#7F1D1D" : "#6B7280"} opacity="0.6">
            <ellipse cx="33" cy="42" rx="1.5" ry="2" />
            <ellipse cx="33" cy="50" rx="1.5" ry="2" />
            <ellipse cx="33" cy="58" rx="1.5" ry="2" />
            <ellipse cx="33" cy="66" rx="1.5" ry="2" />
            <ellipse cx="33" cy="74" rx="1.5" ry="2" />
          </g>
          
          {/* Colored tabs on the right */}
          <rect x="88" y="40" width="3" height="6" rx="1.5" fill={isError ? "#EF4444" : "#10B981"} />
          <rect x="88" y="48" width="3" height="6" rx="1.5" fill={isError ? "#F59E0B" : "#8B5CF6"} />
          <rect x="88" y="56" width="3" height="6" rx="1.5" fill={isError ? "#EF4444" : "#F59E0B"} />
          <rect x="88" y="64" width="3" height="6" rx="1.5" fill={isError ? "#DC2626" : "#EF4444"} />
          <rect x="88" y="72" width="3" height="6" rx="1.5" fill={isError ? "#B91C1C" : "#06B6D4"} />
          
          {/* Error indicator - exclamation mark overlay */}
          {isError && (
            <g>
              <circle cx="75" cy="45" r="6" fill="rgba(220, 38, 38, 0.9)" />
              <text
                x="75"
                y="50"
                fill="white"
                fontSize="8"
                fontWeight="bold"
                textAnchor="middle"
              >
                !
              </text>
            </g>
          )}
        </svg>
      </div>
    );
  };

export default AIBot;