// src/hooks/useChangelog.js

import { useState, useEffect } from 'react';

const SEEN_KEY = 'prachify_last_seen_version';

export function useChangelog() {
  const [changelog, setChangelog] = useState([]);
  const [hasNew, setHasNew] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetch('/changelog.json')
      .then(r => r.json())
      .then(data => {
        // Automatically sort by date (newest first)
        const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recent = sortedData.slice(0, 10); // sirf latest 10 dikhao
        setChangelog(recent);
        const latest = recent[0]?.version;
        const seen = localStorage.getItem(SEEN_KEY);
        if (latest && latest !== seen) {
          setHasNew(true); // red dot dikhao
        }
      })
      .catch(() => {}); // silently fail — app nahi rukta
  }, []);

  const openChangelog = () => {
    setIsOpen(true);
    setHasNew(false);
    // Mark as seen
    if (changelog[0]?.version) {
      localStorage.setItem(SEEN_KEY, changelog[0].version);
    }
  };

  const closeChangelog = () => setIsOpen(false);

  return { changelog, hasNew, isOpen, openChangelog, closeChangelog };
}
