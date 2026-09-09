"use client";

import { useState } from "react";

const emblems: Record<string, string> = {
  中山大学: "sysu.png",
  华南理工大学: "scut.png",
  哈尔滨工业大学: "hit.png",
  韩山师范学院: "hanshan.png",
  岭南师范学院: "lingnan.jpg",
  南方科技大学: "sustech.png",
  上海交通大学: "sjtu.png",
  武汉大学: "whu.png",
};

export function SchoolEmblem({ name, className }: { name: string; className: string }) {
  const schoolName = name.normalize("NFKC").trim().replace(/\([^()]*(?:校区|校园|本部)[^()]*\)$/, "").trim();
  const file = Object.hasOwn(emblems, schoolName) ? emblems[schoolName] : undefined;
  const src = file ? `/school-emblems/${file}` : `/api/school-emblem?name=${encodeURIComponent(name)}`;
  const [failedSrc, setFailedSrc] = useState<string>();
  const visible = src !== failedSrc;
  return <span className={`${className}${visible ? " school-emblem" : ""}`} aria-hidden="true">
    {visible ? <img src={src} alt="" width={40} height={40} loading="lazy" decoding="async" referrerPolicy="no-referrer" style={file === "whu.png" ? { objectFit: "cover" } : undefined} onError={() => setFailedSrc(src)} /> : Array.from(name.trim())[0] ?? "校"}
  </span>;
}
