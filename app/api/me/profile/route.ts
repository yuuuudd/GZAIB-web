import { getDb } from "../../../../db";
import { memberProfiles } from "../../../../db/schema";
import { createRuntimeProfileAccessService } from "../../../../features/directory/profile-access";
import { updateOwnProfile } from "../../../../features/directory/profile-update";
import { requireActiveSession } from "../../../../features/identity/active-account";
import { loadProfileVisibility } from "../../../../lib/db/repositories/directory";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  let userId: string;
  try { userId = (await requireActiveSession(request)).identity.id; }
  catch { return Response.json({ error: "请先登录有效账号" }, { status: 401 }); }
  try {
    const db = getDb();
    const profile = await (await createRuntimeProfileAccessService()).getOwnProfile(userId);
    if (!profile) return Response.json({ profile: null }, { headers: { "Cache-Control": "private, no-store" } });
    const [row] = await db.select({ id: memberProfiles.id, publishStatus: memberProfiles.publishStatus })
      .from(memberProfiles).where(eq(memberProfiles.userId, userId));
    const visibility = row ? await loadProfileVisibility(db, row.id) : {};
    return Response.json({ profile, visibility, published: row?.publishStatus === "published" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Unable to load own profile", error);
    return Response.json({ error: "暂时无法读取成员资料" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let userId: string;
  try { userId = (await requireActiveSession(request)).identity.id; }
  catch { return Response.json({ error: "请先登录有效账号" }, { status: 401 }); }
  let patch: unknown;
  try { patch = await request.json(); }
  catch { return Response.json({ error: "资料格式不正确" }, { status: 400 }); }
  try {
    await updateOwnProfile(userId, patch, Date.now());
    return Response.json({ updated: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "暂时无法更新成员资料" }, { status: 400 });
  }
}
