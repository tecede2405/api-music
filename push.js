const webpush = require("web-push");

webpush.setVapidDetails(
  "mailto:you@example.com",
  process.env.PUBLIC_VAPID_KEY,
  process.env.PRIVATE_VAPID_KEY
);

const Subscription = require("./models/Subscription");

async function addSubscription(sub) {
  const exists = await Subscription.findOne({ endpoint: sub.endpoint });
  if (!exists) {
    await Subscription.create(sub);
  }
}

async function getSubscriptions() {
  return await Subscription.find();
}

module.exports = { webpush, addSubscription, getSubscriptions };
