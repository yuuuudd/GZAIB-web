import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { dailyMetrics } from "../../../db/schema";
import { createMetricsService, type MetricsRepository } from "../../../features/directory/service";

function metricsRepository(): MetricsRepository {
  const db = getDb();
  return {
    async increment(counter) {
      const [row] = await db.insert(dailyMetrics).values({ ...counter, count: 1 })
        .onConflictDoUpdate({
          target: [dailyMetrics.metricDate, dailyMetrics.eventType, dailyMetrics.dimensionKey],
          set: { count: sql`${dailyMetrics.count} + 1`, updatedAt: counter.updatedAt },
        })
        .returning({ count: dailyMetrics.count });
      if (!row) throw new Error("Metric counter was not returned");
      return row.count;
    },
  };
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "统计事件格式不正确" }, { status: 400 });
  }
  try {
    const count = await createMetricsService(metricsRepository()).record(payload, Date.now());
    return Response.json({ count }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid aggregate metric") {
      return Response.json({ error: "仅支持匿名聚合统计" }, { status: 400 });
    }
    console.error("Unable to record aggregate metric", error);
    return Response.json({ error: "暂时无法记录统计事件" }, { status: 503 });
  }
}
