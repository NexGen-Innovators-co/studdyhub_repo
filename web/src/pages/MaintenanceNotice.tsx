import React, { useState } from 'react';
import { Smartphone, ExternalLink, Loader2, CheckCircle2, BookOpen, Mail, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const APK_DOWNLOAD_URL = '/studdyhub-v1.0-beta.3.apk';
const APK_FILENAME = 'studdyhub-v1.0-beta.3.apk';

function detectDevice(): 'android' | 'ios' | 'desktop' {
  const ua = navigator.userAgent || navigator.vendor || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}

export default function MaintenanceNotice() {
  const device = detectDevice();
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'done'>('idle');

  const handleDownload = () => {
    if (downloadState !== 'idle') return;
    setDownloadState('downloading');
    const link = document.createElement('a');
    link.href = APK_DOWNLOAD_URL;
    link.download = APK_FILENAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      setDownloadState('done');
      setTimeout(() => setDownloadState('idle'), 4000);
    }, 3000);
  };

  return (
    <div className="public-site min-h-screen bg-[#F7F8F5] dark:bg-[#101923] flex items-center justify-center p-4 md:p-8">
      <div className="max-w-5xl w-full">
        <header className="flex items-center justify-between mb-14">
          <Link to="/" className="flex items-center gap-3">
            <img src="/siteimage.png" alt="StuddyHub" className="h-11 w-11 object-contain" />
            <span className="text-xl font-bold text-[#2F5BEA] dark:text-white">StuddyHub <span className="text-[#E56B4D]">AI</span></span>
          </Link>
          <span className="hidden sm:inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#E56B4D]">
            <span className="h-2 w-2 rounded-full bg-[#E56B4D] animate-pulse" /> Maintenance mode
          </span>
        </header>

        <div className="grid lg:grid-cols-[1fr_0.8fr] gap-10 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168C86] mb-5">A short pause / We’re improving the web app</p>
            <h1 className="public-display text-5xl md:text-7xl font-normal leading-[0.98] text-[#122033] dark:text-white mb-6">The desk is being reset.</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl leading-relaxed mb-8">Web access is temporarily unavailable while we upgrade StuddyHub. Your study materials are not going anywhere.</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/documentation-page" className="inline-flex items-center gap-2 min-h-12 px-5 bg-[#2F5BEA] hover:bg-[#2448c5] text-white font-semibold rounded-md transition-colors">
                Browse documentation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2 min-h-12 px-5 border public-rule text-[#122033] dark:text-white font-semibold rounded-md hover:bg-white dark:hover:bg-[#182431] transition-colors">
                <Mail className="h-4 w-4" /> Contact us
              </Link>
            </div>
          </div>

          <div className="study-strip p-6 md:p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-[#2F5BEA] mb-5">
              <img src="/siteimage.png" alt="StuddyHub" className="h-10 w-10 object-contain" />
            </div>
            <h2 className="public-display text-3xl font-normal text-[#122033] dark:text-white mb-3">Keep studying on Android.</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">The mobile app has the latest features and works offline.</p>

            {device === 'android' && (
              <div className="space-y-3">
                <button
                  onClick={handleDownload}
                  disabled={downloadState !== 'idle'}
                  className={`inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-colors ${downloadState === 'idle'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : downloadState === 'downloading'
                        ? 'bg-blue-400 text-white/90 cursor-wait'
                        : 'bg-green-600 text-white'
                    }`}
                >
                  {downloadState === 'idle' && (<><Smartphone className="h-5 w-5" /> Download App <ExternalLink className="h-4 w-4 opacity-70" /></>)}
                  {downloadState === 'downloading' && (<><Loader2 className="h-5 w-5 animate-spin" /> Downloading…</>)}
                  {downloadState === 'done' && (<><CheckCircle2 className="h-5 w-5" /> Download started</>)}
                </button>
                <p className="text-xs text-gray-400">v1.0-beta.3 / Free download</p>
              </div>
            )}

            {device === 'ios' && (
              <div className="bg-[#F7F8F5] dark:bg-[#101923] border public-rule p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">StuddyHub is not available on iOS yet. Please use an Android device.</p>
              </div>
            )}

            {device === 'desktop' && (
              <div className="bg-[#F7F8F5] dark:bg-[#101923] border public-rule p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">StuddyHub is a mobile app. Please use an Android device.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 mt-10 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/" className="inline-flex items-center gap-2 hover:text-[#2F5BEA]"><BookOpen className="h-4 w-4" /> Home</Link>
          <Link to="/about-us" className="hover:text-[#2F5BEA]">About StuddyHub</Link>
          <span>We’ll be back soon.</span>
        </div>
      </div>
    </div>
  );
}
