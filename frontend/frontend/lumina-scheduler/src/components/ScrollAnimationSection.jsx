import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

const FRAME_COUNT = 192;
const FRAME_PATH = (i) => `/frames/${String(i).padStart(5, '0')}.png`;


export default function ScrollAnimationSection() {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const imagesRef = useRef([]);
  const rafRef = useRef(null);
  const currentFrameRef = useRef(0);

  const [loadProgress, setLoadProgress] = useState(0);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);

  // Scroll progress scoped to this section
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Spring-smooth the scroll value to remove jitter
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 20,
    restDelta: 0.001,
  });

  // ── Canvas draw ──────────────────────────────────────────────────────────
  const drawFrame = useCallback((index) => {
    const canvas = canvasRef.current;
    const img = imagesRef.current[index];
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;

    // Resize canvas only when needed
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.scale(dpr, dpr);
    }

    // Cover fill (like object-fit: cover)
    const imgR = img.naturalWidth / img.naturalHeight;
    const canR = W / H;
    let sw, sh, sx, sy;

    if (canR > imgR) {
      sw = img.naturalWidth;
      sh = img.naturalWidth / canR;
      sx = 0;
      sy = (img.naturalHeight - sh) / 2;
    } else {
      sh = img.naturalHeight;
      sw = img.naturalHeight * canR;
      sx = (img.naturalWidth - sw) / 2;
      sy = 0;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  }, []);

  // ── Scroll → frame mapping ─────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = smoothProgress.on('change', (v) => {
      const target = Math.min(FRAME_COUNT - 1, Math.max(0, Math.floor(v * FRAME_COUNT)));
      if (target === currentFrameRef.current) return;
      currentFrameRef.current = target;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => drawFrame(target));
    });

    return () => {
      unsubscribe();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [smoothProgress, drawFrame]);

  // ── Image preloading ───────────────────────────────────────────────────────
  useEffect(() => {
    let count = 0;
    const images = new Array(FRAME_COUNT).fill(null);

    const checkDone = () => {
      count++;
      setLoadProgress(Math.round((count / FRAME_COUNT) * 100));
      if (count === FRAME_COUNT) {
        imagesRef.current = images;
        setAllLoaded(true);
        drawFrame(0);
      }
    };

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.src = FRAME_PATH(i + 1);
      const idx = i;
      img.onload = () => {
        images[idx] = img;
        if (idx === 0) {
          imagesRef.current[0] = img;
          setFirstFrameReady(true);
          requestAnimationFrame(() => drawFrame(0));
        }
        checkDone();
      };
      img.onerror = checkDone;
    }

    // Resize handler
    const onResize = () => drawFrame(currentFrameRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawFrame]);



  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        height: '500vh',
        background: 'var(--background)',
        margin: '8rem 0',
      }}
    >
      {/* ── Sticky viewport ── */}
      <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />

        {/* Loading overlay */}
        {!allLoaded && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            zIndex: 30,
            opacity: firstFrameReady ? 0 : 1,
            transition: 'opacity 0.6s ease',
            pointerEvents: firstFrameReady ? 'none' : 'all',
          }}>
            <div style={{
              width: 240,
              height: 3,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 99,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${loadProgress}%`,
                background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                borderRadius: 99,
                transition: 'width 0.2s ease',
              }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}>
              {loadProgress}% — Preparing experience
            </p>
          </div>
        )}

        {/* Cinematic vignette */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.65) 100%)',
          pointerEvents: 'none',
          zIndex: 5,
        }} />


        {/* Progress bar (bottom) */}
        <motion.div
          style={{
            scaleX: smoothProgress,
            transformOrigin: 'left',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
            zIndex: 20,
          }}
        />
      </div>
    </section>
  );
}
