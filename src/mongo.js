const { MongoClient } = require('mongodb');
const assert = require('assert');

require('dotenv').config();

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}${process.env.DB_HOST}/test?retryWrites=true`;

const getTelegramAccounts = async () => {
  // Collect a list of influencers with youtube accounts
  let accounts;
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db(process.env.DB_NAME);
    const col = db.collection(process.env.DB_COLLECTION);
    accounts = await col.find({ $or: [{ telegram_group: { $gt: '' } }, { telegram_channel: { $gt: '' } }] })
      .project({ telegram_group: 1, telegram_channel: 1 }).toArray();
    client.close();
  } catch (e) {
    console.error(e);
  }
  return accounts;
};

const updateTelegramStats = async (account) => {
  // Update telegram stats in the database
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db(process.env.DB_NAME);
    const col = db.collection(process.env.DB_COLLECTION);
    const {
      tgGroupSubscribers,
      tgGroupPostReach,
      tgGroupDailyReach,
      tgGroupPostsPerDay,
      tgGroupErr,
      tgGroupStatus,
      tgChannelSubscribers,
      tgChannelPostReach,
      tgChannelDailyReach,
      tgChannelPostsPerDay,
      tgChannelErr,
      tgChannelStatus,
    } = account || {};
    if ((account.telegram_channel && tgChannelStatus !== 'OK')
    || (account.telegram_group && tgGroupStatus !== 'OK')) {
      col.updateOne(
        { _id: account._id }, {
          $set: {
            tg_group_status: tgGroupStatus,
            tg_channel_status: tgChannelStatus,
            tg_updated: Date.now(),
          },
        }, (err, result) => {
          assert.equal(err, null);
          assert.equal(1, result.result.n);
        },
      );
    } else {
      col.updateOne(
        { _id: account._id }, {
          $set: {
            tg_group_subscribers: tgGroupSubscribers,
            tg_group_post_reach: tgGroupPostReach,
            tg_group_daily_reach: tgGroupDailyReach,
            tg_group_posts_per_day: tgGroupPostsPerDay,
            tg_group_err: tgGroupErr,
            tg_group_status: tgGroupStatus,
            tg_channel_subscribers: tgChannelSubscribers,
            tg_channel_post_reach: tgChannelPostReach,
            tg_channel_daily_reach: tgChannelDailyReach,
            tg_channel_posts_per_day: tgChannelPostsPerDay,
            tg_channel_err: tgChannelErr,
            tg_channel_status: tgChannelStatus,
            tg_updated: Date.now(),
          },
        }, (err, result) => {
          assert.equal(err, null);
          assert.equal(1, result.result.n);
        },
      );
    }
    client.close();
  } catch (e) {
    console.error(e);
  }
};

module.exports = {
  getTelegramAccounts,
  updateTelegramStats,
};
