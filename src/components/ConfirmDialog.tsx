import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WarningOctagon } from '@phosphor-icons/react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="confirm-dialog-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full shadow-xl overflow-hidden"
        >
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              variant === 'danger'
                ? 'bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                : 'bg-accent-100 dark:bg-accent-950/30 text-accent-600 dark:text-accent-400'
            }`}>
              <WarningOctagon className="w-7 h-7" weight="fill" />
            </div>

            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">{title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">{message}</p>
            </div>

            <div className="flex gap-2.5 w-full mt-1">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                  variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-accent-600 hover:bg-accent-700 text-white'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
