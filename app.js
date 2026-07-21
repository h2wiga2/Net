"use strict";

const $ = (selector) => document.querySelector(selector);
const canvas = $("#gaugeCanvas");
const ctx = canvas.getContext("2d");
const state = { running: false, controller: null, value: 0, target: 0, dataBytes: 0 };

const els = {
  start: $("#startTest"), stop: $("#stopTest"), note: $("#testNote"), heroStatus: $("#heroStatus"),
  gaugeValue: $("#gaugeValue"), gaugeLabel: $("#gaugeLabel"), gaugeUnit: $("#gaugeUnit"),
  ping: $("#pingValue"), jitter: $("#jitterValue"), download: $("#downloadValue"), upload: $("#uploadValue"),
  dataUsed: $("#dataUsed"), networkType: $("#networkType"), connectionPill: $("#connectionPill"),
  checkIp: $("#checkIp"), checkDns: $("#checkDns"), checkRtc: $("#checkRtc"),
  hostInput: $("#hostInput"), lookupButton: $("#lookupButton"), lookupResults: $("#lookupResults"),
  lookupError: $("#lookupError"), lookupLoading: $("#lookupLoading"),
  newSearchButton: $("#newSearchButton"), retryButton: $("#retryButton"), shareButton: $("#shareButton")
};

let currentHostData = null;

function formatFa(value) {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[digit]);
}

function drawGauge(value = 0) {
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h * 0.69, radius = Math.min(w * 0.42, h * 0.57);
  const start = Math.PI * 0.78, end = Math.PI * 2.22;
  ctx.clearRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(cx, cy, radius * .25, cx, cy, radius * 1.15);
  glow.addColorStop(0, "rgba(255,90,31,.045)");
  glow.addColorStop(1, "rgba(255,90,31,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

  ctx.beginPath(); ctx.arc(cx, cy, radius + 23, start, end);
  ctx.strokeStyle = "rgba(255,255,255,.035)"; ctx.lineWidth = 2; ctx.stroke();

  const ticks = 48;
  for (let i = 0; i <= ticks; i++) {
    const angle = start + (end - start) * (i / ticks);
    const major = i % 6 === 0;
    const active = i / ticks <= Math.min(value / 500, 1);
    const inner = radius - (major ? 21 : 11), outer = radius;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.strokeStyle = active ? (i > 38 ? "#ffb13b" : "#ff5a1f") : (major ? "rgba(255,255,255,.4)" : "rgba(255,255,255,.13)");
    ctx.lineWidth = major ? 3 : 1.5;
    ctx.shadowColor = active ? "#ff5a1f" : "transparent"; ctx.shadowBlur = active ? 8 : 0; ctx.stroke();

    if (major && i < ticks) {
      const label = Math.round(500 * i / ticks);
      const lr = radius - 43;
      ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,.48)"; ctx.font = "13px Arial";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, cx + Math.cos(angle) * lr, cy + Math.sin(angle) * lr);
    }
  }

  const safeValue = Math.min(value, 500);
  const needleAngle = start + (end - start) * (safeValue / 500);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(needleAngle);
  const needleGradient = ctx.createLinearGradient(-20, 0, radius - 55, 0);
  needleGradient.addColorStop(0, "#8b3018"); needleGradient.addColorStop(1, "#ff6b2b");
  ctx.beginPath(); ctx.moveTo(-18, 3); ctx.lineTo(radius - 53, 1.5); ctx.lineTo(radius - 40, 0); ctx.lineTo(radius - 53, -1.5); ctx.lineTo(-18, -3); ctx.closePath();
  ctx.fillStyle = needleGradient; ctx.shadowColor = "#ff5a1f"; ctx.shadowBlur = 10; ctx.fill(); ctx.restore();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fillStyle = "#080a0e"; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fillStyle = "#ff5a1f"; ctx.fill();
}

function animateGauge() {
  state.value += (state.target - state.value) * .11;
  if (Math.abs(state.target - state.value) < .02) state.value = state.target;
  drawGauge(state.value);
  els.gaugeValue.textContent = state.value < 10 ? state.value.toFixed(1) : state.value.toFixed(0);
  requestAnimationFrame(animateGauge);
}

function setPhase(label, note, target = 0) {
  els.gaugeLabel.textContent = label;
  els.note.textContent = note;
  state.target = target;
}

async function timedFetch(url, options = {}) {
  const started = performance.now();
  const response = await fetch(url, { cache: "no-store", signal: state.controller.signal, ...options });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { response, elapsed: performance.now() - started };
}

async function testLatency() {
  setPhase("LATENCY", "در حال اندازه‌گیری پینگ…", 0);
  els.gaugeUnit.textContent = "ms";
  const samples = [];
  for (let i = 0; i < 6; i++) {
    const { elapsed } = await timedFetch(`https://speed.cloudflare.com/__down?bytes=0&t=${Date.now()}-${i}`);
    samples.push(elapsed);
    const current = Math.round(elapsed);
    state.target = Math.min(current * 2, 500);
    els.gaugeValue.textContent = current;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const ping = sorted[Math.floor(sorted.length / 2)];
  const differences = samples.slice(1).map((sample, i) => Math.abs(sample - samples[i]));
  const jitter = differences.reduce((sum, n) => sum + n, 0) / differences.length;
  els.ping.textContent = ping.toFixed(0);
  els.jitter.innerHTML = `${jitter.toFixed(1)} <i>ms</i>`;
}

async function testDownload() {
  setPhase("DOWNLOAD", "در حال تست سرعت دانلود…", 0);
  els.gaugeUnit.textContent = "Mbps";
  const sizes = [1_000_000, 4_000_000, 10_000_000];
  const speeds = [];
  for (const bytes of sizes) {
    const { response, elapsed } = await timedFetch(`https://speed.cloudflare.com/__down?bytes=${bytes}&t=${Date.now()}`);
    const blob = await response.blob();
    state.dataBytes += blob.size;
    const mbps = (blob.size * 8) / (elapsed / 1000) / 1_000_000;
    speeds.push(mbps); state.target = mbps;
    els.download.textContent = mbps.toFixed(1);
    els.dataUsed.innerHTML = `${(state.dataBytes / 1_000_000).toFixed(1)} <i>MB</i>`;
  }
  const result = speeds.slice(-2).reduce((sum, n) => sum + n, 0) / Math.min(2, speeds.length);
  els.download.textContent = result.toFixed(1); state.target = result;
}

async function testUpload() {
  setPhase("UPLOAD", "در حال تست سرعت آپلود…", 0);
  const sizes = [250_000, 1_000_000, 2_000_000];
  const speeds = [];
  for (const bytes of sizes) {
    const payload = new Uint8Array(bytes);
    const { elapsed } = await timedFetch(`https://speed.cloudflare.com/__up?t=${Date.now()}`, { method: "POST", body: payload });
    state.dataBytes += bytes;
    const mbps = (bytes * 8) / (elapsed / 1000) / 1_000_000;
    speeds.push(mbps); state.target = mbps;
    els.upload.textContent = mbps.toFixed(1);
    els.dataUsed.innerHTML = `${(state.dataBytes / 1_000_000).toFixed(1)} <i>MB</i>`;
  }
  const result = speeds.slice(-2).reduce((sum, n) => sum + n, 0) / Math.min(2, speeds.length);
  els.upload.textContent = result.toFixed(1); state.target = result;
}

async function runSpeedTest() {
  if (state.running || !navigator.onLine) return;
  state.running = true; state.dataBytes = 0; state.controller = new AbortController();
  els.start.disabled = true; els.start.classList.add("running"); els.stop.hidden = false;
  els.heroStatus.textContent = "تست در حال اجرا";
  try {
    await testLatency();
    await testDownload();
    await testUpload();
    els.heroStatus.textContent = "تست کامل شد";
    els.note.textContent = "نتیجه با موفقیت ثبت شد";
    els.gaugeLabel.textContent = "COMPLETE";
  } catch (error) {
    if (error.name === "AbortError") {
      els.note.textContent = "تست متوقف شد"; els.heroStatus.textContent = "متوقف شده";
    } else {
      console.error(error);
      els.note.textContent = "ارتباط با سرور تست برقرار نشد؛ دوباره تلاش کنید";
      els.heroStatus.textContent = "خطای ارتباط";
    }
    state.target = 0;
  } finally {
    state.running = false; els.start.disabled = false; els.start.classList.remove("running"); els.stop.hidden = true;
    els.gaugeUnit.textContent = "Mbps";
  }
}

function setBadge(id, text, type) {
  const badge = $(id); badge.textContent = text; badge.className = `status-badge ${type}`;
}

async function checkIp() {
  els.checkIp.disabled = true; els.checkIp.firstChild.textContent = "در حال بررسی… ";
  setBadge("#ipBadge", "در حال دریافت", "warning");
  try {
    let data;
    const response = await fetch("https://ipwho.is/", { cache: "no-store" });
    if (!response.ok) throw new Error("IP service failed");
    data = await response.json();
    if (data.success === false) throw new Error(data.message);
    $("#ipAddress").textContent = data.ip || "—";
    $("#ipLocation").textContent = [data.city, data.country_code].filter(Boolean).join("، ") || "نامشخص";
    $("#ipProvider").textContent = data.connection?.isp || data.connection?.org || "نامشخص";
    $("#ipType").textContent = data.type === "IPv6" ? "IPv6" : "IPv4";
    setBadge("#ipBadge", "شناسایی شد", "safe");
    return data;
  } catch (error) {
    setBadge("#ipBadge", "خطا در دریافت", "danger");
    $("#ipLocation").textContent = "سرویس در دسترس نیست";
    return null;
  } finally {
    els.checkIp.disabled = false; els.checkIp.firstChild.textContent = "بررسی مجدد ";
  }
}

function renderConsole(container, rows) {
  container.innerHTML = rows.map(([value, label]) => `<div class="console-row"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`).join("");
}
function escapeHtml(value) {
  const div = document.createElement("div"); div.textContent = String(value); return div.innerHTML;
}

async function checkDns() {
  els.checkDns.disabled = true; setBadge("#dnsBadge", "در حال آزمایش", "warning");
  const box = $("#dnsResults"); box.innerHTML = '<span class="console-empty">در حال ارسال درخواست‌های DNS…</span>';
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < 5; i++) {
      await fetch(`https://${id}-${i}.test.nextdns.io/`, { mode: "no-cors", cache: "no-store" }).catch(() => {});
    }
    const response = await fetch("https://test.nextdns.io/", { cache: "no-store" });
    if (!response.ok) throw new Error("DNS service unavailable");
    const data = await response.json();
    const rows = [];
    if (data.resolvers?.length) data.resolvers.forEach((resolver) => rows.push([resolver, "Resolver"]));
    if (data.client) rows.push([data.client, "Client IP"]);
    if (data.protocol) rows.push([data.protocol, "Protocol"]);
    if (!rows.length) rows.push(["No resolver details", "Result"]);
    renderConsole(box, rows);
    const encrypted = /^(DOH|DOT|DOQ)$/i.test(data.protocol || "");
    setBadge("#dnsBadge", encrypted ? "DNS رمزنگاری‌شده" : "نیازمند بررسی", encrypted ? "safe" : "warning");
  } catch (error) {
    renderConsole(box, [["Browser/API restriction", "Unavailable"], ["Use VPN provider test", "Recommendation"]]);
    setBadge("#dnsBadge", "نتیجه محدود", "warning");
  } finally { els.checkDns.disabled = false; }
}

async function checkWebRtc() {
  els.checkRtc.disabled = true; setBadge("#rtcBadge", "در حال آزمایش", "warning");
  const box = $("#rtcResults"); box.innerHTML = '<span class="console-empty">در حال جمع‌آوری ICE candidates…</span>';
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
    await new Promise((resolve) => setTimeout(resolve, 3500));
    pc.close();
    const list = [...addresses];
    if (list.length) {
      renderConsole(box, list.map((address) => [address, isPrivateIp(address) ? "Private / local" : "Public candidate"]));
      const publicLeak = list.some((address) => !isPrivateIp(address) && !address.endsWith(".local"));
      setBadge("#rtcBadge", publicLeak ? "IP عمومی آشکار شد" : "نشت عمومی دیده نشد", publicLeak ? "danger" : "safe");
    } else {
      renderConsole(box, [["No IP candidates exposed", "Protected"]]);
      setBadge("#rtcBadge", "محافظت‌شده", "safe");
    }
  } catch (error) {
    renderConsole(box, [["WebRTC blocked or unsupported", "Browser"]]);
    setBadge("#rtcBadge", "WebRTC غیرفعال", "safe");
  } finally { els.checkRtc.disabled = false; }
}

function isPrivateIp(ip) {
  return /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) || /^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip) || ip.endsWith(".local");
}

function updateConnection() {
  const online = navigator.onLine;
  els.connectionPill.classList.toggle("offline", !online);
  els.connectionPill.querySelector("b").textContent = online ? "آنلاین" : "آفلاین";
  if (!online) els.note.textContent = "اتصال اینترنت برقرار نیست";
}

const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
if (connection) {
  const labels = { "slow-2g": "بسیار ضعیف", "2g": "2G", "3g": "3G", "4g": "4G / سریع" };
  els.networkType.textContent = labels[connection.effectiveType] || connection.effectiveType || "نامشخص";
}

els.start.addEventListener("click", runSpeedTest);
els.stop.addEventListener("click", () => state.controller?.abort());
els.checkIp.addEventListener("click", checkIp);
els.checkDns.addEventListener("click", checkDns);
els.checkRtc.addEventListener("click", checkWebRtc);
window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);
window.addEventListener("resize", () => drawGauge(state.value));

async function lookupHost() {
  let domain = els.hostInput.value.trim();
  
  domain = domain.replace(/^https?:\/\//, "");
  domain = domain.replace(/^www\./, "");
  domain = domain.replace(/\/.*$/, "");
  domain = domain.toLowerCase();
  
  if (!domain || domain.length < 3 || !/^[a-zA-Z0-9][a-zA-Z0-9-\.]*[a-zA-Z0-9]$/.test(domain)) {
    $("#errorMessage").textContent = "لطفاً یک دامنه معتبر وارد کنید (مثل example.com)";
    els.lookupResults.hidden = true;
    els.lookupError.hidden = false;
    return;
  }

  els.lookupButton.disabled = true;
  els.lookupButton.classList.add("loading");
  els.lookupResults.hidden = true;
  els.lookupError.hidden = true;
  els.lookupLoading.hidden = false;

  try {
    const startTime = performance.now();
    const hasSSL = await checkSSL(domain);
    
    const response = await fetch(`https://ipwho.is/${domain}`, { cache: "no-store" });
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);
    if (!response.ok) throw new Error("سرویس در دسترس نیست");
    const data = await response.json();
    
    if (data.success === false) {
      throw new Error(data.message || "اطلاعاتی برای این دامنه پیدا نشد");
    }

    $("#resultDomain").textContent = domain;
    
    const countryFlag = data.country_code ? getCountryFlag(data.country_code) : "";
    $("#hostFlag").textContent = countryFlag;
    $("#hostCountryName").textContent = data.country || "—";
    
    $("#hostCity").textContent = data.city || "—";
    $("#hostTimezone").textContent = data.timezone?.id || "—";
    $("#hostIp").querySelector(".ip-text").textContent = data.ip || "—";
    $("#hostIsp").textContent = data.connection?.isp || "—";
    $("#hostOrg").textContent = data.connection?.org || data.connection?.isp || "—";
    
    const ipType = data.type === "IPv6" ? "IPv6" : "IPv4";
    $("#hostIpType").textContent = ipType;
    $("#hostIpType").style.background = data.type === "IPv6" 
      ? "rgba(65,169,230,.15)" 
      : "rgba(53,208,127,.15)";
    $("#hostIpType").style.color = data.type === "IPv6" ? "#41a9e6" : "var(--green)";
    $("#hostIpType").style.borderColor = data.type === "IPv6" 
      ? "rgba(65,169,230,.3)" 
      : "rgba(53,208,127,.3)";
    $("#hostCountryCode").textContent = data.country_code || "—";
    const latLngEl = $("#hostLatLng");
    if (data.latitude && data.longitude) {
      latLngEl.textContent = `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`;
      latLngEl.title = "کلیک کنید تا در نقشه مشاهده شود";
      latLngEl.dataset.lat = data.latitude;
      latLngEl.dataset.lng = data.longitude;
      latLngEl.style.cursor = "pointer";
    } else {
      latLngEl.textContent = "—";
      latLngEl.title = "";
      delete latLngEl.dataset.lat;
      delete latLngEl.dataset.lng;
      latLngEl.style.cursor = "default";
    }

    els.lookupLoading.hidden = true;
    els.lookupResults.hidden = false;
    els.lookupError.hidden = true;
    
    const sslBadge = $("#sslBadge");
    if (hasSSL) {
      sslBadge.hidden = false;
    } else {
      sslBadge.hidden = true;
    }
    
    $("#responseTime").textContent = responseTime;
    
    currentHostData = {
      domain: domain,
      country: data.country,
      city: data.city,
      ip: data.ip,
      isp: data.connection?.isp
    };
    
    showConfetti();

    setTimeout(() => {
      $("#lookupResults").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);

  } catch (error) {
    $("#errorMessage").textContent = error.message || "خطایی در دریافت اطلاعات رخ داد. لطفاً دوباره تلاش کنید.";
    els.lookupLoading.hidden = true;
    els.lookupResults.hidden = true;
    els.lookupError.hidden = false;
  } finally {
    els.lookupButton.disabled = false;
    els.lookupButton.classList.remove("loading");
  }
}

function resetLookup() {
  els.hostInput.value = "";
  els.hostInput.parentElement.style.borderColor = "";
  els.lookupLoading.hidden = true;
  els.lookupResults.hidden = true;
  els.lookupError.hidden = true;
  currentHostData = null;
  els.hostInput.focus();
}

els.lookupButton.addEventListener("click", lookupHost);
els.hostInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") lookupHost();
});

els.hostInput.addEventListener("input", function() {
  const container = this.parentElement;
  if (this.value.length > 0) {
    container.style.borderColor = "rgba(255,90,31,.5)";
  } else {
    container.style.borderColor = "";
  }
});
els.newSearchButton.addEventListener("click", resetLookup);
els.retryButton.addEventListener("click", () => {
  els.lookupError.hidden = true;
  els.hostInput.focus();
});

els.shareButton.addEventListener("click", async () => {
  if (!currentHostData) return;
  
  const shareText = `🌐 اطلاعات هاست ${currentHostData.domain}\n\n🇫🇱 کشور: ${currentHostData.country}\n🏛️ شهر: ${currentHostData.city}\n🔗 IP: ${currentHostData.ip}\n🏛️ ISP: ${currentHostData.isp}\n\nتوسط WigaNet`;
  
  try {
    if (navigator.share) {
      await navigator.share({
        title: `اطلاعات ${currentHostData.domain}`,
        text: shareText
      });
    } else {
      await navigator.clipboard.writeText(shareText);
      const btn = els.shareButton;
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span>✅</span> کپی شد';
      btn.style.background = 'rgba(53,208,127,.12)';
      btn.style.color = 'var(--green)';
      btn.style.borderColor = 'rgba(53,208,127,.3)';
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }, 2000);
    }
  } catch (err) {
    console.log('اشتراک‌گذاری لغو شد');
  }
});

$("#hostIp").addEventListener("click", async function() {
  const ipText = this.querySelector(".ip-text");
  const copyIcon = this.querySelector(".copy-icon");
  const ip = ipText.textContent;
  if (ip === "—") return;
  
  try {
    await navigator.clipboard.writeText(ip);
    const original = ipText.textContent;
    ipText.textContent = "کپی شد";
    copyIcon.textContent = "✅";
    this.style.color = "var(--green)";
    
    setTimeout(() => {
      ipText.textContent = original;
      copyIcon.textContent = "📋";
      this.style.color = "";
    }, 2000);
  } catch (err) {
    copyIcon.textContent = "❌";
    setTimeout(() => { copyIcon.textContent = "📋"; }, 1500);
  }
});

$("#hostLatLng").addEventListener("click", function() {
  const lat = this.dataset.lat;
  const lng = this.dataset.lng;
  if (lat && lng) {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  }
});

function getCountryFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

async function checkSSL(domain) {
  try {
    const response = await fetch(`https://${domain}`, { 
      method: "HEAD", 
      mode: "no-cors",
      cache: "no-store" 
    });
    return true;
  } catch {
    return false;
  }
}

function showConfetti() {
  const container = $("#confettiContainer");
  container.innerHTML = "";
  
  for (let i = 0; i < 15; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.animationDelay = `${Math.random() * 0.3}s`;
    confetti.style.background = [
      "var(--orange)",
      "var(--green)",
      "#41a9e6",
      "#ffba45",
      "var(--orange-soft)"
    ][Math.floor(Math.random() * 5)];
    container.appendChild(confetti);
  }
  
  setTimeout(() => {
    container.innerHTML = "";
  }, 2500);
}

document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const targetId = this.getAttribute('href');
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
      this.classList.add('active');
    }
  });
});

updateConnection(); drawGauge(0); animateGauge();
setTimeout(checkIp, 500);
