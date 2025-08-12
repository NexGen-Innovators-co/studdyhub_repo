import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';

const BookPagesAnimation = ({
  size = 'md',
  showText = true,
  text = 'AI is thinking...',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
    xl: 'w-24 h-24',
  };

  const bookX = 25;
  const bookY = 30;
  const bookWidth = 70;
  const bookHeight = 60;
  const spineWidth = 8;
  const coverWidth = bookWidth - spineWidth;
  const pageX = bookX + spineWidth;
  const pageY = bookY + 2;
  const pageWidth = coverWidth - 2;
  const pageHeight = bookHeight - 4;

  const animDuration = 8; // Increased to 8 seconds for slower animation

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
      <div className={`relative ${sizeClasses[size]} mx-auto perspective-1000`}>
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="coverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="50%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#1E40AF" />
            </linearGradient>

            <linearGradient id="spineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1E40AF" />
              <stop offset="50%" stopColor="#1E3A8A" />
              <stop offset="100%" stopColor="#1E40AF" />
            </linearGradient>

            <linearGradient id="pageCurlGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(0,0,0,0.4)" />
              <stop offset="30%" stopColor="rgba(0,0,0,0.2)" />
              <stop offset="70%" stopColor="rgba(0,0,0,0.1)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </linearGradient>

            <filter id="bookShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
              <feOffset dx="3" dy="4" result="offsetBlur" />
              <feMerge>
                <feMergeNode in="offsetBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="pageShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
              <feOffset dx="1" dy="1" result="offsetBlur" />
              <feMerge>
                <feMergeNode in="offsetBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glow">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
              <feFlood floodColor="white" floodOpacity="0.8" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="pageCurlFilter" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur" />
              <feOffset dx="0.5" dy="0.5" result="offsetBlur" />
              <feMerge>
                <feMergeNode in="offsetBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Book Back */}
          <rect
            x={bookX}
            y={bookY}
            width={bookWidth}
            height={bookHeight}
            rx="4"
            fill="#E0E0E0"
            filter="url(#bookShadow)"
          />

          {/* Static Inner Pages */}
          <rect
            x={pageX}
            y={pageY + 0.5}
            width={pageWidth}
            height={pageHeight - 1}
            rx="2"
            fill="#F8F8F8"
            stroke="#D1D5DB"
            strokeWidth="0.5"
            opacity="0.8"
          />
          <rect
            x={pageX}
            y={pageY + 1.0}
            width={pageWidth}
            height={pageHeight - 2}
            rx="2"
            fill="#F9F9F9"
            stroke="#D1D5DB"
            strokeWidth="0.5"
            opacity="0.7"
          />

          {/* Book Spine */}
          <rect
            x={bookX}
            y={bookY}
            width={spineWidth}
            height={bookHeight}
            rx="4"
            fill="url(#spineGradient)"
          />

          {/* Spiral binding rings */}
          <g fill="#6B7280" opacity="0.8">
            <ellipse cx={bookX + spineWidth / 2} cy={bookY + 10} rx="2" ry="3" />
            <ellipse cx={bookX + spineWidth / 2} cy={bookY + 25} rx="2" ry="3" />
            <ellipse cx={bookX + spineWidth / 2} cy={bookY + 40} rx="2" ry="3" />
            <ellipse cx={bookX + spineWidth / 2} cy={bookY + 55} rx="2" ry="3" />
          </g>

          {/* Colored tabs */}
          <rect x={bookX + bookWidth - 4} y={bookY + 5} width="4" height="8" rx="2" fill="#10B981" />
          <rect
            x={bookX + bookWidth - 4}
            y={bookY + 18}
            width="4"
            height="8"
            rx="2"
            fill="#8B5CF6"
          />
          <rect
            x={bookX + bookWidth - 4}
            y={bookY + 31}
            width="4"
            height="8"
            rx="2"
            fill="#F59E0B"
          />
          <rect
            x={bookX + bookWidth - 4}
            y={bookY + 44}
            width="4"
            height="8"
            rx="2"
            fill="#EF4444"
          />

          {/* FRONT COVER */}
          <g
            className="page-group cover"
            style={{
              transformOrigin: `${pageX}px ${bookY + bookHeight / 2}px`,
              animation: `flipCover ${animDuration}s ease-in-out infinite`,
              zIndex: 100,
              transformStyle: 'preserve-3d',
              position: 'relative',
            }}
          >
            <rect
              x={pageX}
              y={bookY}
              width={coverWidth}
              height={bookHeight}
              rx="4"
              fill="url(#coverGradient)"
              filter="url(#bookShadow)"
              style={{
                animation: `bendCover ${animDuration}s ease-in-out infinite`,
              }}
            />
            <text
              x={pageX + coverWidth / 2}
              y={bookY + bookHeight / 2 + 5}
              fill="white"
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
              filter="url(#glow)"
            >
              S-HUB AI
            </text>
            <g opacity="0.3" fill="white">
              <circle cx={pageX + 18} cy={bookY + 15} r="2.5" />
              <circle cx={pageX + 42} cy={bookY + 10} r="2" />
              <circle cx={pageX + 25} cy={bookY + 45} r="1.8" />
              <circle cx={pageX + 48} cy={bookY + 35} r="2.2" />
            </g>
          </g>

          {/* PAGE 1 */}
          <g
            className="page-group page"
            style={{
              transformOrigin: `${pageX}px ${bookY + bookHeight / 2}px`,
              animation: `flipPage1 ${animDuration}s ease-in-out infinite`,
              zIndex: 20,
              transformStyle: 'preserve-3d',
              position: 'relative',
            }}
          >
            <path
              d={`M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth + 2},${pageY + pageHeight / 4} ${pageX + pageWidth + 2},${pageY + 3 * pageHeight / 4} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z`}
              fill="white"
              stroke="#e5e7eb"
              strokeWidth="0.5"
              filter="url(#pageShadow)"
              style={{
                animation: `curlPage1 ${animDuration}s ease-in-out infinite`,
              }}
            />
            <rect
              x={pageX + pageWidth - 10}
              y={pageY}
              width="10"
              height={pageHeight}
              fill="url(#pageCurlGradient)"
              filter="url(#pageCurlFilter)"
            />
          </g>

          {/* PAGE 2 */}
          <g
            className="page-group page"
            style={{
              transformOrigin: `${pageX}px ${pageY + pageHeight / 2}px`,
              animation: `flipPage2 ${animDuration}s ease-in-out infinite`,
              zIndex: 18,
              transformStyle: 'preserve-3d',
              position: 'relative',
            }}
          >
            <path
              d={`M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth + 1.5},${pageY + pageHeight / 4} ${pageX + pageWidth + 1.5},${pageY + 3 * pageHeight / 4} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z`}
              fill="#fefefe"
              stroke="#e5e7eb"
              strokeWidth="0.5"
              filter="url(#pageShadow)"
              style={{
                animation: `curlPage2 ${animDuration}s ease-in-out infinite`,
              }}
            />
            <rect
              x={pageX + pageWidth - 10}
              y={pageY}
              width="10"
              height={pageHeight}
              fill="url(#pageCurlGradient)"
              filter="url(#pageCurlFilter)"
            />
          </g>

          {/* PAGE 3 */}
          <g
            className="page-group page"
            style={{
              transformOrigin: `${pageX}px ${pageY + pageHeight / 2}px`,
              animation: `flipPage3 ${animDuration}s ease-in-out infinite`,
              zIndex: 16,
              transformStyle: 'preserve-3d',
              position: 'relative',
            }}
          >
            <path
              d={`M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth + 1},${pageY + pageHeight / 4} ${pageX + pageWidth + 1},${pageY + 3 * pageHeight / 4} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z`}
              fill="white"
              stroke="#e5e7eb"
              strokeWidth="0.5"
              filter="url(#pageShadow)"
              style={{
                animation: `curlPage3 ${animDuration}s ease-in-out infinite`,
              }}
            />
            <rect
              x={pageX + pageWidth - 10}
              y={pageY}
              width="10"
              height={pageHeight}
              fill="url(#pageCurlGradient)"
              filter="url(#pageCurlFilter)"
            />
          </g>

          {/* Content lines */}
          <g
            className="content-lines"
            style={{
              animation: `showContent ${animDuration}s ease-in-out infinite`,
              opacity: 0,
            }}
          >
            <line
              x1={pageX + 7}
              y1={pageY + 10}
              x2={pageX + pageWidth - 10}
              y2={pageY + 10}
              stroke="#9CA3AF"
              strokeWidth="1"
            />
            <line
              x1={pageX + 7}
              y1={pageY + 18}
              x2={pageX + pageWidth - 15}
              y2={pageY + 18}
              stroke="#9CA3AF"
              strokeWidth="1"
            />
            <line
              x1={pageX + 7}
              y1={pageY + 26}
              x2={pageX + pageWidth - 10}
              y2={pageY + 26}
              stroke="#9CA3AF"
              strokeWidth="1"
            />
            <line
              x1={pageX + 7}
              y1={pageY + 34}
              x2={pageX + pageWidth - 20}
              y2={pageY + 34}
              stroke="#9CA3AF"
              strokeWidth="1"
            />
            <line
              x1={pageX + 7}
              y1={pageY + 42}
              x2={pageX + pageWidth - 12}
              y2={pageY + 42}
              stroke="#9CA3AF"
              strokeWidth="1"
            />
          </g>
        </svg>
      </div>

      {showText && (
        <div className="text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-gray-300 animate-pulse">
            {text}
          </p>
          <div className="flex space-x-1 justify-center mt-1">
            <div
              className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: '0ms' }}
            ></div>
            <div
              className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: '150ms' }}
            ></div>
            <div
              className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: '300ms' }}
            ></div>
          </div>
        </div>
      )}

      <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }

        .page-group {
          backface-visibility: hidden;
          transform-style: preserve-3d;
          position: relative;
        }

        @keyframes flipCover {
          0%, 90%, 100% {
            transform: rotateY(0deg) translateZ(30px);
            z-index: 100;
            opacity: 1;
          }
          10%, 85% {
            transform: rotateY(-180deg) translateZ(0px);
            z-index: 5;
            opacity: 1;
          }
        }

        @keyframes bendCover {
          0%, 90%, 100% {
            transform: scaleY(1) skewX(0deg);
          }
          10%, 85% {
            transform: scaleY(0.98) skewX(2deg) translateX(-2px); /* Wave-like bend */
          }
        }

        @keyframes flipPage1 {
          0%, 15%, 90%, 100% {
            transform: rotateY(0deg) translateZ(10px);
            z-index: 20;
            opacity: 0;
          }
          20%, 85% {
            transform: rotateY(-180deg) translateZ(10px);
            z-index: 20;
            opacity: 1;
          }
        }

        @keyframes curlPage1 {
          0%, 15%, 90%, 100% {
            d: path('M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth},${pageY + pageHeight / 4} ${pageX + pageWidth},${pageY + 3 * pageHeight / 4} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z');
          }
          20% {
            d: path('M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth + 8},${pageY + pageHeight / 4} ${pageX + pageWidth + 6},${pageY + 3 * pageHeight / 4} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z');
          }
          52.5% {
            d: path('M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth + 6},${pageY + pageHeight / 4 - 2} ${pageX + pageWidth + 8},${pageY + 3 * pageHeight / 4 + 2} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z');
          }
          85% {
            d: path('M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth + 8},${pageY + pageHeight / 4} ${pageX + pageWidth + 6},${pageY + 3 * pageHeight / 4} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z');
          }
        }

        @keyframes flipPage2 {
          0%, 20%, 90%, 100% {
            transform: rotateY(0deg) translateZ(8px);
            z-index: 18;
            opacity: 0;
          }
          25%, 85% {
            transform: rotateY(-180deg) translateZ(8px);
            z-index: 18;
            opacity: 1;
          }
        }

        @keyframes curlPage2 {
          0%, 20%, 90%, 100% {
            d: path('M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth},${pageY + pageHeight / 4} ${pageX + pageWidth},${pageY + 3 * pageHeight / 4} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z');
          }
          25% {
            d: path('M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth + 6},${pageY + pageHeight / 4} ${pageX + pageWidth + 4},${pageY + 3 * pageHeight / 4} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z');
          }
          55% {
            d: path('M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth + 4},${pageY + pageHeight / 4 - 1.5} ${pageX + pageWidth + 6},${pageY + 3 * pageHeight / 4 + 1.5} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z');
          }
          85% {
            d: path('M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth + 6},${pageY + pageHeight / 4} ${pageX + pageWidth + 4},${pageY + 3 * pageHeight / 4} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z');
          }
        }

        @keyframes flipPage3 {
          0%, 25%, 90%, 100% {
            transform: rotateY(0deg) translateZ(6px);
            z-index: 16;
            opacity: 0;
          }
          30%, 85% {
            transform: rotateY(-180deg) translateZ(6px);
            z-index: 16;
            opacity: 1;
          }
        }

        @keyframes curlPage3 {
          0%, 25%, 90%, 100% {
            d: path('M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth},${pageY + pageHeight / 4} ${pageX + pageWidth},${pageY + 3 * pageHeight / 4} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z');
          }
          30% {
            d: path('M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth + 4},${pageY + pageHeight / 4} ${pageX + pageWidth + 3},${pageY + 3 * pageHeight / 4} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z');
          }
          57.5% {
            d: path('M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth + 3},${pageY + pageHeight / 4 - 1} ${pageX + pageWidth + 4},${pageY + 3 * pageHeight / 4 + 1} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z');
          }
          85% {
            d: path('M${pageX},${pageY} L${pageX + pageWidth},${pageY} C${pageX + pageWidth + 4},${pageY + pageHeight / 4} ${pageX + pageWidth + 3},${pageY + 3 * pageHeight / 4} ${pageX + pageWidth},${pageY + pageHeight} L${pageX},${pageY + pageHeight} Z');
          }
        }

        @keyframes showContent {
          0%, 74% {
            opacity: 0;
          }
          80%, 85% {
            opacity: 1;
          }
          90%, 100% {
            opacity: 0;
          }
        }

        svg line {
          stroke-linecap: round;
        }
      `}</style>
    </div>
  );
};

export default BookPagesAnimation;
const LoadingScreen = ({
  progress,
  message,
  phase
}: {
  progress: number;
  message: string;
  phase: 'initial' | 'core' | 'secondary' | 'complete';
}) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // const getPhaseIcon = () => {
  //   switch (phase) {
  //     case 'initial':
  //       return '🔐';
  //     case 'core':
  //       return '📝';
  //     case 'secondary':
  //       return '⚡';
  //     default:
  //       return '✅';
  //   }
  // };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center max-w-md mx-auto p-8">
        {/* Logo */}
        <div className="mb-6">
          <BookPagesAnimation showText={false} className="mb-4" /> 
        </div>

        {/* Phase indicator */}
        {/* <div className="text-4xl mb-4">{getPhaseIcon()}</div> */}

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out ${progress === 100
              ? 'bg-green-500'
              : 'bg-gradient-to-r from-blue-500 to-purple-600'
              }`}
            style={{
              width: `${progress}%`,
              background: progress === 100
                ? '#10b981'
                : `linear-gradient(90deg, #3b82f6 0%,rgb(92, 146, 246) ${Math.min(progress, 100)}%)`
            }}
          />
        </div>

        {/* Progress percentage */}
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {progress}%
        </div>

        {/* Loading message */}
        <p className="text-slate-600 dark:text-gray-300 text-lg mb-2">
          {message}{dots}
        </p>

        {/* Phase description */}
        <p className="text-sm text-slate-500 dark:text-gray-400">
          {phase === 'initial' && 'Setting up your workspace...'}
          {phase === 'core' && 'Loading essential content...'}
          {phase === 'secondary' && 'Getting everything ready...'}
          {phase === 'complete' && 'All set! Welcome back!'}
        </p>

        {/* Skip button for secondary loading */}
        {phase === 'secondary' && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              // This would be passed from parent if needed
              console.log('Skip secondary loading');
            }}
          >
            Continue anyway
          </Button>
        )}
      </div>
    </div>
  );
};
export { BookPagesAnimation, LoadingScreen };