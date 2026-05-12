import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-6">
      <div className="card-padded w-full text-center">
        <p className="label">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink-100">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-ink-300">
          That route doesn't exist (yet). Try the Command Center.
        </p>
        <Link href="/dashboard" className="btn-primary mt-4 inline-flex">
          Open Command Center
        </Link>
      </div>
    </main>
  );
}
