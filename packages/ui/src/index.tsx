'use client';
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...v: ClassValue[]) => twMerge(clsx(v));
const button = cva('btn', {
  variants: {
    variant: {
      default: 'btn-primary',
      outline: 'btn-outline',
      danger: 'btn-danger',
      ghost: 'btn-ghost',
    },
  },
  defaultVariants: { variant: 'default' },
});
export function Button({
  className,
  variant,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>) {
  return <button className={cn(button({ variant }), className)} {...props} />;
}
export function Badge({ children, status }: { children: React.ReactNode; status?: string }) {
  return <span className={`badge badge-${status ?? 'draft'}`}>{children}</span>;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = React.useId();
  const props = { id, 'aria-describedby': hint ? `${id}-hint` : undefined };
  let control = children;
  if (React.isValidElement(children)) {
    const element = children as React.ReactElement<{
      children?: React.ReactNode;
      id?: string;
      'aria-describedby'?: string;
    }>;
    control =
      element.type === 'span'
        ? React.cloneElement(
            element,
            {},
            React.Children.map(element.props.children, (c) =>
              React.isValidElement(c) && c.type === 'input'
                ? React.cloneElement(
                    c as React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>,
                    props,
                  )
                : c,
            ),
          )
        : React.cloneElement(element, props);
  }
  return (
    <div className="field">
      <label htmlFor={id}>
        <span>{label}</span>
      </label>
      {control}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              ×
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
