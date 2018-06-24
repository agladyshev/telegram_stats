'use strict' 

const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const assert = require('assert');
const cheerio = require('cheerio');
const request = require('request-promise-native');

require('dotenv').config();

const port = process.env.PORT || 3000;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}${process.env.DB_HOST}/test?retryWrites=true`;

// MongoDB calls
const getAccounts = async (req, res, next) => {
    // Collect a list of influencers
    let accounts;
    try {
      const client = await MongoClient.connect(uri, { useNewUrlParser: true });
  
      const db = client.db(process.env.DB_NAME);
  
      const col = db.collection('influencers');
  
      accounts = await col.find({ $or: [{ telegram_group: { $gt: '' } }, { telegram_channel: { $gt: '' } }] })
      .project({ telegram_group: 1, telegram_channel: 1 }).toArray();
  
      client.close();
    } catch (e) {
      console.error(e);
    }
    res.body = accounts;
    next();
}

const updateMongoStats = async (account) => {
    console.log(account);
    // Update telegram stats in the database
    try {
        const client = await MongoClient.connect(uri, { useNewUrlParser: true });
        const db = client.db(process.env.DB_NAME);
        const col = db.collection('influencers');
        const {
            tg_group_subscribers,
            tg_group_post_reach,
            tg_group_daily_reach,
            tg_group_posts_per_day,
            tg_group_err,
            tg_group_status,
            tg_channel_subscribers,
            tg_channel_post_reach,
            tg_channel_daily_reach,
            tg_channel_posts_per_day,
            tg_channel_err,
            tg_channel_status,
        } = account || {};
        
        col.updateOne(
        { _id: account._id }
        , {
            $set: {
            tg_group_subscribers: tg_group_subscribers,
            tg_group_post_reach: tg_group_post_reach,
            tg_group_daily_reach: tg_group_daily_reach,
            tg_group_posts_per_day: tg_group_posts_per_day,
            tg_group_err: tg_group_err,
            tg_group_status: tg_group_status,
            tg_channel_subscribers: tg_channel_subscribers,
            tg_channel_post_reach: tg_channel_post_reach,
            tg_channel_daily_reach: tg_channel_daily_reach,
            tg_channel_posts_per_day: tg_channel_posts_per_day,
            tg_channel_err: tg_channel_err,
            tg_channel_status: tg_channel_status,
            tg_updated: Date.now(),
            }
        }, function(err, result) {
            assert.equal(err, null);
            assert.equal(1, result.result.n);
        });
        client.close();
    } catch (e) {
        console.error(e);
    }
}

// Middleware

const getHtml = async (req, res, next) => {
    // Fetch tgstat.ru stats for group AND/OR channel
    const accounts = res.body;

    Promise.all(accounts.map(async (account) => {
        if (account.telegram_channel) {
            await request(`https://en.tgstat.com/channel/@${account.telegram_channel}`)
            .then((body) => {
                const channelHTML = cheerio.load(body);
                account.tg_channel_subscribers = channelHTML('div.align-center:contains("subscribers")').prev().text().replace(/\s+/g, '');
                account.tg_channel_post_reach = channelHTML('div.align-center:contains("avg post reach")').prev().text().replace(/\s+/g, '').replace('~', '');
                account.tg_channel_daily_reach = channelHTML('div.align-center:contains("daily reach")').prev().text().replace(/\s+/g, '').replace('~', '');
                account.tg_channel_posts_per_day = channelHTML('div.align-center:contains("posts per day")').prev().text().replace(/\s+/g, '').replace('~', '');
                account.tg_channel_err = channelHTML('div.align-center:contains("ERR %")').prev().text().replace(/\s+/g, '').replace('~', '');
                account.tg_channel_status = 'OK';
            })
            .catch((err) => {
                account.tg_channel_subscribers = err.statusCode;
            })
        }
        if (account.telegram_group) {
            await request(`https://en.tgstat.com/channel/@${account.telegram_group}`)
            .then((body) => {
                const groupHTML = cheerio.load(body);
                account.tg_group_subscribers = groupHTML('div.align-center:contains("subscribers")').prev().text().replace(/\s+/g, '');
                account.tg_group_post_reach = groupHTML('div.align-center:contains("avg post reach")').prev().text().replace(/\s+/g, '').replace('~', '');
                account.tg_group_daily_reach = groupHTML('div.align-center:contains("daily reach")').prev().text().replace(/\s+/g, '').replace('~', '');
                account.tg_group_posts_per_day = groupHTML('div.align-center:contains("posts per day")').prev().text().replace(/\s+/g, '').replace('~', '');
                account.tg_group_err = groupHTML('div.align-center:contains("ERR %")').prev().text().replace(/\s+/g, '').replace('~', '');
                account.tg_group_status = 'OK';
            })
            .catch((err) => {
                account.tg_group_status = err.statusCode;
            })
        }
        return account;
    }))
    .then(updatedAccounts => {
      res.body = updatedAccounts;
      next();
    })
}

const updateTelegramStats = async (req, res, next) => {
    // Update DB with Telegram stats
    const accounts = res.body;
    Promise.all(accounts.map(updateMongoStats))
    .then(res => next())
    .catch(err => next(err))
}

const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader('cache-control', 'private, max-age=0, no-cache, no-store, must-revalidate');
  res.setHeader('expires', '0');
  res.setHeader('pragma', 'no-cache');
  next();
});

app.get('/', getAccounts, getHtml, updateTelegramStats, (req, res) => res.json(res.body));

app.listen(port, () => console.log(`Telegram module is listening on port ${port}!`));