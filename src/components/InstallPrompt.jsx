import React from 'react';

export default function InstallPrompt({ show, canInstall, onInstall, onDismiss }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm fade-in">
      <div
        className="w-full max-w-sm bg-surface border border-border/80 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex flex-col gap-5 slide-up-panel"
        style={{
          marginBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-pink-purple flex items-center justify-center text-3xl shadow-glow">
            🎧
          </div>
          <h3 className="text-lg font-bold text-text-primary mt-2">
            Keep Prachify on your home screen 🎧
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Install this personal late-night music space as an app for background playback, premium offline support, and lock screen controls.
          </p>
        </div>

        {canInstall ? (
          /* PWA install standard dialog */
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onInstall}
              className="btn-primary w-full py-3.5 text-sm font-semibold rounded-2xl"
            >
              Install App
            </button>
            <button
              onClick={onDismiss}
              className="w-full py-3 text-xs font-semibold text-text-muted hover:text-text-secondary active:scale-95 transition-all text-center"
            >
              Maybe later
            </button>
          </div>
        ) : (
          /* Fallback Android manual instructions */
          <div className="flex flex-col gap-4">
            <div className="bg-elevated/50 border border-border/40 rounded-xl p-3 text-left">
              <span className="text-[10px] font-bold text-pink uppercase tracking-wide">
                How to install on Android
              </span>
              <ol className="text-xs text-text-secondary list-decimal list-inside space-y-1.5 mt-2">
                <li>Tap the three dots (<span className="font-bold">⋮</span>) in Chrome</li>
                <li>Select <span className="font-semibold text-text-primary">Add to Home screen</span></li>
                <li>Tap <span className="font-semibold text-text-primary">Add</span> to confirm</li>
              </ol>
            </div>
            <button
              onClick={onDismiss}
              className="btn-primary w-full py-3 text-xs font-semibold rounded-2xl"
            >
              Got it, thanks!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
