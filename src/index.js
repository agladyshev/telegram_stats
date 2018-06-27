const express = require('express');
const bodyParser = require('body-parser');
const cheerio = require('cheerio');
const request = require('request-promise-native');
const mongo = require('./mongo');

require('dotenv').config();

const port = process.env.PORT || 3000;

const getTelegramAccounts = async (req, res, next) => {
  // Collect a list of influencers with telegram grouops or channels
  res.body = await mongo.getTelegramAccounts();
  next();
};

const parseHtml = async (html) => {
  const channelHTML = cheerio.load(html);
  return {
    subscribers: channelHTML('div.align-center:contains("subscribers")').prev().text()
      .replace(/\s+/g, ''),
    postReach: channelHTML('div.align-center:contains("avg post reach")').prev().text()
      .replace(/\s+/g, '')
      .replace('~', ''),
    dailyReach: channelHTML('div.align-center:contains("daily reach")').prev().text()
      .replace(/\s+/g, '')
      .replace('~', ''),
    postsPerDay: channelHTML('div.align-center:contains("posts per day")').prev().text()
      .replace(/\s+/g, '')
      .replace('~', ''),
    err: channelHTML('div.align-center:contains("ERR %")').prev().text()
      .replace(/\s+/g, '')
      .replace('~', ''),
  };
};

const fetchStats = async (req, res, next) => {
  // Fetch tgstat.ru html page with stats for group AND/OR channel
  // Grab stats from html
  const accounts = res.body;
  Promise.all(accounts.map(async (account) => {
    let updatedAccount = account;
    if (account.telegram_chanel) {
      await request(`https://en.tgstat.com/channel/@${account.telegram_channel}`)
        .then((html) => {
          const {
            subsctibers: tgChannelSubscribers,
            postReach: tgChannelPostReach,
            dailyReach: tgChannelDailyReach,
            postsPerDay: tgChannelPostsPerDay,
            err: tgChannelErr,
          } = parseHtml(html);
          const tgChannelStatus = 'OK';
          updatedAccount = Object.assign(updatedAccount, {
            tgChannelSubscribers,
            tgChannelPostReach,
            tgChannelDailyReach,
            tgChannelPostsPerDay,
            tgChannelErr,
            tgChannelStatus,
          });
        })
        .catch((err) => {
          updatedAccount.tgChannelStatus = err.statusCode;
        });
    }
    if (updatedAccount.telegram_group) {
      await request(`https://en.tgstat.com/channel/@${account.telegram_group}`)
        .then((html) => {
          const {
            subsctibers: tgGroupSubscribers,
            postReach: tgGroupPostReach,
            dailyReach: tgGroupDailyReach,
            postsPerDay: tgGroupPostsPerDay,
            err: tgGroupErr,
          } = parseHtml(html);
          const tgGroupStatus = 'OK';
          updatedAccount = Object.assign(updatedAccount, {
            tgGroupSubscribers,
            tgGroupPostReach,
            tgGroupDailyReach,
            tgGroupPostsPerDay,
            tgGroupErr,
            tgGroupStatus,
          });
        })
        .catch((err) => {
          updatedAccount.tgGroupStatus = err.statusCode;
        });
    }
    return updatedAccount;
  }))
    .then((updatedAccounts) => {
      res.body = updatedAccounts;
      next();
    });
};

const updateTelegramStats = async (req, res, next) => {
  // Update DB with Telegram stats
  const accounts = res.body;
  Promise.all(accounts.map(mongo.updateTelegramStats))
    .then(() => next())
    .catch(err => next(err));
};

const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader('cache-control', 'private, max-age=0, no-cache, no-store, must-revalidate');
  res.setHeader('expires', '0');
  res.setHeader('pragma', 'no-cache');
  next();
});

app.get('/', getTelegramAccounts, fetchStats, updateTelegramStats, (req, res) => res.sendStatus(200));

app.listen(port, () => console.log(`Telegram module is listening on port ${port}!`));
