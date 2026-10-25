import { AuthForm } from '@/components/auth-form';
import { Setup } from '@/components/setup';
import { isConfigured } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export default function Login() {
  return isConfigured() ? <AuthForm /> : <Setup />;
}
