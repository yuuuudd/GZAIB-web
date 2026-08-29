"use client";
import { useState } from "react";
export function UnblockList({ initialItems }: { initialItems: { blockedId: string; displayName: string }[] }) {
  const [items, setItems] = useState(initialItems); const [error, setError] = useState("");
  async function unblock(blockedId: string) { setError(""); const response = await fetch("/api/me/blocks", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ blockedId }) }); if (!response.ok) { setError("暂时无法解除拉黑。"); return; } setItems((current) => current.filter((item) => item.blockedId !== blockedId)); }
  return <>{error ? <p role="alert">{error}</p> : null}{items.length ? <ul>{items.map((item) => <li key={item.blockedId}><span>{item.displayName}</span><button type="button" onClick={() => void unblock(item.blockedId)}>解除拉黑</button></li>)}</ul> : <p>没有已拉黑的成员。</p>}</>;
}
