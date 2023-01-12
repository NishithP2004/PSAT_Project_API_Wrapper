const express = require('express');
const app = express();
const asciify = require('asciify-image');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
})

app.get("/", (req, res) => {
  res.json({
    message: "Hello World"
  })
})

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
          fs.unlinkSync("out.txt")
        });
      }
    });
  }
})

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
        image: track["track"].album.images[0].url
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
        error: err | "OAuth Token Expired",
        success: false
      })
    }
  }
})

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

      while (question_set.size < 10) {
        question_set.add(playlist[Math.floor(Math.random() * playlist.length)]);
      }

      question_set.forEach(album => {
        asciify(album.image, {
          fit: 'box',
          width: 200,
          height: 100,
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
            fs.appendFileSync("game.txt", "\n-- BEGIN QUESTION --\n" + asciified + "\n\t\n" + options.options + "\n\t\n-- END QUESTION --\n" + options.key_index);
          }
        });
      })

      res.sendFile(__dirname + "/game.txt", () => {
        fs.unlinkSync("game.txt");
      })
    } catch (err) {
      if (err) res.json({
        error: err | "OAuth Token Expired",
        success: false
      })
    }
  }
})

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