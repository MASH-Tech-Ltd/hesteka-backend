import { Types } from "mongoose";
import { notificationModel } from "./notification.models";
import { userModel } from "../usersAuth/user.models";
import { NotificationType } from "./notification.interface";
import { sendPushNotification } from "../../utils/firebase";
import { getIo } from "../../socket/server";
import { paginationHelper } from "../../utils/pagination";
import { settingsModel } from "../settings/settings.models";

function translatePushNotification(title: string, body: string, language: string): { title: string; body: string } {
  if (language === 'en') {
    let enTitle = title;
    let enBody = body;

    // French -> English Title Mapping
    const titleMappings: Record<string, string> = {
      'Nouvelle story': 'New Story',
      'Nouveau signalement !': 'New Report!',
      'Nouveau signalement à proximité !': 'New Report Nearby!',
      'Nouveau signalement créé': 'New Report Created',
      'Nouvelle mission locale': 'New Local Mission',
      'Nouvelle mission locale disponible !': 'New Local Mission Available!',
      'Points gagnés !': 'Points Gained!',
      'Points reçus !': 'Points Gained!',
      'Mission annulée': 'Mission Cancelled',
      'Soutien approuvé !': 'Support Approved!',
      'Preuve de soutien refusée': 'Support Proof Rejected',
      'Inscription enregistrée': 'Registration Registered',
      'Nouveau participant !': 'New Participant!',
      'Alerte Admin': 'Admin Alert',
      'Mission non validée': 'Mission not approved',
      'Notification Système': 'System Notification',
      'Compte mis à jour': 'Account Updated',
      'Nouveau commentaire': 'New Comment',
      'Nouvelle réponse': 'New Reply',
      'Statut de récompense mis à jour': 'Reward Status Updated',
      'Nouveau paiement reçu': 'New Payment Received',
      'Nouvelle preuve de soutien': 'New Support Proof',
      'Nouveau partenaire inscrit': 'New Partner Registered',
      "Demande d'ami reçue": 'Friend Request Received',
      "Demande d'ami acceptée": 'Friend Request Accepted',
      'Récompense expédiée !': 'Reward Shipped!',
      'Récompense livrée !': 'Reward Delivered!',
      'Carte cadeau envoyée !': 'Gift Card Sent!',
      'Échange refusé': 'Redemption Refused'
    };

    if (titleMappings[title]) {
      enTitle = titleMappings[title];
    }

    // French -> English Body String Replacement Mapping
    const bodyMappings: [string | RegExp, string][] = [
      [/Vous avez reçu (\d+) points de la part de l'administrateur/g, "You received $1 points from the administrator"],
      ["vient d'ajouter une nouvelle story !", "just added a new story!"],
      ["Votre ami a créé un nouveau signalement", "Your friend created a new report"],
      ["Une nouvelle mission", "A new mission"],
      ["vient d'être créée près de chez vous. Participez et gagnez des points !", "was just created near you. Participate and earn points!"],
      ["Un nouveau signalement", "A new report"],
      ["vient d'être créé près de chez vous.", "was just created near you."],
      ["nécessite votre attention.", "requires your attention."],
      ["Le partenaire", "Partner"],
      ["a créé une nouvelle mission", "created a new mission"],
      ["Félicitations ! Vous avez gagné", "Congratulations! You earned"],
      ["points pour votre participation à la mission", "points for participating in the mission"],
      ["La mission locale", "The local mission"],
      ["a été annulée par le partenaire.", "has been cancelled by the partner."],
      ["Votre preuve de soutien de", "Your support proof of"],
      ["a été approuvée.", "has been approved."],
      ["Vous avez gagné", "You earned"],
      ["Votre preuve de soutien a été refusée. Raison :", "Your support proof has been rejected. Reason:"],
      ["Votre inscription à la mission", "Your registration for the mission"],
      ["a été enregistrée avec succès.", "has been successfully registered."],
      ["L'utilisateur", "The user"],
      ["s'est inscrit à votre mission", "has registered for your mission"],
      ["Votre participation à la mission", "Your participation in the mission"],
      ["n'a pas été validée.", "was not approved."],
      ["Votre compte a été mis à jour avec succès.", "Your account has been successfully updated."],
      ["a commenté votre signalement", "commented on your report"],
      ["a répondu à votre commentaire.", "replied to your comment."],
      ["Le statut de votre échange de récompense a été mis à jour.", "The status of your reward exchange has been updated."],
      ["Un nouveau paiement a été enregistré. Merci pour votre soutien !", "A new payment has been registered. Thank you for your support!"],
      ["Une nouvelle preuve de soutien de", "A new support proof of"],
      ["unités a été soumise et nécessite une approbation.", "units has been submitted and requires approval."],
      ["Un nouveau partenaire a rejoint la communauté Hesteka.", "A new partner has joined the Hesteka community."],
      ["vous a envoyé une demande d'ami.", "sent you a friend request."],
      ["a accepté votre demande d'ami.", "accepted your friend request."],
      ["Bonne nouvelle ! Votre récompense a été expédiée et est en route.", "Good news! Your reward has been shipped and is on its way."],
      ["Votre récompense a été livrée. Profitez-en bien !", "Your reward has been delivered. Enjoy!"],
      ["Bonne nouvelle ! Votre code de carte cadeau a été envoyé par e-mail. Vérifiez votre boîte de réception !", "Good news! Your gift card code has been sent via email. Check your inbox!"],
      ["Votre demande d'échange de récompense a été refusée. Les points ont été remboursés sur votre solde.", "Your reward redemption request has been refused. The points have been refunded to your balance."]
    ];

    bodyMappings.forEach(([frStr, enStr]) => {
      if (typeof frStr === 'string') {
        enBody = enBody.split(frStr).join(enStr);
      } else {
        enBody = enBody.replace(frStr, enStr);
      }
    });

    return { title: enTitle, body: enBody };
  }

  let frTitle = title;
  let frBody = body;

  // Title translations (English -> French)
  if (title === 'New Story') {
    frTitle = 'Nouvelle story';
  } else if (title === 'New Report!') {
    frTitle = 'Nouveau signalement !';
  } else if (title === 'New Report Nearby!') {
    frTitle = 'Nouveau signalement à proximité !';
  } else if (title === 'New Report Created') {
    frTitle = 'Nouveau signalement créé';
  } else if (title === 'New Local Mission') {
    frTitle = 'Nouvelle mission locale';
  } else if (title === 'New Local Mission Available!') {
    frTitle = 'Nouvelle mission locale disponible !';
  } else if (title === 'Points Gained!') {
    frTitle = 'Points gagnés !';
  } else if (title === 'Mission Cancelled') {
    frTitle = 'Mission annulée';
  } else if (title === 'Support Approved!') {
    frTitle = 'Soutien approuvé !';
  } else if (title === 'Support Proof Rejected') {
    frTitle = 'Preuve de soutien refusée';
  } else if (title === 'Registration Registered') {
    frTitle = 'Inscription enregistrée';
  } else if (title === 'New Participant!') {
    frTitle = 'Nouveau participant !';
  } else if (title === 'Admin Alert') {
    frTitle = 'Alerte Admin';
  } else if (title === 'Mission not approved') {
    frTitle = 'Mission non validée';
  } else if (title === 'System Notification') {
    frTitle = 'Notification Système';
  } else if (title === 'Account Updated') {
    frTitle = 'Compte mis à jour';
  } else if (title === 'New Comment') {
    frTitle = 'Nouveau commentaire';
  } else if (title === 'New Reply') {
    frTitle = 'Nouvelle réponse';
  } else if (title === 'Reward Status Updated') {
    frTitle = 'Statut de récompense mis à jour';
  } else if (title === 'New Payment Received') {
    frTitle = 'Nouveau paiement reçu';
  } else if (title === 'New Support Proof') {
    frTitle = 'Nouvelle preuve de soutien';
  } else if (title === 'New Partner Registered') {
    frTitle = 'Nouveau partenaire inscrit';
  } else if (title === 'Friend Request Received') {
    frTitle = "Demande d'ami reçue";
  } else if (title === 'Friend Request Accepted') {
    frTitle = "Demande d'ami acceptée";
  }

  // Body translations
  if (body.includes('just added a new story!')) {
    frBody = body.replace('just added a new story!', "vient d'ajouter une nouvelle story !");
  } else if (body.includes('created a new report')) {
    frBody = body.replace('Your friend created a new report', 'Votre ami a créé un nouveau signalement');
  } else if (body.includes('was just created near you')) {
    if (body.includes('mission')) {
      frBody = body.replace('A new mission', 'Une nouvelle mission')
                   .replace('was just created near you. Participate and earn points!', "vient d'être créée près de chez vous. Participez et gagnez des points !");
    } else {
      frBody = body.replace('A new report', 'Un nouveau signalement')
                   .replace('was just created near you.', "vient d'être créé près de chez vous.");
    }
  } else if (body.includes('requires your attention')) {
    frBody = body.replace('A new report', 'Un nouveau signalement')
                 .replace('requires your attention.', 'nécessite votre attention.');
  } else if (body.includes('created a new mission')) {
    frBody = body.replace('Partner', 'Le partenaire')
                 .replace('created a new mission', 'a créé une nouvelle mission');
  } else if (body.includes('You earned') && body.includes('points for participating')) {
    frBody = body.replace('Congratulations! You earned', 'Félicitations ! Vous avez gagné')
                 .replace('points for participating in the mission', 'points pour votre participation à la mission');
  } else if (body.includes('has been cancelled by the partner')) {
    frBody = body.replace('The local mission', 'La mission locale')
                 .replace('has been cancelled by the partner.', "a été annulée par le partenaire.");
  } else if (body.includes('Your support proof') && body.includes('approved')) {
    frBody = body.replace('Your support proof of', 'Votre preuve de soutien de')
                 .replace('has been approved.', 'a été approuvée.')
                 .replace('You earned', 'Vous avez gagné')
                 .replace('points.', 'points.');
  } else if (body.includes('Your support proof has been rejected. Reason:')) {
    frBody = body.replace('Your support proof has been rejected. Reason:', 'Votre preuve de soutien a été refusée. Raison :');
  } else if (body.includes('Your registration for the mission') && body.includes('successfully registered')) {
    frBody = body.replace('Your registration for the mission', "Votre inscription à la mission")
                 .replace('has been successfully registered.', "a été enregistrée avec succès.");
  } else if (body.includes('has registered for your mission')) {
    frBody = body.replace('The user', "L'utilisateur")
                 .replace('has registered for your mission', "s'est inscrit à votre mission");
  } else if (body.includes('Your participation in the mission') && body.includes('was not approved')) {
    frBody = body.replace('Your participation in the mission', "Votre participation à la mission")
                 .replace('was not approved.', "n'a pas été validée.");
  } else if (body.includes('Your account has been successfully updated.')) {
    frBody = 'Votre compte a été mis à jour avec succès.';
  } else if (body.includes('commented on your report')) {
    frBody = body.replace('commented on your report', 'a commenté votre signalement');
  } else if (body.includes('replied to your comment.')) {
    frBody = body.replace('replied to your comment.', 'a répondu à votre commentaire.');
  } else if (body.includes('status of your reward exchange has been updated.')) {
    frBody = "Le statut de votre échange de récompense a été mis à jour.";
  } else if (body.includes('A new payment has been registered.')) {
    frBody = 'Un nouveau paiement a été enregistré. Merci pour votre soutien !';
  } else if (body.includes('A new support proof') && body.includes('requires approval.')) {
    frBody = body.replace('A new support proof of', 'Une nouvelle preuve de soutien de')
                 .replace('units has been submitted and requires approval.', 'unités a été soumise et nécessite une approbation.');
  } else if (body.includes('A new partner has joined the Hesteka community.')) {
    frBody = 'Un nouveau partenaire a rejoint la communauté Hesteka.';
  } else if (body.includes('sent you a friend request.')) {
    frBody = body.replace('sent you a friend request.', "vous a envoyé une demande d'ami.");
  } else if (body.includes('accepted your friend request.')) {
    frBody = body.replace('accepted your friend request.', "a accepté votre demande d'ami.");
  }

  // Dynamic replacements for animal types & statuses (Lost Cat, Found Dog, etc.) inside the title/body
  const animalReplacements: [RegExp, string][] = [
    [/\bLost Cat\b/gi, 'Chat perdu'],
    [/\bLost Dog\b/gi, 'Chien perdu'],
    [/\bLost Bird\b/gi, 'Oiseau perdu'],
    [/\bLost Other\b/gi, 'Autre animal perdu'],
    [/\bFound Cat\b/gi, 'Chat trouvé'],
    [/\bFound Dog\b/gi, 'Chien trouvé'],
    [/\bFound Bird\b/gi, 'Oiseau trouvé'],
    [/\bFound Other\b/gi, 'Autre animal trouvé'],
    [/\bRescued Cat\b/gi, 'Chat secouru'],
    [/\bRescued Dog\b/gi, 'Chien secouru'],
    [/\bRescued Bird\b/gi, 'Oiseau secouru'],
    [/\bRescued Other\b/gi, 'Autre animal secouru'],
    [/\bSighted Cat\b/gi, 'Chat aperçu'],
    [/\bSighted Dog\b/gi, 'Chien aperçu'],
    [/\bSighted Bird\b/gi, 'Oiseau aperçu'],
    [/\bSighted Other\b/gi, 'Autre animal aperçu'],
    // Fallbacks just in case
    [/\bLost\b/g, 'Perdu'],
    [/\bFound\b/g, 'Trouvé'],
    [/\bRescued\b/g, 'Secouru'],
    [/\bSighted\b/g, 'Aperçu'],
    [/\bCat\b/g, 'Chat'],
    [/\bDog\b/g, 'Chien'],
    [/\bBird\b/g, 'Oiseau']
  ];

  animalReplacements.forEach(([regex, replacement]) => {
    frTitle = frTitle.replace(regex, replacement);
    frBody = frBody.replace(regex, replacement);
  });

  return { title: frTitle, body: frBody };
}

export const notificationService = {
  async getUserNotifications(userId: string, pageQuery?: any, limitQuery?: any) {
    const { page, limit, skip } = paginationHelper(pageQuery, limitQuery);

    const [notifications, total] = await Promise.all([
      notificationModel
        .find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      notificationModel.countDocuments({ user: userId }),
    ]);

    const unreadCount = await notificationModel.countDocuments({ user: userId, isRead: false });

    return {
      notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  },

  async getAllAdminNotifications(pageQuery?: any, limitQuery?: any) {
    const { page, limit, skip } = paginationHelper(pageQuery, limitQuery);

    const [notifications, total] = await Promise.all([
      notificationModel
        .find()
        .populate("user", "firstName lastName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      notificationModel.countDocuments(),
    ]);

    return {
      notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getTargetedAdminNotifications(pageQuery?: any, limitQuery?: any, search?: string) {
    const { page, limit, skip } = paginationHelper(pageQuery, limitQuery);

    const filter: any = { title: "Message de l'Administrateur", type: NotificationType.SYSTEM };
    
    if (search) {
      const users = await userModel.find({
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ]
      }).select("_id");
      const userIds = users.map(u => u._id);
      filter.user = { $in: userIds };
    }

    const [notifications, total] = await Promise.all([
      notificationModel
        .find(filter)
        .populate("user", "firstName lastName email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      notificationModel.countDocuments(filter),
    ]);

    return {
      notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async markAsRead(userId: string, notificationId: string, role?: string) {
    const query: any = { _id: notificationId };
    if (role !== "ADMIN" && role !== "admin") {
      query.user = userId;
    }
    return notificationModel.findOneAndUpdate(
      query,
      { isRead: true },
      { returnDocument: 'after' }
    );
  },
  
  async markAllAsRead(userId: string) {
    return notificationModel.updateMany(
      { user: userId, isRead: false },
      { isRead: true }
    );
  },

  async deleteNotification(userId: string, notificationId: string) {
    const result = await notificationModel.deleteOne({ _id: notificationId, user: userId });
    return result.deletedCount > 0;
  },

  async notifyUsersNearby(title: string, body: string, type: NotificationType, lat?: number, lng?: number, radiusKm: number = 15, data?: Record<string, any>) {
    try {
      const settings = await settingsModel.findOne();
      const actualRadius = settings?.alertRadius || 5;

      let filter: any = { status: "active" };

      if (lat !== undefined && lng !== undefined) {
        console.log(`[Notification Service] Filtering for active users/partners within ${actualRadius}km of [${lat}, ${lng}] and ALL admins...`);
        filter.$or = [
          {
            role: { $in: ["user", "partner"] },
            location: {
              $geoWithin: {
                $centerSphere: [[lng, lat], actualRadius / 6378.1],
              },
            },
          },
          {
            role: "admin",
          }
        ];
      } else {
        console.log(`[Notification Service] No event coordinates provided. Broadcasting to ALL active users/partners/admins.`);
        filter.role = { $in: ["user", "partner", "admin"] };
      }

      const usersNearby = await userModel.find(filter).select("_id fcmTokens firstName lastName email location role language");

      console.log(`[Notification Service] Found ${usersNearby.length} target users.`);

      if (!usersNearby.length) {
        console.log(`[Notification Service] Aborting. Reason: No users found within radius. Ensure testing user has a 'location' saved in the DB!`);
        return;
      }

      const notificationsToSave = usersNearby.map(u => ({
        user: u._id,
        title,
        description: body,
        type,
        isRead: false,
        ...(data ? { data } : {}),
      }));

      // 1. Save to database
      const savedNotifications = await notificationModel.insertMany(notificationsToSave);

      // Extract FCM tokens and prepare Socket logic
      const englishTokens: string[] = [];
      const frenchTokens: string[] = [];
      let successLog: string[] = [];
      let failLog: string[] = [];
      let io: any; // using any to bypass strict type here easily, or import Server
      try {
        io = getIo();
      } catch (err) {
        // Socket may not be initialized or caught error
      }

      for (let idx = 0; idx < usersNearby.length; idx++) {
        const user = usersNearby[idx];
        if (!user) continue;

        const userIdStr = user._id.toString();
        
        let distanceStr = "";
        if (lat !== undefined && lng !== undefined) {
          if (user.location?.coordinates && Array.isArray(user.location.coordinates) && user.location.coordinates.length >= 2) {
            const userLng = user.location.coordinates[0] as number;
            const userLat = user.location.coordinates[1] as number;
            const R = 6371; // Radius of the earth in km
            const dLat = (userLat - lat) * Math.PI / 180;
            const dLon = (userLng - lng) * Math.PI / 180;
            const a = 
              Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat * Math.PI / 180) * Math.cos(userLat * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
            const distKm = (R * c).toFixed(2);
            distanceStr = ` [${distKm}km away]`;
          } else if (user.role === 'admin') {
            distanceStr = ` [Admin: Global]`;
          } else {
            distanceStr = ` [Location Unknown]`;
          }
        }

        const userInfo = `${user.firstName || 'User'} ${user.lastName || ''} (${user.email || 'No email'})${distanceStr}`;
        let gotSocket = false;
        let gotFcm = false;

        if (io) {
          // Check if user has active sockets
          const sockets = await io.in(userIdStr).fetchSockets();
          if (sockets.length > 0) {
            io.to(userIdStr).emit("notification:new", savedNotifications[idx]);
            gotSocket = true;
          }
        }

        // Always collect FCM tokens for push notification
        if (user.fcmTokens && Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0) {
          if (user.language === "en") {
            englishTokens.push(...user.fcmTokens);
          } else {
            frenchTokens.push(...user.fcmTokens);
          }
          gotFcm = true;
        }

        if (gotSocket || gotFcm) {
          successLog.push(`${userInfo} -> [Socket: ${gotSocket ? 'Yes' : 'No'}, FCM: ${gotFcm ? 'Yes' : 'No'}]`);
        } else {
          failLog.push(`${userInfo}`);
        }
      }

      // 3. Send Push Notifications via FCM
      if (englishTokens.length > 0) {
        await sendPushNotification(englishTokens, title, body, { type, ...data });
      }
      if (frenchTokens.length > 0) {
        const translated = translatePushNotification(title, body, 'fr');
        await sendPushNotification(frenchTokens, translated.title, translated.body, { type, ...data });
      }

      console.log(`[Notification Service] notifyUsersNearby targeted ${usersNearby.length} users.`);
      if (successLog.length > 0) console.log(`   ✅ Sent to:\n      ${successLog.join('\n      ')}`);
      if (failLog.length > 0) console.log(`   ❌ Did NOT receive (No socket/FCM):\n      ${failLog.join('\n      ')}`);

    } catch (error) {
      console.error(" Failed in notifyUsersNearby:", error);
    }
  },

  async notifyUsersByRegion(region: string | "all", title: string, body: string, type: NotificationType, data?: Record<string, any>) {
    try {
      const filter: any = { role: "user", status: "active" };
      if (region !== "all") {
        filter.region = region;
      }
      const usersToNotify = await userModel.find(filter).select("_id fcmTokens firstName lastName email language");
      
      if (!usersToNotify.length) return;

      const notificationsToSave = usersToNotify.map(user => ({
        user: user._id,
        title,
        description: body,
        type,
        isRead: false,
        ...(data ? { data } : {}),
      }));

      const savedNotifications = await notificationModel.insertMany(notificationsToSave);

      const englishTokens: string[] = [];
      const frenchTokens: string[] = [];
      let successLog: string[] = [];
      let failLog: string[] = [];
      let io: any;
      try {
        io = getIo();
      } catch (err) { }

      for (let idx = 0; idx < usersToNotify.length; idx++) {
        const user = usersToNotify[idx] as any;
        if (!user) continue;

        const userIdStr = user._id.toString();
        const userInfo = `${user.firstName || 'User'} ${user.lastName || ''} (${user.email || 'No email'})`;
        let gotSocket = false;
        let gotFcm = false;

        if (io) {
          const sockets = await io.in(userIdStr).fetchSockets();
          if (sockets.length > 0) {
            io.to(userIdStr).emit("notification:new", savedNotifications[idx]);
            gotSocket = true;
          }
        }

        if (user.fcmTokens && Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0) {
          if (user.language === "en") {
            englishTokens.push(...user.fcmTokens);
          } else {
            frenchTokens.push(...user.fcmTokens);
          }
          gotFcm = true;
        }

        if (gotSocket || gotFcm) {
          successLog.push(`${userInfo} -> [Socket: ${gotSocket ? 'Yes' : 'No'}, FCM: ${gotFcm ? 'Yes' : 'No'}]`);
        } else {
          failLog.push(`${userInfo}`);
        }
      }

      if (englishTokens.length > 0) {
        await sendPushNotification(englishTokens, title, body, { type, ...data });
      }
      if (frenchTokens.length > 0) {
        const translated = translatePushNotification(title, body, 'fr');
        await sendPushNotification(frenchTokens, translated.title, translated.body, { type, ...data });
      }

      console.log(`[Notification Service] notifyUsersByRegion (${region}) targeted ${usersToNotify.length} users.`);
      if (successLog.length > 0) console.log(`   ✅ Sent to:\n      ${successLog.join('\n      ')}`);
      if (failLog.length > 0) console.log(`   ❌ Did NOT receive (No socket/FCM):\n      ${failLog.join('\n      ')}`);

    } catch (error) {
      console.error(` Failed in notifyUsersByRegion (${region}):`, error);
    }
  },

  async notifySingleUser(userId: string, title: string, body: string, type: NotificationType, data?: Record<string, any>, saveToDb: boolean = true) {
    try {
      const user = await userModel.findById(userId).select("_id fcmTokens firstName lastName email language");
      if (!user) return;

      const notificationToSave = {
        _id: new Types.ObjectId(),
        user: user._id,
        title,
        description: body,
        type,
        isRead: false,
        createdAt: new Date(),
        ...(data ? { data } : {}),
      };

      const savedNotification = saveToDb ? await notificationModel.create(notificationToSave) : notificationToSave;

      let io: any;
      let socketSent = false;
      let fcmSent = false;
      try {
        io = getIo();
      } catch (err) { }

      if (io) {
        const userIdStr = user._id.toString();
        const sockets = await io.in(userIdStr).fetchSockets();
        if (sockets.length > 0) {
          io.to(userIdStr).emit("notification:new", savedNotification);
          socketSent = true;
        }
      }

      // Send Push Notifications via FCM
      if (user.fcmTokens && Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0) {
        const translated = translatePushNotification(title, body, user.language || 'fr');
        await sendPushNotification(user.fcmTokens, translated.title, translated.body, { type, ...data });
        fcmSent = true;
      }

      const userInfo = `${user.firstName || 'User'} ${user.lastName || ''} (${user.email || 'No email'})`;
      if (socketSent || fcmSent) {
        console.log(`[Notification Service] notifySingleUser ✅ Sent to: ${userInfo} -> [Socket: ${socketSent ? 'Yes' : 'No'}, FCM: ${fcmSent ? 'Yes' : 'No'}]`);
      } else {
        console.log(`[Notification Service] notifySingleUser ❌ Failed for: ${userInfo} (No active socket or FCM token)`);
      }

    } catch (error) {
      console.error(" Failed in notifySingleUser:", error);
    }
  },

  async notifyAdmins(title: string, body: string, type: NotificationType) {
    try {
      const admins = await userModel.find({ role: "admin", status: "active" }).select("_id fcmTokens firstName lastName email language");
      if (!admins.length) return;

      const notificationsToSave = admins.map(admin => ({
        user: admin._id,
        title,
        description: body,
        type,
        isRead: false,
      }));

      const savedNotifications = await notificationModel.insertMany(notificationsToSave);

      const englishTokens: string[] = [];
      const frenchTokens: string[] = [];
      let successLog: string[] = [];
      let failLog: string[] = [];
      let io: any;
      try {
        io = getIo();
      } catch (err) { }

      for (let idx = 0; idx < admins.length; idx++) {
        const admin = admins[idx];
        if (!admin) continue;
        
        const userIdStr = admin._id.toString();
        const userInfo = `${admin.firstName || 'Admin'} ${admin.lastName || ''} (${admin.email || 'No email'})`;
        let gotSocket = false;
        let gotFcm = false;

        if (io) {
          const sockets = await io.in(userIdStr).fetchSockets();
          if (sockets.length > 0) {
            io.to(userIdStr).emit("notification:new", savedNotifications[idx]);
            gotSocket = true;
          }
        }

        if (admin.fcmTokens && Array.isArray(admin.fcmTokens) && admin.fcmTokens.length > 0) {
          if (admin.language === "en") {
            englishTokens.push(...admin.fcmTokens);
          } else {
            frenchTokens.push(...admin.fcmTokens);
          }
          gotFcm = true;
        }

        if (gotSocket || gotFcm) {
          successLog.push(`${userInfo} -> [Socket: ${gotSocket ? 'Yes' : 'No'}, FCM: ${gotFcm ? 'Yes' : 'No'}]`);
        } else {
          failLog.push(`${userInfo}`);
        }
      }

      if (englishTokens.length > 0) {
        await sendPushNotification(englishTokens, title, body, { type });
      }
      if (frenchTokens.length > 0) {
        const translated = translatePushNotification(title, body, 'fr');
        await sendPushNotification(frenchTokens, translated.title, translated.body, { type });
      }

      console.log(`[Notification Service] notifyAdmins targeted ${admins.length} admins.`);
      if (successLog.length > 0) console.log(`   ✅ Sent to:\n      ${successLog.join('\n      ')}`);
      if (failLog.length > 0) console.log(`   ❌ Did NOT receive (No socket/FCM):\n      ${failLog.join('\n      ')}`);

    } catch (error) {
      console.error(" Failed in notifyAdmins:", error);
    }
  },
  async sendManualAdminAlert(geoTarget: string, userType: string, message: string) {
    const query: any = {};
    if (userType !== "all") {
      query.role = userType;
    } else {
      query.role = { $in: ["user", "partner"] };
    }

    if (geoTarget !== "all_france" && geoTarget !== "all") {
      if (geoTarget === "paca") {
        // PACA roughly around Marseille
        query.location = {
          $nearSphere: {
            $geometry: { type: "Point", coordinates: [5.3698, 43.2965] }, // Lng, Lat
            $maxDistance: 150000 // 150 km
          }
        };
      } else {
        // Dynamically match exact city string
        query.city = geoTarget;
      }
    }

    const targetUsers = await userModel.find(query).select("_id fcmTokens firstName lastName email language");

    if (!targetUsers || targetUsers.length === 0) return;

    const type = NotificationType.SYSTEM;
    const title = "Admin Alert";

    const notificationsToSave = targetUsers.map(u => ({
      user: u._id,
      title,
      description: message,
      type,
    }));

    const savedNotifications = await notificationModel.insertMany(notificationsToSave);

    const englishTokens: string[] = [];
    const frenchTokens: string[] = [];
    let successLog: string[] = [];
    let failLog: string[] = [];
    let io: any;
    try {
      io = getIo();
    } catch (err) {}

    for (let idx = 0; idx < targetUsers.length; idx++) {
      const u = targetUsers[idx];
      if (!u) continue;
      
      const userIdStr = u._id.toString();
      const userInfo = `${u.firstName || 'User'} ${u.lastName || ''} (${u.email || 'No email'})`;
      let gotSocket = false;
      let gotFcm = false;

      if (io) {
        const sockets = await io.in(userIdStr).fetchSockets();
        if (sockets.length > 0) {
          io.to(userIdStr).emit("notification:new", savedNotifications[idx]);
          gotSocket = true;
        }
      }

      if (u.fcmTokens && Array.isArray(u.fcmTokens) && u.fcmTokens.length > 0) {
        if (u.language === "en") {
          englishTokens.push(...u.fcmTokens);
        } else {
          frenchTokens.push(...u.fcmTokens);
        }
        gotFcm = true;
      }

      if (gotSocket || gotFcm) {
        successLog.push(`${userInfo} -> [Socket: ${gotSocket ? 'Yes' : 'No'}, FCM: ${gotFcm ? 'Yes' : 'No'}]`);
      } else {
        failLog.push(`${userInfo}`);
      }
    }

    if (englishTokens.length > 0) {
      await sendPushNotification(englishTokens, title, message, { type });
    }
    if (frenchTokens.length > 0) {
      const translated = translatePushNotification(title, message, 'fr');
      await sendPushNotification(frenchTokens, translated.title, translated.body, { type });
    }

    console.log(`[Notification Service] sendManualAdminAlert targeted ${targetUsers.length} users.`);
    if (successLog.length > 0) console.log(`   ✅ Sent to:\n      ${successLog.join('\n      ')}`);
    if (failLog.length > 0) console.log(`   ❌ Did NOT receive (No socket/FCM):\n      ${failLog.join('\n      ')}`);
  },

  async notifyFriends(userId: string, title: string, body: string, type: NotificationType, data?: Record<string, any>) {
    try {
      const { FriendModel } = await import("../friends/friend.models");
      const { FriendStatus } = await import("../friends/friend.interface");

      const relations = await FriendModel.find({
        $or: [{ requester: userId }, { recipient: userId }],
        status: FriendStatus.ACCEPTED
      }).populate("requester recipient", "_id fcmTokens firstName lastName email language");

      if (!relations.length) return;

      const friendsToNotify = relations.map(r => {
        return r.requester._id.toString() === userId.toString() ? r.recipient : r.requester;
      });

      const notificationsToSave = friendsToNotify.map(friend => ({
        user: friend._id,
        title,
        description: body,
        type,
        isRead: false,
        ...(data ? { data } : {}),
      }));

      const savedNotifications = await notificationModel.insertMany(notificationsToSave);

      const englishTokens: string[] = [];
      const frenchTokens: string[] = [];
      let successLog: string[] = [];
      let failLog: string[] = [];
      let io: any;
      try {
        io = getIo();
      } catch (err) { }

      for (let idx = 0; idx < friendsToNotify.length; idx++) {
        const friend = friendsToNotify[idx] as any;
        if (!friend) continue;

        const friendIdStr = friend._id.toString();
        const userInfo = `${friend.firstName || 'Friend'} ${friend.lastName || ''} (${friend.email || 'No email'})`;
        let gotSocket = false;
        let gotFcm = false;

        if (io) {
          const sockets = await io.in(friendIdStr).fetchSockets();
          if (sockets.length > 0) {
            io.to(friendIdStr).emit("notification:new", savedNotifications[idx]);
            gotSocket = true;
          }
        }

        if (friend.fcmTokens && Array.isArray(friend.fcmTokens) && friend.fcmTokens.length > 0) {
          if (friend.language === "en") {
            englishTokens.push(...friend.fcmTokens);
          } else {
            frenchTokens.push(...friend.fcmTokens);
          }
          gotFcm = true;
        }

        if (gotSocket || gotFcm) {
          successLog.push(`${userInfo} -> [Socket: ${gotSocket ? 'Yes' : 'No'}, FCM: ${gotFcm ? 'Yes' : 'No'}]`);
        } else {
          failLog.push(`${userInfo}`);
        }
      }

      if (englishTokens.length > 0) {
        await sendPushNotification(englishTokens, title, body, { type, ...data });
      }
      if (frenchTokens.length > 0) {
        const translated = translatePushNotification(title, body, 'fr');
        await sendPushNotification(frenchTokens, translated.title, translated.body, { type, ...data });
      }

      console.log(`[Notification Service] notifyFriends targeted ${friendsToNotify.length} friends.`);
      if (successLog.length > 0) console.log(`   ✅ Sent to:\n      ${successLog.join('\n      ')}`);
      if (failLog.length > 0) console.log(`   ❌ Did NOT receive (No socket/FCM):\n      ${failLog.join('\n      ')}`);
    } catch (error) {
      console.error(" Failed in notifyFriends:", error);
    }
  }
};
