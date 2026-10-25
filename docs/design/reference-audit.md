# Reference UI audit

Inspected `reference admin panel/package.json`, `src/app/globals.css`, sidebar, shared table, and source file layout. The reference runs Next 16.2.9 / React 19.2.4, Tailwind 4, Lucide, Redux, Recharts and toast components. It contains unrelated HR, finance, procurement and permissions modules; these are not ANN Traders scope.

Observed tokens: primary #486AB8, text #13162a, background white, surface #f9fafb, border #e5e7eb, orange #F5A623. Typeface stack Outfit / Inter / Segoe UI, body 13px. Sidebar uses 47px parent rows, 41px children, rounded 13px active sections and icon tiles. Tables use compact rows, horizontally scrollable wrappers, uppercase headers, selection checkboxes, skeleton and empty states. Panels use rounded borders and restrained shadow. Recursive navigation expands active groups and supports a collapsed and mobile-open state.

Implementation will reuse this visual language, rather than copy reference API/auth code: its sidebar contains `any`, its table source has malformed comment markers, and its custom API/auth model is incompatible with required Supabase SSR/RLS. Use an original ANN monogram, local system typography, blue accents, compact accessible controls, responsive drawer, keyboard focus indicators, clear empty/configuration states and explicit errors. The customer reference is outside Phase 1.

No browser screenshot of the reference was available at audit time; observations above are from source, not a claim of visual runtime verification.
