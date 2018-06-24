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
  };

const getHtml = async (req, res, next) => {
    // Fetch tgstat.ru html page for group / channel
    const accounts = res.body;

    Promise.all(accounts.map(async (account) => {
        if (account.telegram_channel) {
            console.log(account.telegram_channel)
            await request(`https://en.tgstat.com/channel/@${account.telegram_channel}`)
            .then((body) => {
                const channelHTML = cheerio.load(body);
                account.subscribers = channelHTML('div.align-center:contains("subscribers")').prev().text().replace(/\s+/g, '');
              })
              .catch((err) => {
                console.log(err);
              })
            }
        return account;
    }))
    .then(updatedAccounts => {
      res.body = updatedAccounts;
      next();
    })

}

const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader('cache-control', 'private, max-age=0, no-cache, no-store, must-revalidate');
  res.setHeader('expires', '0');
  res.setHeader('pragma', 'no-cache');
  next();
});

app.get('/', getAccounts, getHtml, (req, res) => res.json(res.body));

app.listen(port, () => console.log(`Telegram module is listening on port ${port}!`));