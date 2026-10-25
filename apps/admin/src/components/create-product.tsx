'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, FilePenLine } from 'lucide-react';
import { Button, Field } from '@ann/ui';
import { productInput } from '@ann/validation';
import { slugify } from '@ann/domain';
import { api } from '@/lib/client';
const schema = productInput.pick({ name: true, product_code: true, slug: true });
type Input = z.infer<typeof schema>;
export function CreateProduct() {
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Input>({ resolver: zodResolver(schema) });
  return (
    <>
      <Link href="/products" className="back-link">
        <ArrowLeft size={15} />
        Back to products
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BUILD YOUR CATALOG</span>
          <h1>A new product starts here.</h1>
          <p>Save the essentials first. Add variants, specifications, and media as you go.</p>
        </div>
      </div>
      <div className="create-layout">
        <form
          className="panel form-panel"
          onSubmit={handleSubmit(async (values) => {
            try {
              const result = await api<{ id: string }>('/api/admin/products', {
                method: 'POST',
                body: JSON.stringify(values),
              });
              window.location.assign(
                new URL(`/products/${result.id}`, window.location.origin).toString(),
              );
            } catch (e) {
              setError((e as Error).message);
            }
          })}
        >
          <div className="panel-heading">
            <div>
              <h2>Product essentials</h2>
              <p>A clear identity for your new catalog entry.</p>
            </div>
          </div>
          <div className="form-body">
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            <Field label="Product name" hint={errors.name?.message}>
              <input
                {...register('name', {
                  onChange: (e) => setValue('slug', slugify(e.target.value)),
                })}
                placeholder="e.g. White marker paper"
                required
              />
            </Field>
            <Field
              label="Product code"
              hint={errors.product_code?.message ?? 'A unique internal reference for this product.'}
            >
              <input {...register('product_code')} placeholder="e.g. ANN-MP-001" required />
            </Field>
            <Field
              label="URL slug"
              hint={errors.slug?.message ?? 'A stable address for the future public catalog.'}
            >
              <input {...register('slug')} placeholder="white-marker-paper" required />
            </Field>
          </div>
          <div className="form-footer">
            <Link href="/products" className="btn btn-outline">
              Cancel
            </Link>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Creating…' : 'Create draft'}
              <ArrowRight size={16} />
            </Button>
          </div>
        </form>
        <aside className="editor-help">
          <FilePenLine size={25} />
          <h3>Room to get every detail right.</h3>
          <p>
            Your product is saved as a private draft. It only becomes public after an administrator
            reviews and publishes it.
          </p>
          <ol>
            <li>Create the product draft</li>
            <li>Add SKUs and technical details</li>
            <li>Set pricing and upload imagery</li>
            <li>Review and publish</li>
          </ol>
        </aside>
      </div>
    </>
  );
}
