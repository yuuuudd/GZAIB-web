"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  PendingClaimReview,
  PendingCommunityReviews,
  PendingProfileReview,
  PendingUpdateReview,
} from "../../features/admin/communities";

type ReviewItem = PendingProfileReview | PendingClaimReview | PendingUpdateReview;

function timestamp(value: number): string {
  return new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function ReviewActions({ item }: { item: ReviewItem }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function review(decision: "approve" | "changes_requested" | "reject") {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/communities/${item.kind}/${encodeURIComponent(item.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(decision === "approve" ? { decision } : { decision, reason: reason.trim() }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "审核失败");
      setMessage(decision === "approve" ? "审核已通过。" : decision === "changes_requested" ? "已要求提交者修改。" : "已拒绝该记录。");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核失败");
    } finally {
      setPending(false);
    }
  }

  const reasonLength = [...reason.normalize("NFKC").trim()].length;
  const validReason = reasonLength >= 2 && reasonLength <= 300;
  return (
    <footer className="review-actions">
      <label>
        要求修改或拒绝时请说明原因
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={2}
          placeholder="2–300 字；该理由会保存到审核记录"
        />
      </label>
      <div>
        <button type="button" className="action-secondary action-orange" disabled={pending || !validReason} onClick={() => review("changes_requested")}>要求修改</button>
        <button type="button" className="action-secondary" disabled={pending || !validReason} onClick={() => review("reject")}>拒绝</button>
        <button type="button" className="action-primary" disabled={pending} onClick={() => review("approve")}>通过</button>
      </div>
      {message ? <p role="status" className="admin-action-message">{message}</p> : null}
    </footer>
  );
}

function Submitter({ item }: { item: ReviewItem }) {
  return <p>提交者：{item.submitter} <small>（{item.submitterEmail}）</small> · {timestamp(item.submittedAt)}</p>;
}

function ProfileCard({ item }: { item: PendingProfileReview }) {
  return (
    <article className="review-card">
      <header>
        <div><p className="admin-kicker">{item.submissionKind === "create" ? "新社群投稿" : "社群资料变更"}</p><h2>{item.title}</h2><Submitter item={item} /></div>
        <span className="status-pill status-pending">待审核</span>
      </header>
      <section className="review-sections">
        <div>
          <h3>字段差异</h3>
          <dl>{item.fields.map((change) => <div key={change.label}><dt>{change.label}</dt><dd><small>当前：</small>{change.previous ?? "尚未公开"}<br /><small>拟发布：</small>{change.proposed}</dd></div>)}</dl>
        </div>
        <div><h3>来源</h3><p>{item.sourceLabel}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源 ↗</a></div>
      </section>
      <ReviewActions item={item} />
    </article>
  );
}

function ClaimCard({ item }: { item: PendingClaimReview }) {
  return (
    <article className="review-card">
      <header><div><p className="admin-kicker">负责人认领</p><h2>{item.title}</h2><Submitter item={item} /></div><span className="status-pill status-pending">待审核</span></header>
      <section className="review-sections">
        <div><h3>认领证明（仅授权运营可见）</h3><p>{item.evidence}</p>{item.evidenceUrl ? <a href={item.evidenceUrl} target="_blank" rel="noreferrer">查看证明链接 ↗</a> : null}</div>
      </section>
      <ReviewActions item={item} />
    </article>
  );
}

function UpdateCard({ item }: { item: PendingUpdateReview }) {
  return (
    <article className="review-card">
      <header><div><p className="admin-kicker">社群动态 · {item.communityName}</p><h2>{item.title}</h2><Submitter item={item} /></div><span className="status-pill status-pending">待审核</span></header>
      <section className="review-sections">
        <div><h3>拟发布摘要</h3><p>{item.summary}</p><p>发生时间：{timestamp(item.occurredAt)}</p>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源 ↗</a> : <p>未附来源链接</p>}</div>
      </section>
      <ReviewActions item={item} />
    </article>
  );
}

export function CommunityReviewPanel({ reviews }: { reviews: PendingCommunityReviews }) {
  const count = reviews.profiles.length + reviews.claims.length + reviews.updates.length;
  if (!count) return <div className="admin-empty"><strong>暂时没有待审核社群记录</strong><p>新投稿、认领和动态会在这里进入运营队列。</p></div>;
  return (
    <div className="community-review-groups">
      <section aria-labelledby="profile-review-heading"><h2 id="profile-review-heading">资料投稿（{reviews.profiles.length}）</h2>{reviews.profiles.map((item) => <ProfileCard key={item.id} item={item} />)}</section>
      <section aria-labelledby="claim-review-heading"><h2 id="claim-review-heading">负责人认领（{reviews.claims.length}）</h2>{reviews.claims.map((item) => <ClaimCard key={item.id} item={item} />)}</section>
      <section aria-labelledby="update-review-heading"><h2 id="update-review-heading">社群动态（{reviews.updates.length}）</h2>{reviews.updates.map((item) => <UpdateCard key={item.id} item={item} />)}</section>
    </div>
  );
}
