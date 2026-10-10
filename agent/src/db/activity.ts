import type { Env } from "../env";

export async function logActivity(
  env: Env,
  eventType: string,
  actor: string,
  entityType: string | null = null,
  entityId: string | null = null,
  details: Record<string, unknown> = {},
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO activity_log (id, event_type, actor, entity_type, entity_id, details_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), eventType, actor, entityType, entityId, JSON.stringify(details))
    .run();
}
