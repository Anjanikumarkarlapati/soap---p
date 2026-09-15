import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card max-w-md p-8 text-center">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="h1 mt-2">Page not found</h1>
        <p className="mt-2 text-sm text-muted">The page you’re looking for doesn’t exist or has moved.</p>
        <Link href="/" className="btn-primary mt-6">Go to dashboard</Link>
      </div>
    </div>
  );
}
