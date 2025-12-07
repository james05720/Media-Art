// ======================
// Audio System
// ======================
let soundMap = {};         // colorKey -> SoundGroup
let soundFiles = {};       // loaded files (preload fills this)

function preload() {
  soundFiles = {
    "ㄱ": loadSound("assets/ㄱ.m4a"),
    "ㄹ": loadSound("assets/ㄹ.m4a"),
    "ㅅ": loadSound("assets/ㅅ.m4a"),
    "ㅣ": loadSound("assets/ㅣ.m4a"),
    "ㅇ": loadSound("assets/ㅇ.m4a"),
    "ㅏ": loadSound("assets/ㅏ.m4a"),
    "ㅐ": loadSound("assets/ㅐ.m4a"),
    "ㅓ": loadSound("assets/ㅓ.m4a")
  };
}

class SoundGroup {
  constructor(soundFile) {
    this.soundFile = soundFile;
    this.gain = new p5.Gain();
    this.baseVolume = 0.18;
    this.activeCount = 0;
    this.currentTarget = 0;
    this.isLooping = false;

    this.soundFile.disconnect();
    this.soundFile.connect(this.gain);
    this.gain.connect();
    this.gain.amp(0);
  }

  addInstance() {
    this.activeCount++;
    if (!this.isLooping) {
      this.soundFile.loop();
      this.isLooping = true;
    }
    this.currentTarget = min(1.0, this.activeCount * this.baseVolume);
  }

  removeInstance() {
    this.activeCount = max(0, this.activeCount - 1);
    this.currentTarget = min(1.0, this.activeCount * this.baseVolume);
  }

  updateVolume() {
    let cur = this.gain.getVol ? this.gain.getVol() : this._volCache || 0;
    if (abs(cur - this.currentTarget) > 0.001) {
      let next = lerp(cur, this.currentTarget, 0.06);
      this.gain.amp(next, 0.05);
      this._volCache = next;
    } else {
      this.gain.amp(this.currentTarget, 0.02);
      this._volCache = this.currentTarget;

      if (this.currentTarget === 0 && this.isLooping) {
        this.soundFile.stop();
        this.isLooping = false;
      }
    }
  }
}

function colorKey(c) {
  return `${Math.round(red(c))},${Math.round(green(c))},${Math.round(blue(c))}`;
}

function assignRandomSoundGroup() {
  let keys = Object.keys(soundFiles);
  let pick = keys[floor(random(keys.length))];
  return new SoundGroup(soundFiles[pick]);
}

// ======================
// Circle class
// ======================
class CircleWave {
  constructor(x, y, col, sounds = null) {
    this.x = x;
    this.y = y;
    this.r = 5;
    this.baseGrowth = random(0.4, 1.2) / 8;
    this.growth = this.baseGrowth;

    this.color = col;
    this.isGrey = false;
    this.greyLevel = 0;
    this.dead = false;

    if (sounds) {
      this.sounds = sounds;
    } else {
      let key = colorKey(col);
      if (!soundMap[key]) soundMap[key] = assignRandomSoundGroup();
      this.sounds = [soundMap[key]];
    }

    this.sounds.forEach(sg => sg.addInstance());
  }

  update(pressing) {
    if (!this.isGrey) {
      if (pressing) this.growth = this.baseGrowth * 3;
      else this.growth = this.baseGrowth;
      this.r += this.growth;
    } else {
      this.greyLevel = min(255, this.greyLevel + 2);

      // 회색 영역 제거를 느리게 하려면 threshold 조절
      if (this.greyLevel > 240) {
        if (!this.dead) {
          this.sounds.forEach(sg => sg.removeInstance());
          this.dead = true;
        }
      }
    }
  }

  draw() {
    if (!this.isGrey) {
      noFill();
      stroke(this.color);
      strokeWeight(3);
      circle(this.x, this.y, this.r * 2);

      for (let i = 1; i < 5; i++) {
        stroke(color(
          red(this.color),
          green(this.color),
          blue(this.color),
          48 - i * 8
        ));
        strokeWeight(2 - i * 0.2);
        circle(this.x, this.y, this.r * 2 - i * 8);
      }
    } else {
      // 회색 영역 유지하기 위해 fill 유지 + 투명도 증가
      noStroke();
      fill(70, 70, 70, this.greyLevel);  // 더 진한 회색 + 서서히 축적
      circle(this.x, this.y, this.r * 2);
    }
  }

  containsCenter(other) {
    let d = dist(this.x, this.y, other.x, other.y);
    return d < this.r;
  }

  turnGrey() {
    if (!this.isGrey) {
      this.isGrey = true;
      this.greyLevel = min(255, this.greyLevel + 10);
    }
  }
}

// ======================
// Main sketch
// ======================
let circles = [];
let addCircleTimer = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);

  let initialCount = floor(random(3, 8));
  for (let i = 0; i < initialCount; i++) {
    circles.push(createNewCircle(random(width), random(height)));
  }

  addCircleTimer = millis();
}

function draw() {
  background(0);

  let pressing = mouseIsPressed;

  for (let c of circles) {
    c.update(pressing);
    c.draw();
  }

  for (let key in soundMap) {
    soundMap[key].updateVolume();
  }

  checkGreyZones();

  circles = circles.filter(c => !c.dead);

  if (millis() - addCircleTimer > 5000) {
    let count = floor(random(1, 4));
    for (let i = 0; i < count; i++) {
      circles.push(createNewCircle(random(width), random(height)));
    }
    addCircleTimer = millis();
  }
}

function mousePressed() {
  let inside = [];
  for (let c of circles) {
    let d = dist(mouseX, mouseY, c.x, c.y);
    if (d < c.r) inside.push(c);
  }

  let newColor;
  let newSounds = [];

  if (inside.length > 1) {
    let r = 0, g = 0, b = 0;
    inside.forEach(c => {
      r += red(c.color);
      g += green(c.color);
      b += blue(c.color);
    });
    r /= inside.length;
    g /= inside.length;
    b /= inside.length;

    newColor = color(r, g, b);

    inside.forEach(c => c.turnGrey());

    inside.forEach(c => {
      let key = colorKey(c.color);
      if (soundMap[key]) newSounds.push(soundMap[key]);
    });
  } else {
    newColor = uniqueColor();
    let key = colorKey(newColor);

    if (!soundMap[key]) soundMap[key] = assignRandomSoundGroup();
    newSounds = [soundMap[key]];
  }

  circles.push(new CircleWave(mouseX, mouseY, newColor, newSounds));
}

// ======================
// Helper Functions
// ======================
function createNewCircle(x, y) {
  return new CircleWave(x, y, uniqueColor());
}

function uniqueColor() {
  let col;
  let ok = false;
  let safety = 0;

  while (!ok && safety < 500) {
    safety++;
    col = color(random(50, 255), random(50, 255), random(50, 255));
    ok = true;
    for (let c of circles) {
      if (
        red(c.color) === red(col) &&
        green(c.color) === green(col) &&
        blue(c.color) === blue(col)
      ) {
        ok = false;
        break;
      }
    }
  }

  if (!ok) col = color(random(0,255), random(0,255), random(0,255));
  return col;
}

function checkGreyZones() {
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      let A = circles[i];
      let B = circles[j];

      if (!A.isGrey && !B.isGrey) {
        if (A.containsCenter(B) && B.containsCenter(A)) {
          A.turnGrey();
          B.turnGrey();
        }
      }
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}