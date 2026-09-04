interface ReportShareData {
  id: string;
  title: string;
  animalName: string;
  species?: string;
  breed?: string;
  gender?: string;
  age?: string;
  status?: string;
  authorName?: string;
  authorImage?: string;
  eventDate?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  imageUrl?: string;
  appStoreUrl: string;
  playStoreUrl: string;
  customSchemeUrl: string;
}

interface InviteShareData {
  referralCode: string;
  appStoreUrl: string;
  playStoreUrl: string;
  customSchemeUrl: string;
}

export function reportShareTemplate(data: ReportShareData): string {
  const animalName = data.animalName || "Signalement d'animal";
  const title = `Hesteka - ${animalName}`;
  const description = data.description ? `"${data.description}"` : "Consultez ce signalement d'animal sur l'application Hesteka.";
  const image = data.imageUrl && data.imageUrl.startsWith("http")
    ? data.imageUrl
    : "https://res.cloudinary.com/dhlrjlqvv/image/upload/v1788122120/hesteka/image/dkuklfgwsge2nhxn340l.jpg";
  const currentUrl = `https://share.hesteka.com/report/${data.id}`;

  const statusLabel = data.status === "lost" ? "Perdu (Lost)"
    : data.status === "sighted" ? "Aperçu (Sighted)"
    : data.status === "found" ? "Trouvé (Found)"
    : data.status === "rescued" ? "Secouru (Rescued)"
    : "Signalé";

  const statusBg = data.status === "lost" ? "#FFE5E5" : data.status === "sighted" ? "#FFF2DE" : "#E8F8F0";
  const statusColor = data.status === "lost" ? "#D32F2F" : data.status === "sighted" ? "#D97706" : "#2E7D32";

  const detailsList = [data.age, data.species, data.breed, data.status ? (data.status.charAt(0).toUpperCase() + data.status.slice(1)) : null].filter(Boolean).join(" | ");

  // Map preview URL if coordinates are available
  const hasCoords = data.latitude !== undefined && data.longitude !== undefined && data.latitude !== 0 && data.longitude !== 0;
  const mapImgUrl = hasCoords 
    ? `https://static-maps.yandex.ru/1.x/?lang=en-US&ll=${data.longitude},${data.latitude}&z=14&l=map&size=450,200&pt=${data.longitude},${data.latitude},pm2rdm`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  
  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${currentUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${currentUrl}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(description)}">
  <meta property="twitter:image" content="${image}">

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8EFE4;
      background-image: linear-gradient(#EFE2D3 1px, transparent 1px), linear-gradient(90deg, #EFE2D3 1px, transparent 1px);
      background-size: 24px 24px;
      color: #333333;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px 12px;
    }
    .container {
      max-width: 480px;
      width: 100%;
    }
    .top-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #BA4A22;
      color: white;
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 0.85rem;
      margin-bottom: 12px;
      box-shadow: 0 4px 10px rgba(186, 74, 34, 0.2);
    }
    .card {
      background: #FFFDF9;
      border: 2px solid #BA4A22;
      border-radius: 28px;
      box-shadow: 0 12px 36px rgba(186, 74, 34, 0.12);
      overflow: hidden;
      padding: 24px 20px;
    }
    .animal-title {
      font-size: 2rem;
      font-weight: 900;
      color: #BA4A22;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
      line-height: 1.1;
    }
    .media-row {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    .animal-image {
      width: 140px;
      height: 140px;
      border-radius: 18px;
      object-fit: cover;
      background-color: #F5EAE0;
      border: 2px solid #EEDCD0;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .meta-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .author-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .author-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
      background: #BA4A22;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: bold;
    }
    .author-name {
      font-weight: 700;
      color: #BA4A22;
      font-size: 0.95rem;
    }
    .event-date {
      font-size: 0.75rem;
      color: #888;
    }
    .details-text {
      font-size: 0.85rem;
      font-weight: 600;
      color: #BA4A22;
      line-height: 1.3;
    }
    .status-pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 0.8rem;
      font-weight: 700;
      background: ${statusBg};
      color: ${statusColor};
      border: 1px solid ${statusColor}40;
      margin-top: 2px;
      width: fit-content;
    }
    .quote-box {
      background: #FDF7F0;
      border-left: 4px solid #BA4A22;
      border-radius: 0 12px 12px 0;
      padding: 12px 14px;
      font-style: italic;
      color: #555;
      font-size: 0.95rem;
      line-height: 1.4;
      margin-bottom: 16px;
    }
    .address-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 0.85rem;
      color: #BA4A22;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .map-preview {
      width: 100%;
      height: 150px;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid #EEDCD0;
      margin-bottom: 20px;
      background: #F5EAE0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .map-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 15px 20px;
      border-radius: 16px;
      text-decoration: none;
      font-weight: 800;
      font-size: 1.05rem;
      text-align: center;
      transition: all 0.2s ease;
      cursor: pointer;
      margin-bottom: 12px;
    }
    .btn-primary {
      background: #BA4A22;
      color: #ffffff;
      box-shadow: 0 6px 16px rgba(186, 74, 34, 0.35);
    }
    .btn-primary:active {
      transform: scale(0.98);
    }
    .btn-secondary {
      background: #F7EBE1;
      color: #BA4A22;
      border: 1.5px solid #EEDCD0;
    }
    .btn-secondary:active {
      transform: scale(0.98);
    }
    .footer-text {
      text-align: center;
      font-size: 0.8rem;
      color: #999;
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center;">
      <div class="top-badge">🐾 HESTEKA - SIGNALEMENT ANIMAL</div>
    </div>
    
    <div class="card">
      <div class="animal-title">${escapeHtml(data.animalName || "Signalement")}</div>
      
      <div class="media-row">
        <img class="animal-image" src="${image}" alt="${escapeHtml(title)}" onerror="this.src='https://res.cloudinary.com/dhlrjlqvv/image/upload/v1788122120/hesteka/image/dkuklfgwsge2nhxn340l.jpg';" />
        
        <div class="meta-col">
          <div class="author-row">
            ${data.authorImage ? `<img class="author-avatar" src="${data.authorImage}" alt="Auteur" />` : `<div class="author-avatar">👤</div>`}
            <div>
              <div class="author-name">${escapeHtml(data.authorName || "Membre Hesteka")}</div>
              ${data.eventDate ? `<div class="event-date">${escapeHtml(data.eventDate)}</div>` : ""}
            </div>
          </div>

          ${detailsList ? `<div class="details-text">${escapeHtml(detailsList)}</div>` : ""}
          <div class="status-pill">${escapeHtml(statusLabel)}</div>
        </div>
      </div>

      ${data.description ? `<div class="quote-box">${escapeHtml(data.description)}</div>` : ""}

      ${data.address ? `
      <div class="address-row">
        <span>📍</span>
        <span>${escapeHtml(data.address)}</span>
      </div>` : ""}

      ${mapImgUrl ? `
      <div class="map-preview">
        <img src="${mapImgUrl}" alt="Localisation" />
      </div>` : ""}

      <a id="openAppBtn" href="${data.customSchemeUrl}" class="btn btn-primary">
        📱 Ouvrir dans l'application
      </a>

      <a id="storeBtn" href="${data.playStoreUrl}" class="btn btn-secondary">
        ⬇️ Télécharger l'application Hesteka
      </a>

      <div class="footer-text">Hesteka - Ensemble pour nos animaux</div>
    </div>
  </div>

  <script>
    (function() {
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      var isAndroid = /Android/.test(navigator.userAgent);
      var storeBtn = document.getElementById('storeBtn');
      var openAppBtn = document.getElementById('openAppBtn');

      var fallbackUrl = encodeURIComponent("${data.playStoreUrl}");
      var androidIntentUrl = "intent://report/${data.id}#Intent;scheme=hesteka;package=com.emmafve.app;S.browser_fallback_url=" + fallbackUrl + ";end";
      var targetAppUrl = isAndroid ? androidIntentUrl : "${data.customSchemeUrl}";

      if (openAppBtn) {
        openAppBtn.href = targetAppUrl;
      }

      if (storeBtn) {
        if (isIOS) {
          storeBtn.href = "${data.appStoreUrl}";
          storeBtn.innerHTML = "🍏 Télécharger sur l'App Store";
        } else {
          storeBtn.href = "${data.playStoreUrl}";
          storeBtn.innerHTML = "🤖 Télécharger sur Google Play";
        }
      }

      // Automatically launch app via intent or fallback
      if (isAndroid) {
        window.location.replace(androidIntentUrl);
      } else if (isIOS) {
        window.location.replace("${data.customSchemeUrl}");
        setTimeout(function() {
          window.location.replace("${data.appStoreUrl}");
        }, 1500);
      }
    })();
  </script>
</body>
</html>`;
}

export function inviteShareTemplate(data: InviteShareData): string {
  const title = `Rejoignez-moi sur Hesteka ! Code: ${data.referralCode}`;
  const description = `Rejoignez notre communauté sur l'application Hesteka pour protéger et aider les animaux. Utilisez mon code de parrainage ${data.referralCode} pour recevoir vos points bonus !`;
  const image = "https://share.hesteka.com/assets/images/Logo/logo.png";
  const currentUrl = `https://share.hesteka.com/invite/${data.referralCode}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  
  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${currentUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${currentUrl}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(description)}">
  <meta property="twitter:image" content="${image}">

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8EFE4;
      background-image: linear-gradient(#EFE2D3 1px, transparent 1px), linear-gradient(90deg, #EFE2D3 1px, transparent 1px);
      background-size: 24px 24px;
      color: #333333;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px 12px;
    }
    .container {
      max-width: 480px;
      width: 100%;
    }
    .card {
      background: #FFFDF9;
      border: 2px solid #BA4A22;
      border-radius: 28px;
      box-shadow: 0 12px 36px rgba(186, 74, 34, 0.12);
      overflow: hidden;
      padding: 32px 24px;
      text-align: center;
    }
    .icon {
      font-size: 3.5rem;
      margin-bottom: 12px;
    }
    .title {
      font-size: 1.6rem;
      font-weight: 900;
      color: #BA4A22;
      margin-bottom: 12px;
    }
    .subtitle {
      font-size: 0.95rem;
      color: #666;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .code-box {
      background: #F5EAE0;
      border: 2px dashed #BA4A22;
      border-radius: 18px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .code-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      color: #888;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .code-value {
      font-size: 2rem;
      font-weight: 900;
      color: #BA4A22;
      letter-spacing: 2px;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 15px 20px;
      border-radius: 16px;
      text-decoration: none;
      font-weight: 800;
      font-size: 1.05rem;
      transition: all 0.2s ease;
      cursor: pointer;
      margin-bottom: 12px;
    }
    .btn-primary {
      background: #BA4A22;
      color: #ffffff;
      box-shadow: 0 6px 16px rgba(186, 74, 34, 0.35);
    }
    .btn-primary:active {
      transform: scale(0.98);
    }
    .btn-secondary {
      background: #F7EBE1;
      color: #BA4A22;
      border: 1.5px solid #EEDCD0;
    }
    .btn-secondary:active {
      transform: scale(0.98);
    }
    .footer-note {
      font-size: 0.8rem;
      color: #999;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">🎁 🐾</div>
      <div class="title">Invitation Hesteka</div>
      <div class="subtitle">
        Rejoignez notre communauté engagée pour la protection des animaux et gagnez des points dès votre inscription !
      </div>

      <div class="code-box">
        <div class="code-label">Code de parrainage</div>
        <div class="code-value">${escapeHtml(data.referralCode)}</div>
      </div>

      <a id="openAppBtn" href="${data.customSchemeUrl}" class="btn btn-primary">
        📱 Ouvrir dans l'application
      </a>

      <a id="storeBtn" href="${data.playStoreUrl}" class="btn btn-secondary">
        ⬇️ Installer Hesteka
      </a>

      <div class="footer-note">Hesteka - Ensemble pour nos animaux</div>
    </div>
  </div>

  <script>
    (function() {
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      var isAndroid = /Android/.test(navigator.userAgent);
      var storeBtn = document.getElementById('storeBtn');
      var openAppBtn = document.getElementById('openAppBtn');

      var fallbackUrl = encodeURIComponent("${data.playStoreUrl}");
      var androidIntentUrl = "intent://invite/${data.referralCode}#Intent;scheme=hesteka;package=com.emmafve.app;S.browser_fallback_url=" + fallbackUrl + ";end";
      var targetAppUrl = isAndroid ? androidIntentUrl : "${data.customSchemeUrl}";

      if (openAppBtn) {
        openAppBtn.href = targetAppUrl;
      }

      if (storeBtn) {
        if (isIOS) {
          storeBtn.href = "${data.appStoreUrl}";
          storeBtn.innerHTML = "🍏 Installer sur l'App Store";
        } else {
          storeBtn.href = "${data.playStoreUrl}";
          storeBtn.innerHTML = "🤖 Installer sur Google Play";
        }
      }

      // Automatically launch app via intent or fallback
      if (isAndroid) {
        window.location.replace(androidIntentUrl);
      } else if (isIOS) {
        window.location.replace("${data.customSchemeUrl}");
        setTimeout(function() {
          window.location.replace("${data.appStoreUrl}");
        }, 1500);
      }
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
