import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="center-page">
      <h1>Page not found</h1>
      <p>The page may have moved or is no longer available.</p>
      <Link className="btn btn-primary" href="/dashboard">
        Back to workspace
      </Link>
    </div>
  );
}
