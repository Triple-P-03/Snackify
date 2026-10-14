(() => {
  'use strict';

  const hero = document.querySelector('[data-hero]');
  const video = document.getElementById('hero-video');
  const scene = hero?.querySelector('.hero__scene');
  if (!hero || !video || !scene) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let hasScrolled = false;
  let targetTime = 0;
  let targetProgress = 0;
  let displayedProgress = 0;
  let failed = false;

  // The video never plays on a timer. Scroll position alone chooses the frame.
  video.muted = true;
  video.pause();
  hero.dataset.enhanced = 'true';

  function seekToTarget() {
    if (failed || video.seeking || video.readyState < 1 || !Number.isFinite(video.duration)) return;
    if (Math.abs(video.currentTime - targetTime) > 0.025) video.currentTime = targetTime;
  }

  function render() {
    frame = 0;
    if (failed || document.hidden) return;
    video.pause();

    const bounds = hero.getBoundingClientRect();
    const travel = Math.max(1, hero.offsetHeight - scene.offsetHeight);
    targetProgress = hasScrolled && !reducedMotion.matches
      ? Math.min(1, Math.max(0, -bounds.top / travel)) : 0;

    // Ease toward the scroll target so the large background moves slowly and smoothly.
    displayedProgress += (targetProgress - displayedProgress) * 0.075;
    if (Math.abs(targetProgress - displayedProgress) > 0.0005) requestRender();

    // Avoid seeking to the exact end, which can display a blank frame in some browsers.
    const progress = displayedProgress;
    // Use the second half of the scroll track to scrub back after reaching the end.
    // This creates a forward-then-reverse loop without autoplay or extra video copies.
    const playbackProgress = progress <= 0.55
      ? progress / 0.55
      : (1 - progress) / 0.45;
    targetTime = Number.isFinite(video.duration)
      ? playbackProgress * Math.max(0, video.duration - 0.05) : 0;
    hero.style.setProperty('--hero-progress', progress.toFixed(4));
    hero.dataset.motion = reducedMotion.matches ? 'reduced' : 'scroll';
    seekToTarget();
  }

  function requestRender() {
    if (!frame) frame = window.requestAnimationFrame(render);
  }

  video.addEventListener('loadeddata', () => {
    if (!failed) hero.dataset.media = 'video';
    requestRender();
  });
  video.addEventListener('loadedmetadata', requestRender);
  video.addEventListener('seeked', requestRender);
  video.addEventListener('play', () => video.pause());
  video.addEventListener('error', () => {
    failed = true;
    hero.dataset.media = 'poster';
    hero.dataset.motion = 'unavailable';
  });
  window.addEventListener('scroll', () => {
    hasScrolled = true;
    requestRender();
  }, { passive: true });
  window.addEventListener('resize', requestRender, { passive: true });
  document.addEventListener('visibilitychange', requestRender);
  reducedMotion.addEventListener('change', requestRender);

  if (video.readyState >= 2) hero.dataset.media = 'video';
  if (video.error) {
    failed = true;
    hero.dataset.motion = 'unavailable';
  }
  requestRender();
})();
