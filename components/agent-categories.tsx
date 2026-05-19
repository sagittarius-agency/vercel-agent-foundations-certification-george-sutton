"use client";

import Link from "next/link";
import type { CategoriesToolInvocation } from "@/lib/agent";

interface AgentCategoriesProps {
  invocation: CategoriesToolInvocation;
}

export function AgentCategories({ invocation }: AgentCategoriesProps) {
  if (
    invocation.state === "input-streaming" ||
    invocation.state === "input-available"
  ) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Loading categories…
      </div>
    );
  }

  if (invocation.state !== "output-available") return null;

  const output = invocation.output;

  if (!output) return null;

  if ("error" in output) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {output.error as string}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <p className="text-sm font-medium">Browse by category</p>
      <div className="flex flex-wrap gap-2">
        {output.categories.map(cat => (
          <Link
            key={cat.slug}
            href={`/search?category=${cat.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-sm hover:bg-secondary/70 transition-colors"
          >
            {cat.name}
            <span className="text-xs text-muted-foreground">
              {cat.productCount}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
