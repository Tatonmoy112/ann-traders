'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="center-page">
      <h1>We couldn’t load this page.</h1>
      <p>Check your connection and try again.</p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
