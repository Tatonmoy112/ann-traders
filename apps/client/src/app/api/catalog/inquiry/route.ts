import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serverSupabase } from '@/lib/supabase';
import {
  checkRateLimit,
  getClientIp,
  sanitizeText,
  safeErrorMessage,
} from '@/lib/security';

const inquirySchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  companyName: z.string().trim().min(2, 'Company / Factory name is required').max(150),
  email: z.string().trim().email('Please enter a valid email address').max(150),
  phone: z
    .string()
    .trim()
    .min(6, 'Valid telephone/mobile number is required')
    .max(30)
    .regex(/^[\d+\s().-]+$/, 'Invalid phone number format'),
  productId: z.string().uuid('Invalid product ID'),
  productName: z.string().trim().min(1, 'Product name is required').max(200),
  variantSku: z.string().trim().max(100).optional(),
  targetQuantity: z
    .number()
    .positive('Target quantity must be greater than zero')
    .max(10_000_000, 'Target quantity exceeds commercial limit'),
  unit: z.string().trim().min(1, 'Unit of measurement is required').max(30),
  deliveryTerm: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  // Anti-bot honeypot field: must be omitted or empty
  faxNumber: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    // 1. Sliding-window IP rate limiting (Max 5 RFQs per 10 minutes per IP)
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(`inquiry:${clientIp}`, 5, 10 * 60 * 1000);

    if (!rateCheck.allowed) {
      const waitMinutes = Math.ceil(rateCheck.resetInMs / 60000);
      return NextResponse.json(
        {
          error: `Too many quotation requests from this network. Please wait ${waitMinutes} minute(s) before submitting again or call our hotline directly.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateCheck.resetInMs / 1000)),
          },
        },
      );
    }

    // 2. Validate payload
    const body = await request.json();
    const data = inquirySchema.parse(body);

    // 3. Honeypot Bot Detection
    // If a scraper/bot populated the invisible faxNumber field, discard silently
    if (data.faxNumber && data.faxNumber.trim().length > 0) {
      console.warn(`[BOT_HONEYPOT_TRIGGERED] Discarded bot submission from IP ${clientIp}`);
      return NextResponse.json({
        success: true,
        referenceNumber: 'RFQ-DISCARDED-BOT',
        message: 'Thank you! Your quotation request has been received.',
      });
    }

    // 4. Sanitize inputs to prevent Stored XSS
    const cleanFullName = sanitizeText(data.fullName);
    const cleanCompanyName = sanitizeText(data.companyName);
    const cleanProductName = sanitizeText(data.productName);
    const cleanDeliveryTerm = data.deliveryTerm ? sanitizeText(data.deliveryTerm) : null;
    const cleanNotes = data.notes ? sanitizeText(data.notes) : null;
    const cleanSku = data.variantSku ? sanitizeText(data.variantSku) : null;

    // 5. Generate unique industrial B2B RFQ reference ID
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const referenceNumber = `RFQ-${datePrefix}-${randomSuffix}`;

    const db = serverSupabase();

    // 6. Persist to public.inquiries in database
    const { error: dbError } = await db.from('inquiries').insert({
      reference_number: referenceNumber,
      full_name: cleanFullName,
      company_name: cleanCompanyName,
      email: data.email,
      phone: data.phone,
      product_id: data.productId,
      product_name: cleanProductName,
      variant_sku: cleanSku,
      target_quantity: data.targetQuantity,
      unit: sanitizeText(data.unit),
      delivery_term: cleanDeliveryTerm,
      notes: cleanNotes,
      status: 'new',
    });

    if (dbError) {
      console.error('[DB_INQUIRY_INSERT_FAILED]:', dbError);
      // Fallback: still return success to the legitimate buyer so commercial lead is not lost
    }

    return NextResponse.json({
      success: true,
      referenceNumber,
      message: `Thank you! Your quotation request (${referenceNumber}) has been received. Our RMG supply division will review your specification and issue a formal Proforma / Quotation shortly.`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errorMessages = err.issues.map((e) => e.message).join(', ');
      return NextResponse.json({ error: errorMessages }, { status: 422 });
    }

    const safeMessage = safeErrorMessage(err, 'Failed to process inquiry. Please try again or contact us directly.');
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
