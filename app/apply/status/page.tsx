"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandHomeLink } from "../../../components/navigation/BrandHomeLink";
import { PrimaryNavigation } from "../../../components/navigation/PrimaryNavigation";

type Application = { status: string; submittedAt?: number; updatedAt?: number; reviewReason?: string };

const statusCopy: Record<string, { title: string; detail: string }> = {
  draft: { title: "资料尚未提交", detail: "补全资料并提交后，运营团队才会开始审核。" },
  pending: { title: "正在审核中", detail: "运营团队会核对学校信息与公开设置；审核通过后才会点亮到地图。" },
  changes_requested: { title: "需要补充或修改", detail: "请根据运营反馈修改资料后重新提交。" },
  approved: { title: "审核已通过", detail: "你的基础名片已经点亮，完善资料可以让更多同行更容易找到你。" },
  rejected: { title: "本次申请未通过", detail: "如有疑问，可根据运营反馈完善资料后再联系团队。" },
  withdrawn: { title: "申请已撤回", detail: "你可以在准备好后重新发起新的申请。" },
};

export default function ApplicationStatusPage() {
  const [application, setApplication] = useState<Application | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/applications").then(async (response) => {
      const data = await response.json() as { application?: Application | null; error?: string };
      if (!response.ok) throw new Error(data.error ?? "暂时无法读取申请状态。");
      setApplication(data.application ?? null);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "暂时无法读取申请状态。"));
  }, []);

  const shell = (content: React.ReactNode) => <main className="brand-shell"><header className="brand-header"><BrandHomeLink /><PrimaryNavigation /><Link className="brand-header-action" href="/apply">编辑申请资料</Link></header><div className="application-shell">{content}</div></main>;
  if (error) return shell(<section className="status-card"><p className="section-kicker">申请状态</p><h1>暂时无法读取申请</h1><p>{error}</p><Link className="brand-primary-action" href="/apply">返回申请页</Link></section>);
  if (application === undefined) return shell(<section className="status-card"><p>正在读取申请状态…</p></section>);
  if (application === null) return shell(<section className="status-card"><p className="section-kicker">申请状态</p><h1>还没有提交申请</h1><p>填写你的公开资料与隐私设置，提交后可在这里查看审核进度。</p><Link className="brand-primary-action" href="/apply">去申请点亮</Link></section>);
  const copy = statusCopy[application.status] ?? { title: "申请状态更新中", detail: "请稍后再试。" };
  return shell(<section className="status-card"><p className="section-kicker">申请状态 / {application.status}</p><h1>{copy.title}</h1><p>{copy.detail}</p>{application.submittedAt ? <p className="status-time">提交时间：{new Date(application.submittedAt).toLocaleString("zh-CN")}</p> : null}{application.reviewReason ? <p className="review-reason">运营反馈：{application.reviewReason}</p> : null}{application.status === "approved" ? <div className="status-actions"><Link className="brand-primary-action" href="/me">完善我的资料 →</Link><Link className="brand-secondary-action" href="/#map">返回地图</Link></div> : <Link className="brand-secondary-action" href="/apply">返回申请资料</Link>}</section>);
}
