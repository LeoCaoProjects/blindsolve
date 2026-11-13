import React from 'react';
import { motion } from 'framer-motion';
import { EASE_OUT } from '../../utils/keyboard';

export function Fade({ children, className = '' }: {children: React.ReactNode;className?: string;}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14, ease: EASE_OUT }}
      className={className}>
      
      {children}
    </motion.div>);

}