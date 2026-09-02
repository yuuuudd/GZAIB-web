export const DEFAULT_AVATARS = [
  { id: "yellow", src: "/brand/avatar-yellow.png", label: "黄色小伙伴" },
  { id: "cow", src: "/brand/avatar-cow.png", label: "橙色小牛" },
  { id: "cat", src: "/brand/avatar-cat.png", label: "小猫" },
  { id: "kangaroo", src: "/brand/avatar-kangaroo.png", label: "黄色袋鼠" },
] as const;

export function nicknameInitial(nickname: string): string {
  return Array.from(nickname.trim())[0] ?? "你";
}

export function createNicknameAvatar(nickname: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("昵称头像暂时不可用，请选择其他头像。"));
  context.fillStyle = "#e7efff";
  context.fillRect(0, 0, 256, 256);
  context.fillStyle = "#1e4ed8";
  context.font = "700 112px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(nicknameInitial(nickname), 128, 136);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("昵称头像暂时不可用，请选择其他头像。")), "image/png"));
}
