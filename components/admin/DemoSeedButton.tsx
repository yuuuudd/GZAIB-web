"use client";

import { useState } from "react";

export function DemoSeedButton() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function initialize() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/demo-seed", { method: "POST" });
      const body = await response.json() as { initialized?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error ?? "初始化失败");
      setMessage("演示数据已就绪；重复初始化不会新增重复记录。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "初始化失败");
    } finally {
      setPending(false);
    }
  }
  return <div className="admin-seed-action"><button type="button" onClick={initialize} disabled={pending}>{pending ? "正在初始化…" : "初始化演示数据"}</button>{message ? <p role="status">{message}</p> : null}</div>;
}
