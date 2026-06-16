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

  try {
    const payload = {
      notification: {
        title,
        body,
      },
      data: data || {}, // Optional data payload
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(payload);

    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const token = tokens[idx];
          if (token) failedTokens.push(token);
        }
      });
      console.log(' Failed to send FCM push to tokens:', failedTokens);
    }
  } catch (error) {
    console.error(' Error sending FCM Broadcast:', error);
  }
};
