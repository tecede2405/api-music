const webpush = require("web-push");
const subscriptionRepository = require("../repositories/subscription.repository");

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (!vapidConfigured && process.env.PUBLIC_VAPID_KEY && process.env.PRIVATE_VAPID_KEY) {
    webpush.setVapidDetails(
      "mailto:you@example.com",
      process.env.PUBLIC_VAPID_KEY,
      process.env.PRIVATE_VAPID_KEY
    );
    vapidConfigured = true;
  }
}

class NotificationService {
  async subscribe(subscriptionData) {
    const exists = await subscriptionRepository.findByEndpoint(subscriptionData.endpoint);
    if (!exists) {
      await subscriptionRepository.create(subscriptionData);
    }
  }

  async sendToAll({ title, body, icon }) {
    ensureVapidConfigured();
    const payload = JSON.stringify({ title, body, icon });
    const subscriptions = await subscriptionRepository.findAll();
    for (const sub of subscriptions) {
      await webpush.sendNotification(sub, payload).catch(console.error);
    }
  }
}

module.exports = new NotificationService();