"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { SearchProductsToolInvocation } from "@/lib/agent";

interface AgentSearchResultsProps {
  invocation: SearchProductsToolInvocation;
}

export function AgentSearchResults({ invocation }: AgentSearchResultsProps) {
  if (
    invocation.state === "input-streaming" ||
    invocation.state === "input-available"
  ) {
    const query = invocation.input?.query;
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Searching{query ? ` for "${query}"` : ""}…
      </div>
    );
  }

  if (invocation.state !== "output-available") return null;

  const output = invocation.output;

  if (!output) return null;

  if ("error" in output && output.error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {output.error as string}
      </div>
    );
  }

  if (output.count === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        No products found.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{output.count} result{output.count !== 1 ? "s" : ""}</p>
      <div className="grid grid-cols-2 gap-2">
        {output.products.map(product => (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            className="group rounded-lg border border-border bg-card p-3 space-y-1 hover:border-foreground/30 transition-colors"
          >
            <p className="text-xs text-muted-foreground capitalize">
              {product.category}
            </p>
            <p className="text-sm font-medium leading-tight line-clamp-2 group-hover:underline underline-offset-2">
              {product.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatPrice(product.price, product.currency)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
