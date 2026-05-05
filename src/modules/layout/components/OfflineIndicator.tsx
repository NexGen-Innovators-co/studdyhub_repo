import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();
  const [showOnlineMessage, setShowOnlineMessage] = useState(false);
  const [hasBeenOffline, setHasBeenOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setHasBeenOffline(true);
    }

    if (isOnline && hasBeenOffline) {
      setShowOnlineMessage(true);
      const timer = setTimeout(() => {
          setShowOnlineMessage(false);
          setHasBeenOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, hasBeenOffline]);

  if (!isOnline) {
    return (
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] bg-red-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 text-sm font-medium border border-red-500 animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto">
        <WifiOff className="h-5 w-5" />
        <span className="whitespace-nowrap">You are currently offline</span>
      </div>
    );
  }

  if (showOnlineMessage) {
    return (
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] bg-green-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 text-sm font-medium border border-green-500 animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-none">
        <Wifi className="h-5 w-5" />
        <span className="whitespace-nowrap">You are back online</span>
      </div>
    );
  }

  return null;
};
