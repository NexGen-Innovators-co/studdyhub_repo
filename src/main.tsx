import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Register Service Worker for push notifications and updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Check for updates periodically (e.g., every hour)
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // Handle update discovery
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New update available!
                  import('sonner').then(({ toast }) => {
                    toast.info('A new version of StuddyHub is available.', {
                      duration: Infinity,
                      action: {
                        label: 'Update Now',
                        onClick: () => {
                          if (registration.waiting) {
                            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                          }
                          window.location.reload();
                        },
                      },
                    });
                  });
                }
              }
            };
          }
        };
      })
      .catch((error) => {
        // console.error('❌ Service Worker registration failed:', error);
      });
  });

  // Handle automatic reload when the new service worker takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
