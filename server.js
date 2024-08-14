// To use a .env file, run `node --env-file=.env server.js`
// By default, this starts a server and you can refresh the feeds by accessing the root path. If you just want to refresh the feeds and quit, add `-refreshandquit` as an argulemt.
// Example: node --env-file=.env server.js -refreshandquit

const express = require("express");
const app = express();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

console.log(process.env.KEY)
let apiKey = process.env.KEY;
const rateLimit = 43200000; // Only refresh twice per day. 43200000 miliseconds = 12 hours. If a feed has an error (e.g., too many requests) its checked_at datetime still gets updated so we won't hit the feeds with too many requests.

const refreshFeeds = async () => {
  let req = await fetch('https://reader.miniflux.app/v1/feeds', { headers: { 'X-Auth-Token': apiKey } });
  let res = JSON.parse(await req.text());
  let feedsArray = res.map(currentFeed => currentFeed);
  feedsArray.sort((a, b) => { return (new Date(a.checked_at) - new Date(b.checked_at)) }); // Sort from least recently checked to most recently checked so least recent gets refreshed first.
  for (let [index, feed] of feedsArray.entries()) {
    let lastChecked = new Date(feed.checked_at).getTime();
    if (Date.now() - lastChecked > rateLimit) {
      console.log(`It's been more than 24 hours, refresh.`);
      setTimeout(
        async () => {
          let req = await fetch(`https://reader.miniflux.app/v1/feeds/${feed.id}`, { headers: { 'X-Auth-Token': apiKey } });
          let response = JSON.parse(await req.text());
          let lastChecked = new Date(response.checked_at).getTime();
          if (Date.now() - lastChecked > rateLimit) { // Since navigating, refreshing the page, or using another device could cause duplicate refreshes, double check that each feed still hasn't been refreshed recently.
            let res = await fetch(`https://reader.miniflux.app/v1/feeds/${feed.id}/refresh`, {
              method: "PUT",
              headers: { 'X-Auth-Token': apiKey }
            });
            console.log(res);
          }
        }, 60000 * index); // Make a call every 60 seconds - every 30 occasionnaly triggered 'too many requests' errors.
    } else console.log(`It's been less than 24 hours, do nothing.`);
  }
}

if (process.argv[2] == `-refreshandquit`) {
  console.log(`-refreshandquit argument supplied, refreshing then quitting.`) // Just refresh feeds and quit, don't start the web server.
  refreshFeeds();
} else {

  var listener = app.listen(process.env.PORT, function () {
    console.log("Your app is listening on port " + listener.address().port);
  });

  app.use(express.static("public")); // Serve static files

  app.get("/favicon.ico", (request, response) => {
    response.send(
      "https://www.google.com/s2/favicons?sz=64&domain=miniflux.app"
    );
  });

  app.get("/", (req, res) => {
    refreshFeeds();
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Refreshing feeds");
  });
}