// Importing the required dependencies
const express = require('express');
const app = express();
const asciify = require('asciify-image');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();
const crypto = require('crypto')
const querystring = require('querystring')
const request = require('request')

// Creating an express server at port: 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
})

// Base path "/" initialized to send application status
app.get("/", (req, res) => {
  res.json({
    message: "Hello World"
  })
})

// API endpoint to convert a given image url to ASCII Art and return it in the form of a txt file
app.get("/image-to-ascii", (req, res) => {
  if (!req.query.image) {
    res.json({
      error: "Image Link not provided",
      success: false
    })
  } else {
    asciify(req.query.image, {
      fit: 'box',
      width: 200,
      height: 100,
      color: false
    }, function(err, asciified) {
      if (err) {
        res.json({
          error: err,
          success: false
        });
      } else {
        fs.writeFileSync('out.txt', asciified);
        res.sendFile(__dirname + "/out.txt", () => {
          fs.writeFileSync("out.txt", "", (err) => {
            if (err) console.log(err);
          })
        });
      }
    });
  }
})

// Module to connect to the Spotify API and retrieve data related to the playlistID provided as an argument
async function getPlaylist(playlistID) {
  let playlist = [];
  let response = await fetch(`https://api.spotify.com/v1/playlists/${playlistID}/tracks`, {
    method: "GET",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SPOTIFY_BEARER_TOKEN}`
    }
  })
    .then(r => r.json())
    .catch(e => { if (e) throw e })

  try {
    response.items.forEach(track => {
      playlist.push({
        name: track["track"].album.name,
        image: track["track"].album.images[1].url
      })
    })
  } catch (err) {
    if (err) {
      console.log("Error in function: getPlaylist")
      throw err
    }
  }

  return playlist;
}

// API endpoint to use the getPlaylist() module and send the returned data as the response
app.get("/spotify/playlist/:playlistID", async (req, res) => {
  if (!req.params.playlistID) {
    res.json({
      error: "Playlist ID not provided",
      success: false
    })
  } else {
    try {
      let playlist = await getPlaylist(req.params.playlistID);
      res.json({
        playlist,
        success: true
      })
    } catch (err) {
      if (err) res.json({
        error: (Object.keys(err).length > 0) ? err : "OAuth Token Expired",
        success: false
      })
    }
  }
})

/* API endpoint to call the getPlaylist() module twice - once for the main playlist and second time for the dummy playlist
   Use the returned data to select 10 random albums from the main playlist along, get their names and image urls, convert 
   the images to ASCII art and populate the options list with the correct answer and 3 other wrong options and send the 
   compiled game.txt as part of the response
*/
app.get("/spotify/playlist/:playlistID/game.txt", async (req, res) => {
  if (!req.params.playlistID) {
    res.json({
      error: "Playlist ID not provided",
      success: false
    })
  } else {
    try {
      let playlist = await getPlaylist(req.params.playlistID);
      let dummyValues = await getPlaylist("2w3lbcL6WV04kZHHggmB98");
      let question_set = new Set(), answer_set = new Set();

      while (question_set.size != 10) {
        question_set.add(playlist[Math.floor(Math.random() * playlist.length)]);
      }

      question_set.forEach(album => {
        asciify(album.image, {
          fit: 'box',
          width: 64,
          height: 64,
          color: false
        }, function(err, asciified) {
          if (err) {
            res.json({
              error: "Error with ASCII Image to Text Module",
              success: false
            });
          } else {
            while (answer_set.size < 3) {
              answer_set.add(dummyValues[Math.floor(Math.random() * dummyValues.length)].name);
            }
            let options = randomOptionString(album.name, Array.from(answer_set));
            fs.appendFileSync("game.txt", "-- BEGIN QUESTION --\n" + asciified + "\n\t\n" + options.options + "\n\t\n-- END QUESTION --\n" + options.key_index + "\n");
          }
        });
      })

      res.sendFile(__dirname + "/game.txt", () => {
        fs.writeFileSync("game.txt", "", (err) => {
          if (err) console.log(err);
        });
      })
    } catch (err) {
      if (err) res.json({
        error: (Object.keys(err).length > 0) ? err : "OAuth Token Expired",
        success: false
      })
    }
  }
})

// Module to format the dummy values and the answer key to the required String format
function randomOptionString(key, dummyValues) {
  let options = [0, 0, 0, 0];
  let key_index = Math.floor(Math.random() * 4);
  let arrCtr = 0;

  for (let i = 0; i < 4; i++) {
    if (i == key_index)
      options[i] = `${i + 1}) ${key}`;
    else
      options[i] = `${i + 1}) ${dummyValues[arrCtr++]}`
  }

  return { key_index: key_index + 1, options: options.join("\n") }
}

function generateRandomString(len) {
  return (crypto.randomBytes(len).toString('hex'))
}

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  var scope = 'user-read-private user-read-email';
  var redirect_uri = "https://PSAT-Project.nishithp2004.repl.co/callback"

  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', async function(req, res) {

  var code = req.query.code || null;
  var state = req.query.state || null;
  var redirect_uri = "https://PSAT-Project.nishithp2004.repl.co/callback"

  if (state === null) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + btoa(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET)
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        process.env.SPOTIFY_BEARER_TOKEN = body["access_token"];
        process.env.SPOTIFY_REFRESH_TOKEN = body["refresh_token"];
        // res.send(body);
        res.redirect("https://PSAT-Project.nishithp2004.repl.co/")
      }
    });
  }
});

function refreshToken(refresh_token) {
  var refresh_token = refresh_token || process.env.SPOTIFY_REFRESH_TOKEN
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + btoa(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET) },
    form: {
      grant_type: 'refresh_token',
      refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      process.env.SPOTIFY_BEARER_TOKEN = access_token;
    }
  });
}

app.get('/refresh_token', function(req, res) {
  refreshToken(process.env.SPOTIFY_REFRESH_TOKEN);
  res.json({
    access_token: process.env.SPOTIFY_BEARER_TOKEN
  })
});

// Made with ❤️ by Nishith P
// PSAT Project API Wrapper
// 2023