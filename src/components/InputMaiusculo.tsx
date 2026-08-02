import React, { useRef, useLayoutEffect } from 'react';

export interface InputMaiusculoProps extends React.InputHTMLAttributes<HTMLInputElement> {
  disableUppercase?: boolean;
}

export const InputMaiusculo = React.forwardRef<HTMLInputElement, InputMaiusculoProps>(
  ({ onChange, value, type = 'text', disableUppercase, ...props }, ref) => {
    const internalRef = useRef<HTMLInputElement | null>(null);
    const selectionRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });

    const setRef = (node: HTMLInputElement | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    };

    useLayoutEffect(() => {
      const input = internalRef.current;
      if (input && selectionRef.current.start !== null && selectionRef.current.end !== null) {
        try {
          if (/^(text|search|tel|url)$/.test(input.type)) {
            input.setSelectionRange(selectionRef.current.start, selectionRef.current.end);
          }
        } catch (err) {
          // Ignore selection range errors for unsupported types
        }
      }
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!onChange) return;

      const isExempt =
        disableUppercase ||
        type === 'email' ||
        type === 'password' ||
        type === 'number' ||
        type === 'file' ||
        type === 'checkbox' ||
        type === 'radio' ||
        type === 'date' ||
        type === 'time';

      if (isExempt) {
        onChange(e);
        return;
      }

      const input = e.target;
      const start = input.selectionStart;
      const end = input.selectionEnd;

      const uppercaseValue = input.value.toUpperCase();
      selectionRef.current = { start, end };

      e.target.value = uppercaseValue;
      onChange(e);
    };

    return (
      <input
        {...props}
        type={type}
        ref={setRef}
        value={value}
        onChange={handleChange}
      />
    );
  }
);

InputMaiusculo.displayName = 'InputMaiusculo';

export interface TextareaMaiusculoProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  // Standard HTML textarea props
}

export const TextareaMaiusculo = React.forwardRef<HTMLTextAreaElement, TextareaMaiusculoProps>(
  ({ onChange, value, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);
    const selectionRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });

    const setRef = (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      }
    };

    useLayoutEffect(() => {
      const textarea = internalRef.current;
      if (textarea && selectionRef.current.start !== null && selectionRef.current.end !== null) {
        textarea.setSelectionRange(selectionRef.current.start, selectionRef.current.end);
      }
    });

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!onChange) return;

      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const uppercaseValue = textarea.value.toUpperCase();
      selectionRef.current = { start, end };

      e.target.value = uppercaseValue;
      onChange(e);
    };

    return (
      <textarea
        {...props}
        ref={setRef}
        value={value}
        onChange={handleChange}
      />
    );
  }
);

TextareaMaiusculo.displayName = 'TextareaMaiusculo';
