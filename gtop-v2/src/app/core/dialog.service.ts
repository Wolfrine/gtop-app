import { Injectable, signal } from '@angular/core';

export interface AppDialogRequest {
  kind: 'confirm' | 'prompt';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  inputLabel?: string;
  defaultValue?: string;
  requiredValue?: string;
  resolve: (value: boolean | string | null) => void;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface PromptOptions extends ConfirmOptions {
  inputLabel: string;
  defaultValue?: string;
  requiredValue?: string;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly request = signal<AppDialogRequest | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) =>
      this.request.set({
        kind: 'confirm',
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Continue',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        danger: options.danger ?? false,
        resolve: (value) => resolve(Boolean(value)),
      }),
    );
  }

  prompt(options: PromptOptions): Promise<string | null> {
    return new Promise<string | null>((resolve) =>
      this.request.set({
        kind: 'prompt',
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Save',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        danger: options.danger ?? false,
        inputLabel: options.inputLabel,
        defaultValue: options.defaultValue ?? '',
        requiredValue: options.requiredValue,
        resolve: (value) => resolve(typeof value === 'string' ? value : null),
      }),
    );
  }

  complete(value: boolean | string | null): void {
    const current = this.request();
    if (!current) return;
    this.request.set(null);
    current.resolve(value);
  }
}
