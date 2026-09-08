const PROVINCE_BY_ADCODE_PREFIX: Record<string, string> = {
  "11": "北京", "12": "天津", "13": "河北", "14": "山西", "15": "内蒙古",
  "21": "辽宁", "22": "吉林", "23": "黑龙江", "31": "上海", "32": "江苏",
  "33": "浙江", "34": "安徽", "35": "福建", "36": "江西", "37": "山东",
  "41": "河南", "42": "湖北", "43": "湖南", "44": "广东", "45": "广西",
  "46": "海南", "50": "重庆", "51": "四川", "52": "贵州", "53": "云南",
  "54": "西藏", "61": "陕西", "62": "甘肃", "63": "青海", "64": "宁夏",
  "65": "新疆", "71": "台湾", "81": "香港", "82": "澳门",
};
const KNOWN_PROVINCES = new Set(Object.values(PROVINCE_BY_ADCODE_PREFIX));

export function normalizeProvince(value: string): string {
  return value.normalize("NFKC").trim().replace(/(?:壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市)$/u, "");
}

export function provinceFromAdcode(adcode: unknown): string | undefined {
  return PROVINCE_BY_ADCODE_PREFIX[String(adcode ?? "").slice(0, 2)];
}

export function isKnownProvince(value: string): boolean {
  return KNOWN_PROVINCES.has(normalizeProvince(value));
}
