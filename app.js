"use strict";

/* ════════════════════════════════════════
   WigaNet — app.js
   ════════════════════════════════════════ */

const $ = (selector) => document.querySelector(selector);

/* ─── Shared state ─── */
const state = { running: false, controller: null, value: 0, target: 0, dataBytes: 0 };
let currentHostData = null;

const els = {
  startBtn: $("#startBtn"), stopBtn: $("#stopBtn"), testStatus: $("#testStatus"),
  gaugeVal: $("#gaugeVal"), pingVal: $("#pingVal"), dlVal: $("#dlVal"), ulVal: $("#ulVal"),
  jitterVal: $("#jitterVal"), networkType: $("#networkType"), dataUsed: $("#dataUsed"),
  connectionPill: $("#connectionPill"), connText: $("#connText"),
  hostInput: $("#hostInput"), lookupButton: $("#lookupButton"), inputContainer: $("#inputContainer"),
  lookupLoading: $("#lookupLoading"), lookupResults: $("#lookupResults"), lookupError: $("#lookupError"),
};

/* ════════════════════════════════════════
   GAUGE / SPEED TEST
   ════════════════════════════════════════ */

const canvas = $("#gaugeCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

function drawGauge(value = 0) {
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h * .84;
  const radius = Math.min(w * .41, h * .73);
  const start = Math.PI * .78;
  const end = Math.PI * 2.22;
  const safeValue = Math.max(0, Math.min(value, 500));
  const progress = safeValue / 500;

  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";

  const halo = ctx.createRadialGradient(cx, cy, radius * .15, cx, cy, radius * 1.18);
  halo.addColorStop(0, "rgba(255,90,31,.075)");
  halo.addColorStop(.58, "rgba(255,90,31,.018)");
  halo.addColorStop(1, "rgba(255,90,31,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 19, start, end);
  ctx.strokeStyle = "rgba(255,255,255,.045)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 10, start, end);
  ctx.strokeStyle = "rgba(255,255,255,.075)";
  ctx.lineWidth = 5;
  ctx.stroke();

  if (progress > 0) {
    const arcGradient = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
    arcGradient.addColorStop(0, "#ff5a1f");
    arcGradient.addColorStop(.72, "#ff7134");
    arcGradient.addColorStop(1, "#ffb13b");
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10, start, start + (end - start) * progress);
    ctx.strokeStyle = arcGradient;
    ctx.lineWidth = 5;
    ctx.shadowColor = "rgba(255,90,31,.8)";
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const ticks = 48;
  for (let i = 0; i <= ticks; i++) {
    const ratio = i / ticks;
    const angle = start + (end - start) * ratio;
    const major = i % 8 === 0;
    const active = ratio <= progress;
    const inner = radius - (major ? 18 : 9);
    const outer = radius;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.strokeStyle = active
      ? (ratio > .8 ? "#ffb13b" : "#ff5a1f")
      : (major ? "rgba(255,255,255,.42)" : "rgba(255,255,255,.13)");
    ctx.lineWidth = major ? 2.6 : 1.1;
    ctx.shadowColor = active ? "#ff5a1f" : "transparent";
    ctx.shadowBlur = active ? 6 : 0;
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (major) {
      const labelRadius = radius - 34;
      const label = Math.round(500 * ratio);
      ctx.fillStyle = active ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.32)";
      ctx.font = "600 9px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx + Math.cos(angle) * labelRadius, cy + Math.sin(angle) * labelRadius);
    }
  }

  const needleAngle = start + (end - start) * progress;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(needleAngle);
  const needleGradient = ctx.createLinearGradient(-14, 0, radius - 28, 0);
  needleGradient.addColorStop(0, "#711f12");
  needleGradient.addColorStop(.65, "#ff5a1f");
  needleGradient.addColorStop(1, "#ffc09d");
  ctx.beginPath();
  ctx.moveTo(-14, 3.2);
  ctx.lineTo(radius - 30, 1.8);
  ctx.lineTo(radius - 18, 0);
  ctx.lineTo(radius - 30, -1.8);
  ctx.lineTo(-14, -3.2);
  ctx.closePath();
  ctx.fillStyle = needleGradient;
  ctx.shadowColor = "#ff5a1f";
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fillStyle = "#090c10";
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ff5a1f";
  ctx.shadowColor = "#ff5a1f";
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineCap = "butt";
}

function animateGauge() {
  state.value += (state.target - state.value) * .11;
  if (Math.abs(state.target - state.value) < .02) state.value = state.target;
  drawGauge(state.value);
  if (els.gaugeVal) els.gaugeVal.textContent = state.value < 10 ? state.value.toFixed(1) : state.value.toFixed(0);
  requestAnimationFrame(animateGauge);
}

async function timedFetch(url, options = {}) {
  const started = performance.now();
  const response = await fetch(url, { cache: "no-store", signal: state.controller.signal, ...options });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { response, elapsed: performance.now() - started };
}

async function testLatency() {
  if (els.testStatus) els.testStatus.textContent = "در حال اندازه‌گیری پینگ…";
  const samples = [];
  for (let i = 0; i < 6; i++) {
    const { elapsed } = await timedFetch(`https://speed.cloudflare.com/__down?bytes=0&t=${Date.now()}-${i}`);
    samples.push(elapsed);
    state.target = Math.min(Math.round(elapsed) * 2, 500);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const ping = sorted[Math.floor(sorted.length / 2)];
  const differences = samples.slice(1).map((sample, i) => Math.abs(sample - samples[i]));
  const jitter = differences.reduce((sum, n) => sum + n, 0) / differences.length;
  if (els.pingVal) els.pingVal.textContent = ping.toFixed(0);
  if (els.jitterVal) els.jitterVal.textContent = jitter.toFixed(1);
}

async function testDownload() {
  if (els.testStatus) els.testStatus.textContent = "در حال تست سرعت دانلود…";
  const sizes = [1_000_000, 4_000_000, 10_000_000];
  const speeds = [];
  for (const bytes of sizes) {
    const started = performance.now();
    const { response } = await timedFetch(`https://speed.cloudflare.com/__down?bytes=${bytes}&t=${Date.now()}`);
    const blob = await response.blob();
    const elapsed = performance.now() - started;
    state.dataBytes += blob.size;
    const mbps = (blob.size * 8) / (elapsed / 1000) / 1_000_000;
    speeds.push(mbps); state.target = mbps;
    if (els.dlVal) els.dlVal.textContent = mbps.toFixed(1);
    if (els.dataUsed) els.dataUsed.textContent = (state.dataBytes / 1_000_000).toFixed(1);
  }
  const result = speeds.slice(-2).reduce((sum, n) => sum + n, 0) / Math.min(2, speeds.length);
  if (els.dlVal) els.dlVal.textContent = result.toFixed(1);
  state.target = result;
  updateNetworkInfo(result);
}

async function testUpload() {
  if (els.testStatus) els.testStatus.textContent = "در حال تست سرعت آپلود…";
  const sizes = [250_000, 1_000_000, 2_000_000];
  const speeds = [];
  for (const bytes of sizes) {
    const payload = new Uint8Array(bytes);
    const { elapsed } = await timedFetch(`https://speed.cloudflare.com/__up?t=${Date.now()}`, { method: "POST", body: payload });
    state.dataBytes += bytes;
    const mbps = (bytes * 8) / (elapsed / 1000) / 1_000_000;
    speeds.push(mbps); state.target = mbps;
    if (els.ulVal) els.ulVal.textContent = mbps.toFixed(1);
    if (els.dataUsed) els.dataUsed.textContent = (state.dataBytes / 1_000_000).toFixed(1);
  }
  const result = speeds.slice(-2).reduce((sum, n) => sum + n, 0) / Math.min(2, speeds.length);
  if (els.ulVal) els.ulVal.textContent = result.toFixed(1);
  state.target = result;
}

async function runSpeedTest() {
  if (state.running || !navigator.onLine) return;
  state.running = true; state.dataBytes = 0; state.controller = new AbortController();
  if (els.startBtn) els.startBtn.hidden = true;
  if (els.stopBtn) els.stopBtn.hidden = false;
  try {
    await testLatency();
    await testDownload();
    await testUpload();
    if (els.testStatus) els.testStatus.textContent = "تست کامل شد ✅";
  } catch (error) {
    if (error.name === "AbortError") {
      if (els.testStatus) els.testStatus.textContent = "تست متوقف شد";
    } else {
      console.error(error);
      if (els.testStatus) els.testStatus.textContent = "ارتباط با سرور تست برقرار نشد";
    }
    state.target = 0;
  } finally {
    state.running = false;
    if (els.startBtn) els.startBtn.hidden = false;
    if (els.stopBtn) els.stopBtn.hidden = true;
  }
}

/* ════════════════════════════════════════
   PRIVACY CHECKS
   ════════════════════════════════════════ */

function setBadge(id, text, type) {
  const badge = $(id);
  if (!badge) return;
  badge.textContent = text;
  badge.className = `status-badge ${type}`;
}

async function checkIp() {
  setBadge("#ipBadge", "در حال دریافت", "checking");
  try {
    const response = await fetch("https://ipwho.is/", { cache: "no-store" });
    if (!response.ok) throw new Error("IP service failed");
    const data = await response.json();
    if (data.success === false) throw new Error(data.message);
    if ($("#ipAddress")) $("#ipAddress").textContent = data.ip || "—";
    if ($("#ipLocation")) $("#ipLocation").textContent = [data.city, data.country].filter(Boolean).join("، ") || "نامشخص";
    if ($("#ipIsp")) $("#ipIsp").textContent = data.connection?.isp || data.connection?.org || "نامشخص";
    if ($("#ipType")) $("#ipType").textContent = data.type === "IPv6" ? "IPv6" : "IPv4";
    setBadge("#ipBadge", "شناسایی شد", "safe");
    return data;
  } catch (error) {
    setBadge("#ipBadge", "خطا در دریافت", "error");
    if ($("#ipLocation")) $("#ipLocation").textContent = "سرویس در دسترس نیست";
    return null;
  }
}

function renderConsole(container, rows) {
  if (!container) return;
  container.innerHTML = rows.map(([value, label]) =>
    `<div class="console-row"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`
  ).join("");
}
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

async function checkDns() {
  setBadge("#dnsBadge", "در حال آزمایش", "checking");
  const box = $("#dnsConsole");
  if (box) box.textContent = "در حال ارسال درخواست‌های DNS…";
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < 5; i++) {
      await fetch(`https://${id}-${i}.test.nextdns.io/`, { mode: "no-cors", cache: "no-store" }).catch(() => {});
    }
    const response = await fetch("https://test.nextdns.io/", { cache: "no-store" });
    if (!response.ok) throw new Error("DNS service unavailable");
    const data = await response.json();
    if ($("#dnsProvider")) $("#dnsProvider").textContent = data.resolvers?.[0] || "نامشخص";
    if ($("#dnsStatus")) $("#dnsStatus").textContent = data.protocol || "نامشخص";
    renderConsole(box, [
      ...(data.resolvers || []).map(r => [r, "Resolver"]),
      [data.client || "—", "Client IP"],
      [data.protocol || "—", "Protocol"],
    ]);
    const encrypted = /^(DOH|DOT|DOQ)$/i.test(data.protocol || "");
    setBadge("#dnsBadge", encrypted ? "رمزنگاری‌شده" : "نیازمند بررسی", encrypted ? "safe" : "warning");
  } catch (error) {
    if (box) box.textContent = "بررسی محدود — از تنظیمات VPN مطمئن شوید";
    setBadge("#dnsBadge", "نتیجه محدود", "warning");
  }
}

async function checkWebRtc() {
  setBadge("#webrtcBadge", "در حال آزمایش", "checking");
  const box = $("#webrtcConsole");
  if (box) box.textContent = "در حال جمع‌آوری ICE candidates…";
  const addresses = new Set();
  try {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] });
    pc.createDataChannel("probe");
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidate = event.candidate.candidate;
      const matches = candidate.match(/(?:\d{1,3}\.){3}\d{1,3}|[a-f0-9:]{5,}/gi) || [];
      matches.forEach((address) => {
        if (!address.includes("typ") && !/^\d+$/.test(address)) addresses.add(address);
      });
    };
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise((resolve) => setTimeout(resolve, 3000));
    pc.close();
    const list = [...addresses];
    const pub = list.find(a => !isPrivateIp(a));
    const local = list.find(a => isPrivateIp(a));
    if ($("#webrtcPublicIp")) $("#webrtcPublicIp").textContent = pub || "شناسایی نشد";
    if ($("#webrtcLocalIp")) $("#webrtcLocalIp").textContent = local || "—";
    if (list.length) {
      renderConsole(box, list.map((address) => [address, isPrivateIp(address) ? "محلی" : "عمومی"]));
      setBadge("#webrtcBadge", pub ? "IP عمومی آشکار شد" : "محافظت‌شده", pub ? "warning" : "safe");
    } else {
      if (box) box.textContent = "هیچ IP ای آشکار نشد — محافظت‌شده";
      setBadge("#webrtcBadge", "محافظت‌شده", "safe");
    }
  } catch (error) {
    if (box) box.textContent = "WebRTC مسدود یا غیرفعال است";
    setBadge("#webrtcBadge", "غیرفعال", "safe");
  }
}

function isPrivateIp(ip) {
  return /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)
    || /^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip) || ip.endsWith(".local");
}

/* ════════════════════════════════════════
   CONNECTION STATUS
   ════════════════════════════════════════ */

function updateConnection() {
  const online = navigator.onLine;
  if (els.connectionPill) els.connectionPill.classList.toggle("connected", online);
  if (els.connText) els.connText.textContent = online ? "آنلاین" : "آفلاین";
}

/* ════════════════════════════════════════
   HOST LOOKUP  (fixed version)
   ════════════════════════════════════════ */

/**
 * Single source of truth for the UI state of the lookup panel.
 * Guarantees loading / results / error are never shown at the same time.
 */
function setLookupState(uiState) {
  if (els.lookupLoading) els.lookupLoading.hidden = true;
  if (els.lookupResults) els.lookupResults.hidden = true;
  if (els.lookupError) els.lookupError.hidden = true;
  if (els.lookupButton) {
    els.lookupButton.disabled = false;
    els.lookupButton.classList.remove("loading");
  }

  if (uiState === "loading") {
    if (els.lookupLoading) els.lookupLoading.hidden = false;
    if (els.lookupButton) {
      els.lookupButton.disabled = true;
      els.lookupButton.classList.add("loading");
    }
  } else if (uiState === "results") {
    if (els.lookupResults) els.lookupResults.hidden = false;
  } else if (uiState === "error") {
    if (els.lookupError) els.lookupError.hidden = false;
  }
  // uiState === "idle" -> everything stays hidden
}

function showLookupError(message) {
  const p = $("#errorMessage");
  if (p) p.textContent = message;
  setLookupState("error");
}

function cleanDomain(raw) {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .replace(/\?.*$/, "")
    .replace(/#.*$/, "")
    .toLowerCase();
}

function getCountryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "";
  try {
    const codePoints = countryCode.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return "";
  }
}

function showConfetti() {
  const container = $("#confettiContainer");
  if (!container) return;
  container.innerHTML = "";
  const colors = ["var(--orange)", "var(--green)", "#41a9e6", "#ffba45", "var(--orange-soft)"];
  for (let i = 0; i < 8; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    container.appendChild(piece);
  }
  setTimeout(() => { container.innerHTML = ""; }, 2500);
}

/**
 * Fire-and-forget SSL check. Never throws, never blocks the main lookup flow.
 * `no-cors` HEAD requests always resolve (opaque response) as long as DNS/TCP
 * succeeds, so this is a rough "is HTTPS reachable" signal only.
 */
async function checkSslBadge(domain) {
  const badge = $("#sslBadge");
  if (!badge) return;
  try {
    await fetch(`https://${domain}/favicon.ico`, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    badge.hidden = false;
  } catch {
    badge.hidden = true;
  }
}

async function resolveDomainToIp(domain) {
  const providers = [
    {
      url: `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      options: { headers: { Accept: "application/dns-json" } },
    },
    {
      url: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
      options: {},
    },
  ];

  for (const provider of providers) {
    try {
      const response = await fetch(provider.url, {
        ...provider.options,
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) continue;
      const data = await response.json();
      const record = data.Answer?.find((answer) => answer.type === 1 && /^\d{1,3}(\.\d{1,3}){3}$/.test(answer.data));
      if (record?.data) return record.data;
    } catch {
      // Try the next DNS-over-HTTPS provider.
    }
  }

  throw new Error("دامنه پیدا نشد یا سرویس DNS در دسترس نیست");
}

async function lookupHost() {
  const raw = els.hostInput.value;
  if (!raw || !raw.trim()) return; // nothing typed yet — do not show an error

  const domain = cleanDomain(raw);

  // Lenient validation: needs at least one dot and valid host characters
  const isValid = domain.length >= 4 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain);
  if (!isValid) {
    showLookupError("لطفاً یک دامنه معتبر وارد کنید (مثل: google.com)");
    return;
  }

  setLookupState("loading");
  const startTime = performance.now();

  try {
    const resolvedIp = await resolveDomainToIp(domain);
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(resolvedIp)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const responseTime = Math.round(performance.now() - startTime);

    if (!response.ok) throw new Error("سرویس در دسترس نیست، دوباره تلاش کنید");

    const data = await response.json();
    if (!data || data.success === false) {
      throw new Error(data?.message || "اطلاعاتی برای این دامنه پیدا نشد");
    }

    $("#resultDomain").textContent = domain;
    $("#hostFlag").textContent = getCountryFlag(data.country_code);
    $("#hostCountryName").textContent = data.country || "—";
    $("#hostCity").textContent = data.city || "—";
    $("#hostTimezone").textContent = data.timezone?.id || "—";
    $("#hostIp").querySelector(".ip-text").textContent = data.ip || "—";
    $("#hostIsp").textContent = data.connection?.isp || "—";
    $("#hostOrg").textContent = data.connection?.org || data.connection?.isp || "—";

    const ipType = data.type === "IPv6" ? "IPv6" : "IPv4";
    const ipTypeBadge = $("#hostIpType");
    ipTypeBadge.textContent = ipType;
    ipTypeBadge.style.background = ipType === "IPv6" ? "rgba(65,169,230,.15)" : "rgba(53,208,127,.15)";
    ipTypeBadge.style.color = ipType === "IPv6" ? "#41a9e6" : "var(--green)";
    ipTypeBadge.style.borderColor = ipType === "IPv6" ? "rgba(65,169,230,.3)" : "rgba(53,208,127,.3)";

    $("#hostCountryCode").textContent = data.country_code || "—";

    const latLngEl = $("#hostLatLng");
    if (data.latitude && data.longitude) {
      latLngEl.textContent = `${Number(data.latitude).toFixed(4)}, ${Number(data.longitude).toFixed(4)}`;
      latLngEl.dataset.lat = data.latitude;
      latLngEl.dataset.lng = data.longitude;
      latLngEl.style.cursor = "pointer";
      latLngEl.title = "کلیک برای مشاهده در نقشه";
    } else {
      latLngEl.textContent = "—";
      delete latLngEl.dataset.lat;
      delete latLngEl.dataset.lng;
      latLngEl.style.cursor = "default";
      latLngEl.title = "";
    }

    $("#responseTime").textContent = responseTime;

    currentHostData = {
      domain,
      country: data.country,
      city: data.city,
      ip: data.ip || resolvedIp,
      isp: data.connection?.isp,
    };

    setLookupState("results");
    showConfetti();
    checkSslBadge(domain); // non-blocking, runs after results are shown

    setTimeout(() => {
      els.lookupResults.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      showLookupError("زمان درخواست به پایان رسید. اتصال اینترنت خود را بررسی کنید.");
    } else {
      showLookupError(error.message || "خطا در دریافت اطلاعات. دوباره تلاش کنید.");
    }
  }
}

function resetLookup() {
  els.hostInput.value = "";
  if (els.inputContainer) els.inputContainer.style.borderColor = "";
  currentHostData = null;
  setLookupState("idle");
  els.hostInput.focus();
}

/* ════════════════════════════════════════
   EVENT LISTENERS
   ════════════════════════════════════════ */

if (els.startBtn) els.startBtn.addEventListener("click", runSpeedTest);
if (els.stopBtn) els.stopBtn.addEventListener("click", () => state.controller?.abort());
if ($("#refreshIpBtn")) $("#refreshIpBtn").addEventListener("click", checkIp);
if ($("#refreshDnsBtn")) $("#refreshDnsBtn").addEventListener("click", checkDns);
if ($("#refreshWebrtcBtn")) $("#refreshWebrtcBtn").addEventListener("click", checkWebRtc);

window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);
window.addEventListener("resize", () => drawGauge(state.value));

if (els.lookupButton) els.lookupButton.addEventListener("click", lookupHost);

if (els.hostInput) {
  els.hostInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookupHost();
    }
  });
  els.hostInput.addEventListener("input", function () {
    if (els.inputContainer) {
      els.inputContainer.style.borderColor = this.value ? "rgba(255,90,31,.5)" : "";
    }
    if (els.lookupError && !els.lookupError.hidden) setLookupState("idle");
  });
}

const newSearchButton = $("#newSearchButton");
if (newSearchButton) newSearchButton.addEventListener("click", resetLookup);

const retryButton = $("#retryButton");
if (retryButton) {
  retryButton.addEventListener("click", () => {
    setLookupState("idle");
    els.hostInput.focus();
  });
}

const hostIpEl = $("#hostIp");
if (hostIpEl) {
  hostIpEl.addEventListener("click", async function () {
    const ipText = this.querySelector(".ip-text");
    const copyIcon = this.querySelector(".copy-icon");
    const ip = ipText.textContent;
    if (ip === "—") return;
    try {
      await navigator.clipboard.writeText(ip);
      const original = ip;
      ipText.textContent = "کپی شد";
      copyIcon.textContent = "✅";
      this.style.color = "var(--green)";
      setTimeout(() => {
        ipText.textContent = original;
        copyIcon.textContent = "📋";
        this.style.color = "";
      }, 2000);
    } catch {
      copyIcon.textContent = "❌";
      setTimeout(() => { copyIcon.textContent = "📋"; }, 1500);
    }
  });
}

const hostLatLngEl = $("#hostLatLng");
if (hostLatLngEl) {
  hostLatLngEl.addEventListener("click", function () {
    if (this.dataset.lat && this.dataset.lng) {
      window.open(`https://www.google.com/maps?q=${this.dataset.lat},${this.dataset.lng}`, "_blank", "noopener");
    }
  });
}

const shareButton = $("#shareButton");
if (shareButton) {
  shareButton.addEventListener("click", async () => {
    if (!currentHostData) return;
    const shareText = `🌐 اطلاعات هاست ${currentHostData.domain}\n\n🏳️ کشور: ${currentHostData.country}\n🏙️ شهر: ${currentHostData.city}\n🔗 IP: ${currentHostData.ip}\n🏛️ ISP: ${currentHostData.isp}\n\nتوسط WigaNet`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `اطلاعات ${currentHostData.domain}`, text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        const original = shareButton.innerHTML;
        shareButton.innerHTML = "<span>✅</span>کپی شد";
        setTimeout(() => { shareButton.innerHTML = original; }, 2000);
      }
    } catch {
      /* user cancelled share sheet — ignore */
    }
  });
}

/* Smooth-scroll nav + active state */
document.querySelectorAll('nav a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelectorAll("nav a").forEach((a) => a.classList.remove("active"));
    this.classList.add("active");
  });
});

/* Network Information API is only an estimate and usually does not reveal Wi-Fi vs mobile. */
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

function updateNetworkInfo(measuredMbps = null) {
  if (!els.networkType) return;

  const typeLabels = {
    wifi: "Wi-Fi",
    cellular: "دیتای موبایل",
    ethernet: "کابل شبکه",
    bluetooth: "Bluetooth",
    wimax: "WiMAX",
    none: "بدون اتصال",
    unknown: "نامشخص",
  };

  if (connection?.type && typeLabels[connection.type]) {
    els.networkType.textContent = typeLabels[connection.type];
  } else if (Number.isFinite(measuredMbps)) {
    els.networkType.textContent = measuredMbps >= 50 ? "بسیار سریع" : measuredMbps >= 15 ? "سریع" : measuredMbps >= 5 ? "متوسط" : "ضعیف";
  } else if (Number.isFinite(connection?.downlink)) {
    els.networkType.textContent = `حدود ${connection.downlink} Mbps`;
  } else {
    els.networkType.textContent = "پس از تست مشخص می‌شود";
  }

  const details = [];
  if (connection?.effectiveType) details.push(`رده تخمینی مرورگر: ${connection.effectiveType}`);
  if (Number.isFinite(connection?.rtt)) details.push(`RTT تخمینی: ${connection.rtt} ms`);
  if (Number.isFinite(connection?.downlink)) details.push(`Downlink تخمینی: ${connection.downlink} Mbps`);
  els.networkType.title = details.join(" | ");
}

if (connection?.addEventListener) connection.addEventListener("change", () => updateNetworkInfo());

/* ════════════════════════════════════════
   INIT
   ════════════════════════════════════════ */

updateConnection();
updateNetworkInfo();
drawGauge(0);
animateGauge();
setLookupState("idle");
setTimeout(checkIp, 500);
setTimeout(checkDns, 900);
setTimeout(checkWebRtc, 1300);
