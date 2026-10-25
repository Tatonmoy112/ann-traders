import { Database, ArrowRight, ShieldCheck } from 'lucide-react';
export function Setup() {
  return (
    <div className="setup">
      <div className="brand">
        <span className="monogram">
          A<span>n</span>
        </span>
        <div>
          ANN TRADERS<small>CATALOG WORKSPACE</small>
        </div>
      </div>
      <div className="setup-card">
        <span className="eyebrow">WORKSPACE SETUP</span>
        <h1>
          A strong foundation
          <br />
          for your catalog.
        </h1>
        <p>
          The admin application is ready to connect to your development Supabase project. Configure
          the connection to start managing products.
        </p>
        <div className="setup-step">
          <Database />
          <div>
            <strong>Connect your development database</strong>
            <p>
              Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in
              apps/admin/.env.local.
            </p>
          </div>
        </div>
        <div className="setup-step">
          <ShieldCheck />
          <div>
            <strong>Apply migrations and invite an administrator</strong>
            <p>
              Follow README.md to start local Supabase, load the schema, and create the first admin
              profile.
            </p>
          </div>
        </div>
        <div className="setup-footer">
          <ArrowRight size={16} /> See the project README for exact setup commands
        </div>
      </div>
      <small className="muted">
        Private administration · Bangladesh textile & industrial supply
      </small>
    </div>
  );
}
