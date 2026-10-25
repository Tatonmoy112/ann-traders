import { z } from 'zod';
import { requireAdmin, HttpError } from '@/lib/auth';
import { body, databaseError, failure, json } from '@/lib/http';

const updateSchema = z.object({
  status: z.enum(['new', 'in_review', 'quoted', 'closed']).optional(),
  admin_notes: z.string().optional(),
  quoted_amount: z.number().nullable().optional(),
  quoted_currency: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db } = await requireAdmin();
    const { id } = await params;
    z.string().uuid().parse(id);

    const { data: inquiry, error } = await db
      .from('inquiries')
      .select('*, products(id, name, slug, product_code)')
      .eq('id', id)
      .single();

    if (error || !inquiry) throw new HttpError(404, 'Inquiry not found');

    return json(inquiry);
  } catch (e) {
    return failure(e);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db } = await requireAdmin();
    const { id } = await params;
    z.string().uuid().parse(id);

    const payload = updateSchema.parse(await body(request));

    const { data: updated, error } = await db
      .from('inquiries')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) databaseError(error);

    return json({ success: true, inquiry: updated });
  } catch (e) {
    return failure(e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db } = await requireAdmin(['super_admin', 'admin']);
    const { id } = await params;
    z.string().uuid().parse(id);

    const { error } = await db.from('inquiries').delete().eq('id', id);
    if (error) databaseError(error);

    return json({ success: true, id });
  } catch (e) {
    return failure(e);
  }
}

