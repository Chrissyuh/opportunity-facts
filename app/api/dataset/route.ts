import dataset from "@/public/data/opportunities.json";
import { parsePublicDataset } from "@/lib/opportunity/artifacts";

export const dynamic = "force-static";

export function GET() {
  return Response.json(parsePublicDataset(dataset), {
    headers: {
      "Content-Disposition": 'attachment; filename="opportunity-facts-dataset.json"',
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
