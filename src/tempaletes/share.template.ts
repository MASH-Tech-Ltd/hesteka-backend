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

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  
  <!-- Open Graph / Facebook / WhatsApp Preview -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${currentUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">

  <!-- Twitter Preview -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${currentUrl}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(description)}">
  <meta property="twitter:image" content="${image}">

  <style>
    body { margin: 0; padding: 0; background-color: #ffffff; }
  </style>
</head>
<body>
  <script>
    (function() {
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      var isAndroid = /Android/.test(navigator.userAgent);

      var fallbackUrl = encodeURIComponent("${data.playStoreUrl}");
      var androidIntentUrl = "intent://report/${data.id}#Intent;scheme=hesteka;package=com.emmafve.app;S.browser_fallback_url=" + fallbackUrl + ";end";

      if (isAndroid) {
        window.location.replace(androidIntentUrl);
      } else if (isIOS) {
        window.location.replace("${data.customSchemeUrl}");
        setTimeout(function() {
          window.location.replace("${data.appStoreUrl}");
        }, 1500);
      } else {
        window.location.replace("${data.playStoreUrl}");
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
  
  <!-- Open Graph / Facebook / WhatsApp Preview -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${currentUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">

  <!-- Twitter Preview -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${currentUrl}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(description)}">
  <meta property="twitter:image" content="${image}">

  <style>
    body { margin: 0; padding: 0; background-color: #ffffff; }
  </style>
</head>
<body>
  <script>
    (function() {
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      var isAndroid = /Android/.test(navigator.userAgent);

      var fallbackUrl = encodeURIComponent("${data.playStoreUrl}");
      var androidIntentUrl = "intent://invite/${data.referralCode}#Intent;scheme=hesteka;package=com.emmafve.app;S.browser_fallback_url=" + fallbackUrl + ";end";

      if (isAndroid) {
        window.location.replace(androidIntentUrl);
      } else if (isIOS) {
        window.location.replace("${data.customSchemeUrl}");
        setTimeout(function() {
          window.location.replace("${data.appStoreUrl}");
        }, 1500);
      } else {
        window.location.replace("${data.playStoreUrl}");
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
