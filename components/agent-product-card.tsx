"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { ProductDetailsToolInvocation } from "@/lib/agent";

interface AgentProductCardProps {
  invocation: ProductDetailsToolInvocation;
}

export function AgentProductCard({ invocation }: AgentProductCardProps) {
  if (
    invocation.state === "input-streaming" ||
    invocation.state === "input-available"
  ) {
    const productId = invocation.input?.productId;
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Looking up{productId ? ` "${productId}"` : ""}…
      </div>
    );
  }

  if (invocation.state !== "output-available") return null;

  // Shape returned by getProductDetails in lib/tools.ts.
  const output = invocation.output as
    | {
        id: string;
        name: string;
        slug: string;
        description: string;
        price: number;
        currency: string;
        category: string;
        images: string[];
        tags: string[];
        featured: boolean;
        stock: number;
        inStock: boolean;
        lowStock: boolean;
      }
    | { error: string }
    | undefined;

  if (!output) return null;

  if ("error" in output) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {output.error}
      </div>
    );
  }

  const image = output.images[0];

  const stockText = output.inStock === false
    ? "Out of stock"
    : output.lowStock
      ? `Only ${output.stock} left`
      : "In stock";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {image && (
        <div className="relative aspect-4/3 bg-secondary">
          <Image
            src={image}
            alt={output.name}
            fill
            sizes="(min-width: 768px) 480px, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-base font-semibold leading-tight">
            {output.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatPrice(output.price, output.currency)}
          </p>
        </div>
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {output.description}
        </p>
        <p className="text-sm font-medium">{stockText}</p>
        {output.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {output.tags.slice(0, 5).map((tag: string) => (
              <span
                key={tag}
                className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <Link
          href={`/products/${output.slug}`}
          className="inline-flex text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          View product →
        </Link>
      </div>
    </div>
  );
}
