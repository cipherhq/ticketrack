import { useState, useCallback, createContext, useContext } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Context and Provider for confirmation dialogs
 * Usage:
 * 1. Wrap your app with <ConfirmProvider>
 * 2. Use the useConfirm() hook in components
 *
 * Example:
 * const confirm = useConfirm();
 * const handleDelete = async () => {
 *   if (await confirm('Delete this item?', 'This action cannot be undone.')) {
 *     // User confirmed - proceed with deletion
 *   }
 * };
 */

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default', // 'default' | 'destructive'
    resolve: null,
  });

  const confirm = useCallback((title, description, options = {}) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: title || 'Are you sure?',
        description: description || '',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'default',
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, open: false }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, open: false }));
  }, [state.resolve]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={state.open} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{state.title}</AlertDialogTitle>
            {state.description && (
              <AlertDialogDescription>{state.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} className="rounded-xl">
              {state.cancelText}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={`rounded-xl ${
                state.variant === 'destructive'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-[#2969FF] hover:bg-[#2969FF]/90 text-white'
              }`}
            >
              {state.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

/**
 * Standalone confirm function for use outside React components
 * Falls back to window.confirm but logs a warning
 *
 * Use the useConfirm hook instead when possible
 */
export function confirmFallback(message) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[useConfirm] Using fallback window.confirm. Consider wrapping your app with ConfirmProvider and using the useConfirm hook.'
    );
  }
  return window.confirm(message);
}
