import React from 'react';
import { Smartphone, ExternalLink, Shield, ArrowRight } from 'lucide-react';

const GITHUB_RELEASES_URL = 'https://github.com/NexGen-Innovators-co/studdyhub_repo/releases/latest';

function detectDevice(): 'android' | 'ios' | 'desktop' {
  const ua = navigator.userAgent || navigator.vendor || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}

export default function MaintenanceNotice() {
  const device = detectDevice();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/25 mb-4">
            <img src="/siteimage.png" alt="StuddyHub" className="h-14 w-14 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            StuddyHub
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Your AI study companion
          </p>
        </div>

        {/* Maintenance Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-700 p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-5">
            <Shield className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
            Web access is under maintenance
          </h2>

          <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
            The StuddyHub web app is currently being upgraded. To continue
            studying, please use the <strong>StuddyHub Android app</strong> — it's
            faster, works offline, and has all the latest features.
          </p>

          {/* Android download */}
          {device === 'android' && (
            <div className="space-y-3">
              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-blue-700 transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Smartphone className="h-5 w-5" />
                Download App
                <ExternalLink className="h-4 w-4 opacity-70" />
              </a>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Free download from GitHub Releases
              </p>
            </div>
          )}

          {/* iOS message */}
          {device === 'ios' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                StuddyHub is not available on iOS yet.
              </p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                Please use an Android device to access StuddyHub.
              </p>
            </div>
          )}

          {/* Desktop message */}
          {device === 'desktop' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                StuddyHub is a mobile app.
              </p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                Open this page on an Android phone to download the app.
              </p>
              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View on GitHub
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          We're working hard to bring StuddyHub back online. Thank you for your patience.
        </p>
      </div>
    </div>
  );
}
