import Link from 'next/link';
export default function Unauthorized() {
  return (
    <div className="center-page">
      <h1>Access restricted</h1>
      <p>An active administrator account is required. Contact your workspace administrator.</p>
      <Link href="/login" className="btn btn-primary">
        Return to sign in
      </Link>
    </div>
  );
}
