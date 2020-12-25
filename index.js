const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs');
const { exec } = require('child_process');
var neopixels = require('rpi-ws281x-native');
var Color = require('color');

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

//config data
var configFile = fs.readFileSync("config.json");
var config = JSON.parse(configFile);

app.get("/", function(req, res){
  res.render("index", {config: config, time: new Date()});
});

app.post("/set", function(req, res){
  config = req.body;
  fs.writeFileSync('config.json', JSON.stringify(config));
  res.redirect("/");
});

app.post("/settime", function(req, res){
  // requires that you disable ntp: sudo timedatectl set-ntp false
  exec("date -s " + req.body.time, (err, stdout, stderr) => {
    if(err || stderr){
      console.error(err);
      res.send(err);
    } else {
      console.log(new Date());
      res.redirect("/");
    }
  });
});

app.post("/shutdown", function(req, res){
  res.send("System is shutting down NOW. Please wait until the green light blinks and then remains solid.");
  neopixels.reset();
  exec("shutdown -h now", (err, stdout, stderr) => {
    if(err || stderr){
      console.error(err);
      res.send(err);
    } else {
      console.log("Bye");
    }
  });
});

app.listen(80, function(){
  console.log("Listening!");
});

//Neopixel stuff
var NUM_LED = 8;
var pixels = new Uint32Array(NUM_LED);
neopixels.init(NUM_LED, { dmaNum: 10 });

process.on("SIGINT", function(){
  neopixels.reset();
  process.nextTick(function(){ process.exit(0); });
});

function fadeColors(color1, color2, steps, currentStep) {
  var dr, dg, db; //full delta vals
  var c1array = Color(color1).rgb().array();
  var c2array = Color(color2).rgb().array();

  dr = (c2array[0] - c1array[0]) / steps;
  dg = (c2array[1] - c1array[1]) / steps;
  db = (c2array[2] - c1array[2]) / steps;

  c1array[0] = c1array[0] + (dr * currentStep);
  c1array[1] = c1array[1] + (dg * currentStep);
  c1array[2] = c1array[2] + (db * currentStep);

  return Color(c1array);
}

setInterval(function(){
  var date = new Date();
  var hour = date.getHours();
  var c = Color("#000000");
  neopixels.setBrightness(parseInt(config.brightness));

  if(config.sunRise <= hour && hour < config.dayPeak){
    //console.log("sr -> noon");
    c = fadeColors(config.sunRiseColor, config.dayColor, config.dayPeak - config.sunRise, hour - config.sunRise);
  }
  else if(config.dayPeak <= hour && hour < config.sunSet){
    //console.log("noon -> ss");
    c = fadeColors(config.dayColor, config.sunSetColor, config.sunSet - config.dayPeak, hour - config.dayPeak);
  }
  else if(config.sunSet <= hour && hour < 24){
    //console.log("ss -> night");
    c = fadeColors(config.nightColor, config.sunSetColor, 24 - config.sunSet, 24 - hour);
  }
  else if(hour <= config.sunRise){
    //console.log("night -> sr");
    c = fadeColors(config.nightColor, config.sunRiseColor, config.sunRise, hour);
  }

  //console.log(c);
  var setAll = (cb) => {
    for(var i = 0; i < NUM_LED; i++){
      //pixels[i] = c.rgb().rgbNumber() >>> 0;
      //pixels[i] = (((parseInt(c.rgb().array()[2]) & 0xff) << 16) + ((parseInt(c.rgb().array()[1]) & 0xff) << 8) + (parseInt(c.rgb().array()[0]) & 0xff)) >>> 0;
      pixels[i] = (Math.trunc(c.color[1]) << 16) + (Math.trunc(c.color[0]) << 8) + Math.trunc(c.color[2]) >>> 0;
      //pixels[i] = c.hex().replace("#", "0x");
    }
    cb();
  }
  setAll(function(){
    neopixels.render(pixels);
  });


}, 1000);
