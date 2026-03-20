import React, { useState, useCallback, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';
import { Input } from './input';
import { cn } from '@/lib/utils';

/* ---------- Declarative ConfirmDialog ---------- */

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  /** Optional: require the user to type a confirmation phrase */
  confirmPhrase?: string;
  confirmPhraseLabel?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  confirmPhrase,
  confirmPhraseLabel,
}) => {
  const [typedPhrase, setTypedPhrase] = useState('');
  const phraseMatches = !confirmPhrase || typedPhrase === confirmPhrase;

  const handleConfirm = () => {
    if (phraseMatches) {
      onConfirm();
      onOpenChange(false);
      setTypedPhrase('');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => {
      if (!v) setTypedPhrase('');
      onOpenChange(v);
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {confirmPhrase && (
          <div className="space-y-2 pt-2">
            <p className="text-sm text-muted-foreground">
              {confirmPhraseLabel || `Type "${confirmPhrase}" to confirm:`}
            </p>
            <Input
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder={confirmPhrase}
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!phraseMatches}
            className={cn(
              variant === 'destructive' &&
                'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600'
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

/* ---------- Imperative useConfirmDialog hook ---------- */

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'default' | 'destructive';
  confirmPhrase?: string;
  confirmPhraseLabel?: string;
}

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  confirmPhrase?: string;
  confirmPhraseLabel?: string;
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Continue',
    cancelLabel: 'Cancel',
    variant: 'default',
  });

  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        open: true,
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel || 'Continue',
        cancelLabel: options.cancelLabel || 'Cancel',
        variant: options.variant || 'default',
        confirmPhrase: options.confirmPhrase,
        confirmPhraseLabel: options.confirmPhraseLabel,
      });
    });
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      resolveRef.current?.(false);
      resolveRef.current = null;
    }
    setState((prev) => ({ ...prev, open }));
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const DialogComponent = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={handleOpenChange}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={handleConfirm}
      confirmPhrase={state.confirmPhrase}
      confirmPhraseLabel={state.confirmPhraseLabel}
    />
  );

  return { confirm, ConfirmDialogComponent: DialogComponent };
}
