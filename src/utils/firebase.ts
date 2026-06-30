import admin from 'firebase-admin';
import config from '../config';

export const initFirebase = () => {
  if (!config.firebase.projectId || !config.firebase.privateKey || !config.firebase.clientEmail) {
    console.warn("⚠️ Firebase configuration missing! FCM Push Notifications will be gracefully disabled until environment variables are set.");
    return;
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebase.projectId,
          clientEmail: config.firebase.clientEmail,
          privateKey: config.firebase.privateKey,
        }),
      });
      console.log('✅ Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    console.error(' Failed to initialize Firebase Admin:', error);
  }
};

export const sendPushNotification = async (tokens: string[], title: string, body: string, data?: any) => {
  if (!admin.apps.length) return; // Silent abort if not initialized
  if (!tokens || tokens.length === 0) return;

  // Deduplicate tokens to avoid sending the same notification twice
  const uniqueTokens = [...new Set(tokens)];

  try {
    const payload = {
      notification: {
        title,
        body,
      },
      // apns config: ensures iOS shows notification even when app is in background/terminated
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            badge: 1,
            sound: 'default',
            'content-available': 1,
          },
        },
        headers: {
          'apns-priority': '10',
        },
      },
      // android config: ensures heads-up notification on Android
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'high_importance_channel',
          sound: 'default',
          priority: 'high' as const,
          defaultVibrateTimings: true,
        },
      },
      data: data
        ? Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          )
        : {},
      tokens: uniqueTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(payload);

    console.log(`[FCM] Sent to ${uniqueTokens.length} token(s). Success: ${response.successCount}, Failed: ${response.failureCount}`);

    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const token = uniqueTokens[idx];
          const errorCode = resp.error?.code ?? 'unknown';
          const errorMsg = resp.error?.message ?? 'No message';
          console.warn(`[FCM] ❌ Token[${idx}] failed. Code: ${errorCode} | Msg: ${errorMsg} | Token: ${token?.slice(0, 20)}...`);

          // These codes indicate the token is expired/invalid and should be purged
          const invalidTokenCodes = [
            'messaging/invalid-registration-token',
            'messaging/registration-token-not-registered',
            'messaging/invalid-argument',
          ];
          if (token && invalidTokenCodes.includes(errorCode)) {
            failedTokens.push(token);
          }
        }
      });

      if (failedTokens.length > 0) {
        console.log(`[FCM] Removing ${failedTokens.length} expired/invalid token(s) from database...`);
        try {
          const { userModel } = require('../modules/usersAuth/user.models');
          await userModel.updateMany(
            { fcmTokens: { $in: failedTokens } },
            { $pullAll: { fcmTokens: failedTokens } }
          );
          console.log('[FCM] ✅ Cleaned up expired/failed FCM tokens from database');
        } catch (dbError) {
          console.error('[FCM] ⚠️ Failed to clean up FCM tokens:', dbError);
        }
      }
    }
  } catch (error) {
    console.error('[FCM] Error sending FCM Broadcast:', error);
  }
};
