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
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h * 0.85, radius = Math.min(w * 0.42, h * 0.75);
  const start = Math.PI * 0.78, end = Math.PI * 2.22;
  ctx.clearRect(0, 0, w, h);

  ctx.beginPath(); ctx.arc(cx, cy, radius + 16, start, end);
  ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.lineWidth = 2; ctx.stroke();

  const ticks = 40;
  for (let i = 0; i <= ticks; i++) {
    const angle = start + (end - start) * (i / ticks);
    const major = i % 5 === 0;
    const active = i / ticks <= Math.min(value / 500, 1);
    const inner = radius - (major ? 16 : 8), outer = radius;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.strokeStyle = active ? "#ff5a1f" : (major ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.12)");
    ctx.lineWidth = major ? 2.5 : 1.2;
    ctx.shadowColor = active ? "#ff5a1f" : "transparent"; ctx.shadowBlur = active ? 6 : 0;
    ctx.stroke();
  }

  const safeValue = Math.min(value, 500);
  const needleAngle = start + (end - start) * (safeValue / 500);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(needleAngle);
  const grad = ctx.createLinearGradient(-14, 0, radius - 30, 0);
  grad.addColorStop(0, "#8b3018"); grad.addColorStop(1, "#ff6b2b");
  ctx.beginPath();
  ctx.moveTo(-12, 2); ctx.lineTo(radius - 28, 1); ctx.lineTo(radius - 20, 0); ctx.lineTo(radius - 28, -1); ctx.lineTo(-12, -2);
  ctx.closePath(); ctx.fillStyle = grad; ctx.shadowColor = "#ff5a1f"; ctx.shadowBlur = 8; ctx.fill();
  ctx.restore(); ctx.shadowBlur = 0;

  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fillStyle = "#080a0e"; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fillStyle = "#ff5a1f"; ctx.fill();
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
    const { response, elapsed } = await timedFetch(`https://speed.cloudflare.com/__down?bytes=${bytes}&t=${Date.now()}`);
    const blob = await response.blob();
    state.dataBytes += blob.size;
    const mbps = (blob.size * 8) / (elapsed / 1000) / 1_000_000;
    speeds.push(mbps); state.target = mbps;
    if (els.dlVal) els.dlVal.textContent = mbps.toFixed(1);
    if (els.dataUsed) els.dataUsed.textContent = (state.dataBytes / 1_000_000).toFixed(1);
  }
  const result = speeds.slice(-2).reduce((sum, n) => sum + n, 0) / Math.min(2, speeds.length);
  if (els.dlVal) els.dlVal.textContent = result.toFixed(1);
  state.target = result;
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
  for (let i = 0; i < 15; i++) {
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
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(domain)}`, {
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
      ip: data.ip,
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

/* Network Information API (optional, best-effort) */
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
if (connection && els.networkType) {
  const labels = { "slow-2g": "بسیار ضعیف", "2g": "2G", "3g": "3G", "4g": "4G / سریع" };
  els.networkType.textContent = labels[connection.effectiveType] || connection.effectiveType || "نامشخص";
}

/* ════════════════════════════════════════
   INIT
   ════════════════════════════════════════ */

updateConnection();
drawGauge(0);
animateGauge();
setLookupState("idle");
setTimeout(checkIp, 500);
setTimeout(checkDns, 900);
setTimeout(checkWebRtc, 1300);
