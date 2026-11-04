import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-6xl font-bold tracking-tight text-primary">404</h1>
      <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">Page Not Found</h2>
      <p className="mt-2 max-w-md text-sm text-on-surface-variant">
        The tool or page you are looking for does not exist or has been moved.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to Home</Link>
      </Button>
    </div>
  );
}
