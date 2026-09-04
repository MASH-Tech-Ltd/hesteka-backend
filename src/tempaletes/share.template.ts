interface ReportShareData {
  id: string;
  title: string;
  animalName: string;
  species?: string;
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
  const title = data.animalName ? `Hesteka - Signalement: ${data.animalName}` : (data.title || "Hesteka - Signalement d'animal");
  const description = data.description || "Consultez ce signalement d'animal sur l'application Hesteka.";
  const image = data.imageUrl || "https://share.hesteka.com/assets/images/Logo/logo.png";
  const currentUrl = `https://share.hesteka.com/report/${data.id}`;

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
      background-color: #FDF6ED;
      color: #333333;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }
    .card {
      background: #FFFFFF;
      max-width: 440px;
      width: 100%;
      border-radius: 24px;
      box-shadow: 0 10px 30px rgba(186, 74, 34, 0.1);
      overflow: hidden;
      text-align: center;
      border: 1px solid #EEDCD0;
    }
    .header {
      background: #BA4A22;
      color: white;
      padding: 20px;
      font-weight: bold;
      font-size: 1.2rem;
      letter-spacing: 0.5px;
    }
    .image-container {
      width: 100%;
      height: 240px;
      background-color: #F5EAE0;
      position: relative;
    }
    .image-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .content {
      padding: 24px 20px;
    }
    .animal-name {
      font-size: 1.6rem;
      font-weight: 800;
      color: #BA4A22;
      margin-bottom: 8px;
    }
    .description {
      font-size: 0.95rem;
      color: #666;
      line-height: 1.5;
      margin-bottom: 24px;
      max-height: 80px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px 20px;
      border-radius: 14px;
      text-decoration: none;
      font-weight: bold;
      font-size: 1rem;
      transition: all 0.2s ease;
      cursor: pointer;
      margin-bottom: 12px;
    }
    .btn-primary {
      background: #BA4A22;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(186, 74, 34, 0.3);
    }
    .btn-primary:hover {
      background: #9E3E1C;
    }
    .btn-secondary {
      background: #F5EAE0;
      color: #BA4A22;
      border: 1px solid #EEDCD0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-secondary:hover {
      background: #EEDCD0;
    }
    .store-buttons {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .footer-note {
      font-size: 0.8rem;
      color: #999;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">🐾 Hesteka - Protection Animale</div>
    <div class="image-container">
      <img src="${image}" alt="${escapeHtml(title)}" onerror="this.src='https://via.placeholder.com/440x240/BA4A22/FFFFFF?text=Hesteka'" />
    </div>
    <div class="content">
      <div class="animal-name">${escapeHtml(data.animalName || "Signalement")}</div>
      <div class="description">${escapeHtml(description)}</div>
      
      <a id="openAppBtn" href="${data.customSchemeUrl}" class="btn btn-primary">
        📱 Ouvrir dans l'application
      </a>

      <div class="store-buttons">
        <a id="storeBtn" href="${data.playStoreUrl}" class="btn btn-secondary">
          ⬇️ Télécharger l'application
        </a>
      </div>

      <div class="footer-note">Hesteka - Ensemble pour nos animaux</div>
    </div>
  </div>

  <script>
    (function() {
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      var isAndroid = /Android/.test(navigator.userAgent);
      var storeBtn = document.getElementById('storeBtn');
      var openAppBtn = document.getElementById('openAppBtn');

      var androidIntentUrl = "intent://report/${data.id}#Intent;scheme=hesteka;package=com.emmafve.app;end";
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

      // Automatically attempt to open the app
      setTimeout(function() {
        window.location.href = targetAppUrl;
      }, 300);
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
      background-color: #FDF6ED;
      color: #333333;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }
    .card {
      background: #FFFFFF;
      max-width: 440px;
      width: 100%;
      border-radius: 24px;
      box-shadow: 0 10px 30px rgba(186, 74, 34, 0.1);
      overflow: hidden;
      text-align: center;
      border: 1px solid #EEDCD0;
      padding: 32px 24px;
    }
    .icon {
      font-size: 3.5rem;
      margin-bottom: 12px;
    }
    .title {
      font-size: 1.5rem;
      font-weight: 800;
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
      border-radius: 16px;
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
      font-size: 1.8rem;
      font-weight: 900;
      color: #BA4A22;
      letter-spacing: 2px;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px 20px;
      border-radius: 14px;
      text-decoration: none;
      font-weight: bold;
      font-size: 1rem;
      transition: all 0.2s ease;
      cursor: pointer;
      margin-bottom: 12px;
    }
    .btn-primary {
      background: #BA4A22;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(186, 74, 34, 0.3);
    }
    .btn-primary:hover {
      background: #9E3E1C;
    }
    .btn-secondary {
      background: #F5EAE0;
      color: #BA4A22;
      border: 1px solid #EEDCD0;
    }
    .btn-secondary:hover {
      background: #EEDCD0;
    }
    .footer-note {
      font-size: 0.8rem;
      color: #999;
      margin-top: 16px;
    }
  </style>
</head>
<body>
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

  <script>
    (function() {
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      var isAndroid = /Android/.test(navigator.userAgent);
      var storeBtn = document.getElementById('storeBtn');
      var openAppBtn = document.getElementById('openAppBtn');

      var androidIntentUrl = "intent://invite/${data.referralCode}#Intent;scheme=hesteka;package=com.emmafve.app;end";
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

      // Automatically attempt to open the app
      setTimeout(function() {
        window.location.href = targetAppUrl;
      }, 300);
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
