export type ConnectionView = {
  request: { id: string; topic: string; message: string; status: string; createdAt: number; updatedAt: number; resolvedAt?: number };
  unlockedContactCard?: { wechat?: string; email?: string; otherLabel?: string; otherValue?: string };
};

export function ConnectionCard({ item, box, busy, onAction }: { item: ConnectionView; box: "received" | "sent" | "accepted"; busy?: boolean; onAction(action: "accept" | "decline" | "withdraw"): void }) {
  const date = new Date(item.request.createdAt).toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  return <article className="connection-card"><header><div><p className="section-kicker">{box === "received" ? "收到的请求" : box === "sent" ? "发出的请求" : "已连接"}</p><h2>{item.request.topic}</h2></div><time dateTime={new Date(item.request.createdAt).toISOString()}>{date}</time></header><p className="connection-message">{item.request.message}</p>
    {box === "received" && item.request.status === "pending" ? <div className="connection-card-actions"><button type="button" disabled={busy} onClick={() => onAction("decline")}>婉拒</button><button type="button" disabled={busy} onClick={() => onAction("accept")}>接受连接</button></div> : null}
    {box === "sent" && item.request.status === "pending" ? <div className="connection-card-actions"><button type="button" disabled={busy} onClick={() => onAction("withdraw")}>撤回请求</button></div> : null}
    {box === "accepted" ? <section className="connection-contact-card" aria-label="已授权的当前联系方式"><h3>对方当前联系方式</h3>{item.unlockedContactCard ? <dl>{item.unlockedContactCard.wechat ? <><dt>微信</dt><dd>{item.unlockedContactCard.wechat}</dd></> : null}{item.unlockedContactCard.email ? <><dt>邮箱</dt><dd>{item.unlockedContactCard.email}</dd></> : null}{item.unlockedContactCard.otherValue ? <><dt>{item.unlockedContactCard.otherLabel ?? "其他"}</dt><dd>{item.unlockedContactCard.otherValue}</dd></> : null}</dl> : <p>对方暂未设置可交换的联系方式。</p>}</section> : null}
  </article>;
}
