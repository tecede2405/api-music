const Subscription = require("../models/Subscription");

class SubscriptionRepository {
  async create(data) {
    return await Subscription.create(data);
  }

  async findByEndpoint(endpoint) {
    return await Subscription.findOne({ endpoint });
  }

  async findAll() {
    return await Subscription.find();
  }
}

module.exports = new SubscriptionRepository();