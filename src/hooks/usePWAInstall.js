import { useState, useEffect, useCallback } from 'react';

/**
 * Handles PWA install prompt — captures beforeinstallprompt event
 * and exposes install() function + state.
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);

      // Show modal after a short delay (don't be pushy on first load)
      const hasShownPrompt = localStorage.getItem('prachify-install-prompted');
      if (!hasShownPrompt) {
        setTimeout(() => setShowModal(true), 3000);
        localStorage.setItem('prachify-install-prompted', '1');
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setCanInstall(false);
      setShowModal(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setCanInstall(false);
    }
    setDeferredPrompt(null);
    setShowModal(false);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setShowModal(false);
  }, []);

  const openModal = useCallback(() => {
    setShowModal(true);
  }, []);

  return { canInstall, isInstalled, showModal, install, dismiss, openModal };
}
