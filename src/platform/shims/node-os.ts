/** بديل مصغّر لـ node:os لبيئة المتصفح/الجوال. */
export function tmpdir(): string {
  return "/tmp";
}
export function homedir(): string {
  return "/app";
}
export function hostname(): string {
  return "mobile";
}
export function release(): string {
  return typeof navigator !== "undefined" ? navigator.userAgent : "";
}
export function totalmem(): number {
  return 0;
}
export function freemem(): number {
  return 0;
}
export function cpus(): unknown[] {
  return [];
}
export function userInfo(): { username: string } {
  return { username: "user" };
}
const os = { tmpdir, homedir, hostname, release, totalmem, freemem, cpus, userInfo };
export default os;
