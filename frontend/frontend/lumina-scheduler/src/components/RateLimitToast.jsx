import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X } from 'lucide-react';

const RateLimitToast = () => {
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleRateLimit = (e) => {
      setError(e.detail.message || "Too many requests. Please wait a moment.");
      // Auto-dismiss after 5 seconds
      setTimeout(() => setError(null), 5000);
    };

    window.addEventListener('api:rate-limit', handleRateLimit);
    return () => window.removeEventListener('api:rate-limit', handleRateLimit);
  }, []);

  return (
    <AnimatePresence>
      {error && (
        <motion.div 
          className="rate-limit-toast"
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
        >
          <div className="toast-content glass-card">
            <ShieldAlert size={20} color="#ef4444" />
            <div className="toast-text">
              <strong>Rate Limit Reached</strong>
              <p>{error}</p>
            </div>
            <button onClick={() => setError(null)} className="close-toast">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
      <style>{`
        .rate-limit-toast {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          z-index: 10000;
          pointer-events: none;
        }
        .toast-content {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.5rem;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(239, 68, 68, 0.3);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 15px rgba(239, 68, 68, 0.1);
          border-radius: 16px;
          min-width: 320px;
        }
        .toast-text {
          flex: 1;
        }
        .toast-text strong {
          display: block;
          font-size: 0.9rem;
          color: #fff;
          margin-bottom: 0.1rem;
        }
        .toast-text p {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin: 0;
        }
        .close-toast {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .close-toast:hover {
          color: #fff;
          background: rgba(255,255,255,0.05);
        }
      `}</style>
    </AnimatePresence>
  );
};

export default RateLimitToast;
