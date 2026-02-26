import Link from "next/link";

export default function MatchNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Match not found
      </h1>
      <Link
        href="/"
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Back to library
      </Link>
    </div>
  );
}
