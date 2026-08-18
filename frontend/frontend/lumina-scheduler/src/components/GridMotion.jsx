import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const GridMotion = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      
      const xPos = (clientX / innerWidth - 0.5) * 20; // Max 20px movement
      const yPos = (clientY / innerHeight - 0.5) * 20;

      containerRef.current.style.transform = `translate(${xPos}px, ${yPos}px)`;
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="grid-motion-wrapper">
      <div className="grid-motion-container" ref={containerRef}>
        <div className="grid-pattern" />
      </div>

      <style>{`
        .grid-motion-wrapper {
          position: fixed;
          inset: -50px; /* Oversized to allow movement without showing edges */
          z-index: -2;
          overflow: hidden;
          pointer-events: none;
        }
        
        .grid-motion-container {
          width: 100%;
          height: 100%;
          transition: transform 0.1s ease-out;
          will-change: transform;
        }

        .grid-pattern {
          width: 100%;
          height: 100%;
          background-image: 
            linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px);
          background-size: 50px 50px;
          mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
        }
      `}</style>
    </div>
  );
};

export default GridMotion;
