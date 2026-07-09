const Song = require("../models/Song");

class SongRepository {
  async create(data) {
    return await Song.create(data);
  }

  async findAll() {
    return await Song.find();
  }

  async findById(id) {
    return await Song.findById(id);
  }

  async findByCategory(category) {
    return await Song.find({ category }).sort({ createdAt: -1 });
  }

  async updateById(id, data) {
    return await Song.findByIdAndUpdate(id, data, { new: true });
  }

  async incrementListens(id) {
    return await Song.findByIdAndUpdate(
      id,
      { $inc: { listens: 1 } },
      { new: true }
    );
  }

  async deleteById(id) {
    return await Song.findByIdAndDelete(id);
  }

  async getTotalListens() {
    const result = await Song.aggregate([
      { $group: { _id: null, totalListens: { $sum: "$listens" } } },
    ]);
    return result[0]?.totalListens || 0;
  }
}

module.exports = new SongRepository();