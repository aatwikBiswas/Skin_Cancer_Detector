/* ============================================================
   DermAI — Skin Cancer Detection | script.js
   ============================================================ */

'use strict';

// ─── DOM References ─────────────────────────────────────────────────
const dropZone       = document.getElementById('dropZone');
const dropInner      = document.getElementById('dropInner');
const fileInput      = document.getElementById('fileInput');
const imagePreview   = document.getElementById('imagePreview');
const previewImg     = document.getElementById('previewImg');
const removeImgBtn   = document.getElementById('removeImg');
const ageSelect      = document.getElementById('ageSelect');
const predictBtn     = document.getElementById('predictBtn');
const resultPlaceholder = document.getElementById('resultPlaceholder');
const spinnerWrap    = document.getElementById('spinnerWrap');
const resultCard     = document.getElementById('resultCard');
const resultPrediction = document.getElementById('resultPrediction');
const riskBadge      = document.getElementById('riskBadge');
const confidenceText = document.getElementById('confidenceText');
const confidenceFill = document.getElementById('confidenceFill');
const resultTimestamp = document.getElementById('resultTimestamp');
const dAge           = document.getElementById('dAge');
const dSex           = document.getElementById('dSex');
const dFamily        = document.getElementById('dFamily');
const dSymptoms      = document.getElementById('dSymptoms');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyList    = document.getElementById('historyList');
const historyEmpty   = document.getElementById('historyEmpty');
const themeToggle    = document.getElementById('themeToggle');
const themeIcon      = themeToggle.querySelector('.theme-icon');
const faqList        = document.getElementById('faqList');

// ─── State ──────────────────────────────────────────────────────────
let uploadedImageDataURL = null;
let lastResult = null;

// ─── Populate Age Dropdown ───────────────────────────────────────────
(function populateAge() {
  for (let i = 0; i <= 100; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i === 0 ? '0 (Infant)' : `${i}`;
    ageSelect.appendChild(opt);
  }
})();

// ─── Dark Mode ───────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('derm-theme') || 'light';
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('derm-theme', next);
});

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ─── Drag & Drop ─────────────────────────────────────────────────────
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    loadImage(file);
  } else {
    showToast('Please drop an image file (PNG, JPG, WEBP).', 'error');
  }
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) loadImage(file);
});

removeImgBtn.addEventListener('click', () => {
  uploadedImageDataURL = null;
  imagePreview.classList.add('hidden');
  dropInner.classList.remove('hidden');
  fileInput.value = '';
  previewImg.src = '';
});

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImageDataURL = e.target.result;
    previewImg.src = uploadedImageDataURL;
    dropInner.classList.add('hidden');
    imagePreview.classList.remove('hidden');
    // Trigger scan line animation
    imagePreview.classList.remove('scanning');
    void imagePreview.offsetWidth;
    imagePreview.classList.add('scanning');
    setTimeout(() => imagePreview.classList.remove('scanning'), 2000);
  };
  reader.readAsDataURL(file);
}

// ─── Prediction Logic ────────────────────────────────────────────────
predictBtn.addEventListener('click', runPrediction);

function getFormData() {
  const age = ageSelect.value;
  const sex = document.querySelector('input[name="sex"]:checked')?.value || null;
  const family = document.querySelector('input[name="family"]:checked')?.value || null;
  const symptoms = [...document.querySelectorAll('#symptomsGrid input:checked')].map(c => c.value);
  return { age, sex, family, symptoms };
}

async function runPrediction() {
  if (!uploadedImageDataURL) {
    showToast('Please upload a skin image first.', 'error');
    return;
  }

  const { age, sex, family, symptoms } = getFormData();

  if (!age) { showToast('Please select a patient age.', 'error'); return; }
  if (!sex) { showToast('Please select the patient sex.', 'error'); return; }
  if (!family) { showToast('Please indicate family history.', 'error'); return; }

  // Show spinner
  resultPlaceholder.classList.add('hidden');
  resultCard.classList.add('hidden');
  spinnerWrap.classList.remove('hidden');

  try {
    // 🔥 Convert base64 → blob
    const blob = await fetch(uploadedImageDataURL).then(res => res.blob());

    // 🔥 Prepare form data (FIXED)
    const formData = new FormData();
    formData.append("file", blob, "image.jpg");
    formData.append("age", parseInt(age));                 // ✅ ensure int
    formData.append("sex", sex || "male");                 // ✅ fallback
    formData.append("history", family || "no");            // ✅ fallback
    formData.append("symptoms", symptoms.length ? symptoms.join(",") : "none"); // ✅ never empty

    // 🔥 DEBUG (VERY IMPORTANT)
    for (let pair of formData.entries()) {
      console.log(pair[0] + ":", pair[1]);
    }

    // 🔥 CALL BACKEND
    const response = await fetch("http://127.0.0.1:8000/predict", {
      method: "POST",
      body: formData
    });

    // 🔥 HANDLE BACKEND ERROR PROPERLY
    if (!response.ok) {
      const err = await response.text();
      console.error("BACKEND ERROR:", err);
      throw new Error("Request failed");
    }

    const data = await response.json();

    // 🔥 DEBUG RESPONSE
    console.log("RAW:", data.raw_prediction);
    console.log("RISK:", data.risk_score);

    // 🔥 Convert backend response → frontend format
    const result = {
      prediction: data.prediction === "CANCEROUS" ? "Cancerous" :
                  data.prediction === "NOT CANCEROUS" ? "Not Cancerous" : "Uncertain",
      confidence: Math.round(data.risk_score * 100),
      riskLevel: data.risk_score > 0.7 ? "High" :
                 data.risk_score > 0.3 ? "Medium" : "Low"
    };

    lastResult = { ...result, age, sex, family, symptoms, ts: new Date() };

    displayResult(lastResult);
    saveToHistory(lastResult);

  } catch (err) {
    console.error(err);
    showToast("Prediction failed. Check backend.", "error");
  } finally {
    spinnerWrap.classList.add('hidden');
    resultCard.classList.remove('hidden');
  }
}


function displayResult({ prediction, confidence, riskLevel, age, sex, family, symptoms, ts }) {
  // Prediction
  resultPrediction.textContent = prediction;

  // Risk badge
  riskBadge.textContent = `${riskLevel} Risk`;
  riskBadge.className = 'risk-badge';
  if (riskLevel === 'Low')    riskBadge.classList.add('risk-low');
  if (riskLevel === 'Medium') riskBadge.classList.add('risk-medium');
  if (riskLevel === 'High')   riskBadge.classList.add('risk-high');

  // Confidence bar
  confidenceText.textContent = `${confidence}%`;
  requestAnimationFrame(() => {
    confidenceFill.style.width = `${confidence}%`;
  });

  // Timestamp
  resultTimestamp.textContent = formatDate(ts);

  // Patient details
  dAge.textContent    = `${age} years`;
  dSex.textContent    = capitalize(sex);
  dFamily.textContent = family === 'yes' ? 'Yes' : 'No';
  dSymptoms.textContent = symptoms.length > 0 ? symptoms.join(', ') : 'None reported';
}

// ─── PDF Generation ──────────────────────────────────────────────────
downloadPdfBtn.addEventListener('click', generatePDF);

function generatePDF() {
  if (!lastResult) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const margin = 50;
  const pageW  = doc.internal.pageSize.getWidth();
  let y = margin;

  // Header bar
  doc.setFillColor(14, 165, 233);
  doc.rect(0, 0, pageW, 80, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('DermAI — Skin Cancer Detection Report', margin, 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('AI-Powered Dermatology Screening Tool', margin, 55);
  doc.text(`Generated: ${formatDate(lastResult.ts)}`, margin, 68);

  y = 110;

  // ─ Early section title helper ─
  function sectionTitleEarly(title) {
    doc.setFillColor(240, 244, 248);
    doc.rect(margin - 10, y - 14, pageW - 2 * margin + 20, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(13, 27, 42);
    doc.text(title, margin, y);
    y += 22;
  }

  // ─ Uploaded Image ─
  if (uploadedImageDataURL) {
    sectionTitleEarly('Analyzed Skin Image');

    // Draw a light border box behind the image
    const imgW = 160;
    const imgH = 160;
    const imgX = (pageW - imgW) / 2;

    doc.setFillColor(240, 244, 248);
    doc.rect(imgX - 6, y - 4, imgW + 12, imgH + 12, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.rect(imgX - 6, y - 4, imgW + 12, imgH + 12, 'S');

    // Determine image format from data URL
    const formatMatch = uploadedImageDataURL.match(/^data:image\/(\w+);base64,/);
    const imgFormat = formatMatch ? formatMatch[1].toUpperCase() : 'JPEG';
    const safeFormat = ['JPEG', 'JPG', 'PNG', 'WEBP'].includes(imgFormat) ? imgFormat : 'JPEG';

    doc.addImage(uploadedImageDataURL, safeFormat, imgX, y, imgW, imgH);

    // Caption below image
    y += imgH + 16;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Uploaded dermoscopic image submitted for analysis', pageW / 2, y, { align: 'center' });
    y += 20;
  }

  // ─ Section helper ─
  function sectionTitle(title) {
    doc.setFillColor(240, 244, 248);
    doc.rect(margin - 10, y - 14, pageW - 2 * margin + 20, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(13, 27, 42);
    doc.text(title, margin, y);
    y += 22;
  }

  function row(label, value) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(label + ':', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(13, 27, 42);
    doc.text(String(value), margin + 130, y);
    y += 18;
  }

  // ─ Prediction Results ─
  sectionTitle('Prediction Results');

  // Prediction
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Prediction:', margin, y);
  doc.setFontSize(14);
  doc.setTextColor(13, 27, 42);
  doc.text(lastResult.prediction, margin + 130, y);
  y += 20;

  row('Confidence', `${lastResult.confidence}%`);

  // Confidence bar (drawn)
  doc.setFillColor(226, 232, 240);
  doc.rect(margin, y, pageW - 2 * margin, 10, 'F');
  const barW = ((pageW - 2 * margin) * lastResult.confidence) / 100;
  doc.setFillColor(14, 165, 233);
  doc.rect(margin, y, barW, 10, 'F');
  y += 20;

  // Risk badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('Risk Level:', margin, y);
  const badgeColors = { Low: [16,185,129], Medium: [245,158,11], High: [239,68,68] };
  const bc = badgeColors[lastResult.riskLevel] || [100,116,139];
  doc.setFillColor(...bc);
  doc.roundedRect(margin + 130, y - 12, 90, 18, 9, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(`${lastResult.riskLevel} Risk`, margin + 175, y, { align: 'center' });
  y += 28;

  // ─ Patient Details ─
  sectionTitle('Patient Information');
  row('Age',            `${lastResult.age} years`);
  row('Sex',            capitalize(lastResult.sex));
  row('Family History', lastResult.family === 'yes' ? 'Yes' : 'No');
  y += 4;

  // ─ Symptoms ─
  sectionTitle('Reported Symptoms');
  const symList = lastResult.symptoms.length > 0 ? lastResult.symptoms.join(', ') : 'None reported';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(13, 27, 42);
  const lines = doc.splitTextToSize(symList, pageW - 2 * margin);
  doc.text(lines, margin, y);
  y += lines.length * 15 + 10;

  // ─ Disclaimer ─
  sectionTitle('Important Disclaimer');
  const disclaimer = 'This is an AI-generated prediction and not a medical diagnosis. ' +
    'The result should not be used as a substitute for professional medical advice, diagnosis, or treatment. ' +
    'Always seek the advice of a qualified healthcare provider with any questions regarding a medical condition.';
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const dLines = doc.splitTextToSize(disclaimer, pageW - 2 * margin);
  doc.text(dLines, margin, y);
  y += dLines.length * 14;

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 30;
  doc.setFillColor(14, 165, 233);
  doc.rect(0, footerY - 8, pageW, 38, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('DermAI · AI-Powered Skin Cancer Screening · Not a Medical Device', pageW / 2, footerY + 8, { align: 'center' });

  doc.save(`DermAI_Report_${Date.now()}.pdf`);
  showToast('PDF report downloaded!', 'success');
}

// ─── History ─────────────────────────────────────────────────────────
function saveToHistory(result) {
  const history = getHistory();
  history.unshift({
    prediction: result.prediction,
    riskLevel:  result.riskLevel,
    confidence: result.confidence,
    age:        result.age,
    sex:        result.sex,
    ts:         result.ts.toISOString(),
    id:         Date.now()
  });
  const trimmed = history.slice(0, 10); // keep last 10
  localStorage.setItem('derm-history', JSON.stringify(trimmed));
  renderHistory();
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('derm-history') || '[]');
  } catch { return []; }
}

function renderHistory() {
  const history = getHistory();
  historyList.innerHTML = '';

  if (history.length === 0) {
    historyList.innerHTML = '<p class="history-empty" id="historyEmpty">No predictions yet. Run your first analysis above.</p>';
    return;
  }

  history.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';

    const badgeClass = item.riskLevel === 'Low' ? 'risk-low' : item.riskLevel === 'Medium' ? 'risk-medium' : 'risk-high';
    const badgeIcon  = item.riskLevel === 'Low' ? '🟢' : item.riskLevel === 'Medium' ? '🟡' : '🔴';

    el.innerHTML = `
      <div class="history-item-badge">
        <span class="risk-badge ${badgeClass}" style="font-size:0.72rem;padding:4px 10px;">${item.riskLevel}</span>
      </div>
      <div class="history-item-info">
        <div class="history-item-pred">${badgeIcon} ${item.prediction}</div>
        <div class="history-item-meta">Confidence: ${item.confidence}% · Age: ${item.age} · ${capitalize(item.sex || '—')}</div>
      </div>
      <div class="history-item-time">${formatDate(new Date(item.ts), true)}</div>
    `;
    historyList.appendChild(el);
  });
}

clearHistoryBtn.addEventListener('click', () => {
  localStorage.removeItem('derm-history');
  renderHistory();
  showToast('History cleared.', 'success');
});

// ─── FAQ Accordion ───────────────────────────────────────────────────
document.querySelectorAll('.faq-item').forEach(item => {
  const btn = item.querySelector('.faq-q');
  btn.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

// ─── Toast ───────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%) translateY(0);
    padding: 0.75rem 1.5rem;
    border-radius: 99px;
    font-family: var(--font-head);
    font-size: 0.85rem;
    font-weight: 700;
    z-index: 999;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#0ea5e9'};
    color: #fff;
    animation: toast-in 0.3s ease;
  `;

  const style = document.createElement('style');
  style.textContent = `@keyframes toast-in { from { opacity:0; transform:translateX(-50%) translateY(16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
  document.head.appendChild(style);

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Utilities ───────────────────────────────────────────────────────
function capitalize(s) {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(date, short = false) {
  if (!(date instanceof Date)) date = new Date(date);
  if (short) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// ─── Init ─────────────────────────────────────────────────────────────
renderHistory();

// ─── Particle Background ─────────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function getColor() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? 'rgba(56,189,248,' : 'rgba(14,165,233,';
  }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.r  = Math.random() * 1.8 + 0.4;
      this.vx = (Math.random() - 0.5) * 0.35;
      this.vy = (Math.random() - 0.5) * 0.35;
      this.a  = Math.random() * 0.4 + 0.1;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = getColor() + this.a + ')';
      ctx.fill();
    }
  }

  const COUNT = Math.min(90, Math.floor(W * H / 14000));
  for (let i = 0; i < COUNT; i++) particles.push(new Particle());

  function drawLines() {
    const maxDist = 120;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.15;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = getColor() + alpha + ')';
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    drawLines();
    requestAnimationFrame(loop);
  }
  loop();
})();

// ─── Scroll Reveal ───────────────────────────────────────────────────
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
})();

// ─── Navbar scroll shadow ────────────────────────────────────────────
window.addEventListener('scroll', () => {
  document.querySelector('.navbar').classList.toggle('scrolled', window.scrollY > 10);
});

// ─── Active nav link on scroll ───────────────────────────────────────
(function initActiveNav() {
  const sections = ['tool','history','about','faq'];
  const links = document.querySelectorAll('.nav-links a');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 120) current = id;
    });
    links.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    });
  });
})();

// ─── Hero Typing Effect ──────────────────────────────────────────────
(function initTyping() {
  const el = document.getElementById('heroTyping');
  const cursor = document.getElementById('typingCursor');
  if (!el) return;
  const words = ['Detection', 'Screening', 'Analysis', 'Diagnosis'];
  let wi = 0, ci = 0, deleting = false;

  function tick() {
    const word = words[wi];
    if (!deleting) {
      el.textContent = word.slice(0, ++ci);
      if (ci === word.length) {
        deleting = true;
        setTimeout(tick, 1800);
        return;
      }
    } else {
      el.textContent = word.slice(0, --ci);
      if (ci === 0) {
        deleting = false;
        wi = (wi + 1) % words.length;
        setTimeout(tick, 400);
        return;
      }
    }
    setTimeout(tick, deleting ? 55 : 90);
  }
  tick();
})();

// ─── Animated Stat Counters ──────────────────────────────────────────
(function initCounters() {
  const stats = [
    { el: document.querySelector('.hero-stats .stat:nth-child(1) strong'), target: 10015, suffix: '' },
    { el: document.querySelector('.hero-stats .stat:nth-child(3) strong'), target: 7,     suffix: '' },
  ];
  let done = false;

  function animateCount(el, target, suffix) {
    let start = 0;
    const step = target / 50;
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      el.textContent = Math.floor(start).toLocaleString() + suffix;
      if (start >= target) clearInterval(timer);
    }, 28);
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && !done) {
        done = true;
        stats.forEach(s => { if (s.el) animateCount(s.el, s.target, s.suffix); });
      }
    });
  }, { threshold: 0.5 });

  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) io.observe(heroStats);
})();

// ─── Live Symptom Risk Meter ─────────────────────────────────────────
(function initRiskMeter() {
  const checkboxes   = document.querySelectorAll('#symptomsGrid input[type="checkbox"]');
  const fill         = document.getElementById('riskMeterFill');
  const label        = document.getElementById('riskMeterLabel');
  const tagsEl       = document.getElementById('riskMeterTags');
  const familyRadios = document.querySelectorAll('input[name="family"]');
  const ageSelectEl  = document.getElementById('ageSelect');

  const HIGH = ['Growing', 'Darkening', 'Bleeding'];
  const MED  = ['Irregular Border', 'Color Change', 'Pain', 'Itching'];

  function update() {
    let score = 0;
    const selected = [];

    checkboxes.forEach(cb => {
      if (cb.checked) {
        selected.push(cb.value);
        score += HIGH.includes(cb.value) ? 3 : MED.includes(cb.value) ? 2 : 1;
      }
    });

    const age = parseInt(ageSelectEl.value) || 0;
    if (age > 60) score += 2;
    else if (age > 40) score += 1;

    const famVal = document.querySelector('input[name="family"]:checked')?.value;
    if (famVal === 'yes') score += 3;

    const maxScore = 24;
    const pct = Math.min(100, Math.round((score / maxScore) * 100));

    let level = 'low';
    if (score >= 10) level = 'high';
    else if (score >= 5) level = 'medium';

    fill.style.width = pct + '%';
    fill.className = 'risk-meter-fill ' + level;
    label.className = 'risk-meter-label ' + level;
    label.textContent = level.charAt(0).toUpperCase() + level.slice(1);

    // Tags
    tagsEl.innerHTML = '';
    selected.forEach(sym => {
      const tag = document.createElement('span');
      tag.className = 'risk-tag';
      tag.textContent = sym;
      tagsEl.appendChild(tag);
    });
  }

  checkboxes.forEach(cb => cb.addEventListener('change', update));
  familyRadios.forEach(r => r.addEventListener('change', update));
  ageSelectEl.addEventListener('change', update);
  update();
})();