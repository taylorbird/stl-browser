import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoadingImage({ src, alt, className = '', ...props }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full h-full">
      <AnimatePresence>
        {!loaded && !error && (
          <motion.div
            key="skeleton"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            className="absolute inset-0 flex items-center justify-center bg-gray-800"
          >
            <span className="loading loading-spinner loading-md text-gray-500" />
          </motion.div>
        )}
      </AnimatePresence>
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 text-gray-600 text-sm">
          No preview
        </div>
      ) : (
        <motion.img
          src={src}
          alt={alt}
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={className}
          {...props}
        />
      )}
    </div>
  );
}
