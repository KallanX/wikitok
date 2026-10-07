const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export function isIpv4(ip: string): boolean {
  return IPV4.test(ip);
}

export function expandIpv6(input: string): number[] | null {
  let ip = input;
  let mapped: string | null = null;
  const lastColon = ip.lastIndexOf(":");
  if (lastColon !== -1) {
    const tail = ip.slice(lastColon + 1);
    if (tail.includes(".")) {
      if (!isIpv4(tail)) return null;
      mapped = tail;
      ip = `${ip.slice(0, lastColon + 1)}0:0`;
    }
  }
  if (!ip.includes(":")) return null;

  const halves = ip.split("::");
  if (halves.length > 2) return null;

  const parseSide = (side: string): number[] | null => {
    if (side === "") return [];
    const nums: number[] = [];
    for (const part of side.split(":")) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return null;
      nums.push(Number.parseInt(part, 16));
    }
    return nums;
  };

  const left = parseSide(halves[0]);
  if (!left) return null;
  let parts: number[];
  if (halves.length === 1) {
    if (left.length !== 8) return null;
    parts = left;
  } else {
    const right = parseSide(halves[1]);
    if (!right || left.length + right.length > 8) return null;
    parts = [
      ...left,
      ...new Array(8 - left.length - right.length).fill(0),
      ...right,
    ];
  }

  if (mapped) {
    const [a, b, c, d] = mapped.split(".").map(Number);
    parts[6] = (a << 8) | b;
    parts[7] = (c << 8) | d;
  }
  return parts;
}

export function normalizeIp(raw: string): string {
  let ip = raw.trim();
  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
  }
  const zone = ip.indexOf("%");
  if (zone !== -1) ip = ip.slice(0, zone);
  const lower = ip.toLowerCase();
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice("::ffff:".length);
    if (isIpv4(mapped)) return mapped;
  }
  return lower;
}

export function isValidIp(ip: string): boolean {
  const normalized = normalizeIp(ip);
  return isIpv4(normalized) || expandIpv6(normalized) !== null;
}

export function isLoopback(ip: string): boolean {
  const normalized = normalizeIp(ip);
  if (isIpv4(normalized)) return normalized.startsWith("127.");
  const parts = expandIpv6(normalized);
  if (!parts) return false;
  return parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1;
}

export function isLinkLocal(ip: string): boolean {
  const normalized = normalizeIp(ip);
  if (isIpv4(normalized)) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 169 && b === 254;
  }
  const parts = expandIpv6(normalized);
  if (!parts) return false;
  return parts[0] >= 0xfe80 && parts[0] <= 0xfebf;
}

export function isUniqueLocal(ip: string): boolean {
  const normalized = normalizeIp(ip);
  if (isIpv4(normalized)) {
    const [a, b] = normalized.split(".").map(Number);
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }
  const parts = expandIpv6(normalized);
  if (!parts) return false;
  return parts[0] >= 0xfc00 && parts[0] <= 0xfdff;
}

export function ipv4InCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  if (!range || !isIpv4(ip) || !isIpv4(range)) return false;
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const toInt = (value: string) =>
    value.split(".").reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (toInt(ip) & mask) === (toInt(range) & mask);
}

export function peerIsTrusted(peer: string, trustProxy: string): boolean {
  const normalized = normalizeIp(peer);
  if (!isValidIp(normalized)) return false;
  const rules = trustProxy
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);

  for (const rule of rules) {
    if (rule === "loopback" && isLoopback(normalized)) return true;
    if (rule === "linklocal" && isLinkLocal(normalized)) return true;
    if (rule === "uniquelocal" && isUniqueLocal(normalized)) return true;
    if (rule.includes("/") && ipv4InCidr(normalized, rule)) return true;
    if (!rule.includes("/") && normalizeIp(rule) === normalized) return true;
  }
  return false;
}

export function resolveClientIp(options: {
  peer?: string | null;
  forwardedFor?: string | null;
  realIp?: string | null;
  trustProxy: string;
}): string {
  const peer = options.peer ? normalizeIp(options.peer) : "";
  const peerValid = Boolean(peer) && isValidIp(peer);
  if (!peerValid || !peerIsTrusted(peer, options.trustProxy)) {
    return peerValid ? peer : "unknown";
  }

  const forwarded = (options.forwardedFor ?? "")
    .split(",")
    .map((part) => normalizeIp(part))
    .filter((part) => part.length > 0 && isValidIp(part));

  const hops = [...forwarded, peer];
  for (let index = hops.length - 1; index >= 0; index -= 1) {
    if (!peerIsTrusted(hops[index], options.trustProxy)) return hops[index];
  }

  const real = options.realIp ? normalizeIp(options.realIp) : "";
  if (real && isValidIp(real) && !peerIsTrusted(real, options.trustProxy)) return real;
  return forwarded[0] ?? peer;
}
