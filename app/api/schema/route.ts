import schema from "@/public/schema/opportunity-card.schema.json";

export const dynamic = "force-static";

export function GET() {
  return Response.json(schema, {
    headers: {
      "Content-Disposition": 'attachment; filename="opportunity-facts-card.schema.json"',
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
