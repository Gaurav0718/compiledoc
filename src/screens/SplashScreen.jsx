import React, { useEffect } from 'react';
import { playSplashMusic } from '../logic/sounds';

export default function SplashScreen({ onDone }) {
  useEffect(() => {
    // Try to play splash music (needs user interaction first — best effort)
    const tryMusic = () => { playSplashMusic(); document.removeEventListener('click', tryMusic); };
    // Play immediately if context is already unlocked, else on first interaction
    try { playSplashMusic(); } catch {}
    document.addEventListener('click', tryMusic, { once: true });
    const timer = setTimeout(() => onDone(), 3200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="splash">
      <div className="splash-logo-wrap">
        <div className="splash-ring" />
        <div className="splash-icon">📋</div>
      </div>
      <div className="splash-name">CompileDoc</div>
      <div className="splash-tagline">Collect · Track · Tally</div>
      <div className="splash-bar-wrap">
        <div className="splash-bar">
          <div className="splash-bar-fill" />
        </div>
        <div className="splash-bar-label">Loading</div>
      </div>
    </div>
  );
}
