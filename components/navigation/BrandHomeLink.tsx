import Image from "next/image";
import Link from "next/link";

export function BrandHomeLink() {
  return <Link className="brand-mark" href="/" aria-label="广州AI共创社首页">
    <Image src="/brand/gzaib-horizontal.png" alt="广州 AI 共创社 GZAIB" width={276} height={106} priority unoptimized />
  </Link>;
}
