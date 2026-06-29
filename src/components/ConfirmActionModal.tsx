import React, { useState } from 'react';

type Variant = 'default' | 'warning' | 'danger';

interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  helperNote?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  onConfirm: () => void;
  requireTypedConfirmation?: string;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  helperNote,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  requireTypedConfirmation
}) => {
  const [typedConfirmation, setTypedConfirmation] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireTypedConfirmation && typedConfirmation !== requireTypedConfirmation) {
      return;
    }
    onConfirm();
    setTypedConfirmation('');
    onClose();
  };

  const handleClose = () => {
    setTypedConfirmation('');
    onClose();
  };

  const isConfirmDisabled = requireTypedConfirmation 
    ? typedConfirmation !== requireTypedConfirmation
    : false;

  let confirmBtnClass = "px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors cursor-pointer ";
  if (variant === 'danger') {
    confirmBtnClass += isConfirmDisabled ? "bg-rose-600/50 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700 shadow-[0_0_15px_rgba(225,29,72,0.3)]";
  } else if (variant === 'warning') {
    confirmBtnClass += isConfirmDisabled ? "bg-amber-600/50 cursor-not-allowed" : "bg-amber-600 hover:bg-amber-700 shadow-[0_0_15px_rgba(217,119,6,0.3)]";
  } else {
    confirmBtnClass += isConfirmDisabled ? "bg-emerald-600/50 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 shadow-[0_0_15px_rgba(5,150,105,0.3)]";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div 
        className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl animate-fade-in-up"
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-300 text-sm mb-4 leading-relaxed whitespace-pre-line">{message}</p>
        
        {helperNote && (
          <p className="text-xs text-slate-400 mb-6 italic">{helperNote}</p>
        )}

        {requireTypedConfirmation && (
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Type "{requireTypedConfirmation}" to confirm
            </label>
            <input
              type="text"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
              placeholder={requireTypedConfirmation}
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-8">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={confirmBtnClass}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
