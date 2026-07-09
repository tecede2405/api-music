const Storage = require("../models/Storage");

class StorageRepository {
  async create(data) {
    return await Storage.create(data);
  }

  async findAll() {
    return await Storage.find().sort({ createdAt: -1 });
  }

  async findById(id) {
    return await Storage.findById(id);
  }

  async deleteById(id) {
    return await Storage.findByIdAndDelete(id);
  }
}

module.exports = new StorageRepository();