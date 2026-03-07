import Link from "next/link";
import { ArrowLeftIcon, WarningIcon } from "@phosphor-icons/react/ssr";

export default function MatchNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <WarningIcon
        className="h-12 w-12 text-text-soft"
        aria-hidden
      />
      <h1 className="text-xl font-semibold text-text-main">
        Match not found
      </h1>
      <Link
        href="/"
        className="flex items-center gap-2 text-sm font-medium text-text-soft hover:text-text-main"
      >
        <ArrowLeftIcon className="h-4 w-4 shrink-0" aria-hidden />
        Back to library
      </Link>
    </div>
  );
}
