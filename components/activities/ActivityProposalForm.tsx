"use client";

import { useState, type FormEvent } from "react";

export function ActivityProposalForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/activity-proposals", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: text("title"), summary: text("summary"), stage: text("stage"),
          timeNote: text("timeNote"), location: text("location"), supportNeeded: text("supportNeeded"),
          links: text("links").split(/\n/).map((item) => item.trim()).filter(Boolean),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "暂时无法提交活动申请");
      setMessage("申请已提交，运营团队会通过你的账号邮箱联系你。");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "暂时无法提交活动申请");
    } finally { setPending(false); }
  }

  return <form className="activity-proposal-form" onSubmit={submit}>
    <header><p className="section-kicker">独立申请入口</p><h1>申请共建活动</h1><p>先说清楚你想做什么，时间和地点可以以后再定。</p></header>
    <section>
      <label>活动主题 / 暂定名称<input name="title" required minLength={2} maxLength={100} /></label>
      <label>活动简介<textarea name="summary" required minLength={10} maxLength={500} placeholder="想和谁一起，围绕什么主题，做成什么样？" /></label>
      <label>当前阶段<select name="stage" required defaultValue="idea"><option value="idea">只有想法，想找人一起梳理</option><option value="preparing">正在筹备，需要伙伴或资源</option><option value="scheduled">已有大致时间或场地</option></select></label>
      <p className="activity-contact-note">账号邮箱作为默认联系方式，仅运营团队可见。</p>
    </section>
    <details><summary>补充信息（全部选填）</summary><div>
      <label>大致时间<input name="timeNote" maxLength={120} placeholder="例如：九月下旬周末" /></label>
      <label>地点 / 形式<input name="location" maxLength={120} placeholder="例如：广州大学城，线下" /></label>
      <label>希望获得的支持<textarea name="supportNeeded" maxLength={500} placeholder="场地、嘉宾、技术导师、宣传……" /></label>
      <label>相关链接（每行一个 HTTPS 链接，最多 3 条）<textarea name="links" placeholder="https://" /></label>
    </div></details>
    <button className="application-submit" type="submit" disabled={pending}>{pending ? "正在提交…" : "提交活动共建申请 →"}</button>
    {message ? <p role="status" className="profile-editor-message">{message}</p> : null}
  </form>;
}
