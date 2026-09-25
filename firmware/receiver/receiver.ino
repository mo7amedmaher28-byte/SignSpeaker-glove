// SignSpeaker - Receiver ESP32
// MAC: D4:E9:F4:ED:B9:A4
//
// Receives GyroData from the glove over ESP-NOW and:
//   - streams every packet to the laptop over USB serial (115200 baud)
//   - shows words sent back by the laptop (Node-RED) on the 16x2 I2C LCD
//   - falls back to the built-in rule-based classifier when no laptop is connected
//
// LCD wiring: VCC -> 5V, GND -> GND, SDA -> GPIO 21, SCL -> GPIO 22
//
// Serial protocol (one line each, '\n' terminated)
//   ESP32 -> laptop:  D,<ms>,<gyroX>,<gyroY>,<gyroZ>   one gyro packet
//                     I,<text>                          info message
//   laptop -> ESP32:  H                                 heartbeat (host connected)
//                     W,<text>                          show "Detected: <text>" for 2 s
//                     L,<line1>|<line2>                 set the idle/status screen

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// Both boards must use the same channel. Must match sender.ino.
#define ESPNOW_CHANNEL 1

// Only accept packets from the glove: 78:1C:3C:CB:31:00
const uint8_t senderMAC[6] = { 0x78, 0x1C, 0x3C, 0xCB, 0x31, 0x00 };

typedef struct {

  float gyroX;
  float gyroY;
  float gyroZ;

} GyroData;

LiquidCrystal_I2C lcd(0x27, 16, 2);

// ---------- packet queue (ESP-NOW callback runs on the Wi-Fi task) ----------

struct Packet {
  uint32_t ms;
  GyroData d;
};

const int QUEUE_SIZE = 32;
Packet queue[QUEUE_SIZE];
volatile int qHead = 0;
volatile int qTail = 0;
portMUX_TYPE qMux = portMUX_INITIALIZER_UNLOCKED;

void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *incoming, int len) {
  if (len != sizeof(GyroData)) return;
  if (memcmp(info->src_addr, senderMAC, 6) != 0) return;

  Packet p;
  p.ms = millis();
  memcpy(&p.d, incoming, sizeof(GyroData));

  portENTER_CRITICAL(&qMux);
  int next = (qHead + 1) % QUEUE_SIZE;
  if (next != qTail) {
    queue[qHead] = p;
    qHead = next;
  }
  portEXIT_CRITICAL(&qMux);
}

bool popPacket(Packet &p) {
  bool ok = false;
  portENTER_CRITICAL(&qMux);
  if (qTail != qHead) {
    p = queue[qTail];
    qTail = (qTail + 1) % QUEUE_SIZE;
    ok = true;
  }
  portEXIT_CRITICAL(&qMux);
  return ok;
}

// ---------- LCD ----------

String statusLine1 = "SignSpeaker";
String statusLine2 = "Waiting...";
unsigned long resultUntil = 0;
const unsigned long RESULT_TIME = 2000;

void lcdLines(String l1, String l2) {
  l1 = l1.substring(0, 16);
  l2 = l2.substring(0, 16);
  while (l1.length() < 16) l1 += ' ';
  while (l2.length() < 16) l2 += ' ';
  lcd.setCursor(0, 0);
  lcd.print(l1);
  lcd.setCursor(0, 1);
  lcd.print(l2);
}

void showResult(const String &word) {
  if (word == "Unknown") {
    lcdLines("Unknown", "Gesture");
  } else {
    lcdLines("Detected:", word);
  }
  resultUntil = millis() + RESULT_TIME;
}

// ---------- host (laptop) link ----------

unsigned long lastHostMs = 0;
const unsigned long HOST_TIMEOUT = 3000;
String serialBuf;

bool hostConnected() {
  return lastHostMs != 0 && millis() - lastHostMs < HOST_TIMEOUT;
}

void handleCommand(const String &line) {
  lastHostMs = millis();

  if (line == "H") return;

  if (line.startsWith("W,")) {
    showResult(line.substring(2));
  } else if (line.startsWith("L,")) {
    String rest = line.substring(2);
    int bar = rest.indexOf('|');
    statusLine1 = bar >= 0 ? rest.substring(0, bar) : rest;
    statusLine2 = bar >= 0 ? rest.substring(bar + 1) : "";
    if (millis() >= resultUntil) lcdLines(statusLine1, statusLine2);
  }
}

void readSerialCommands() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      serialBuf.trim();
      if (serialBuf.length() > 0) handleCommand(serialBuf);
      serialBuf = "";
    } else if (serialBuf.length() < 64) {
      serialBuf += c;
    }
  }
}

// ---------- standalone rule-based classifier (used when no laptop) ----------

const float MOVEMENT_START = 0.20;
const float MOVEMENT_END = 0.12;
const unsigned long QUIET_TIME = 250;
const unsigned long MIN_GESTURE_TIME = 120;
const unsigned long MAX_GESTURE_TIME = 1500;
const unsigned long COOLDOWN_TIME = 700;

bool gestureActive = false;
unsigned long gestureStart = 0;
unsigned long quietSince = 0;
unsigned long cooldownUntil = 0;
float minX, maxX, minY, maxY, minZ, maxZ;
float peakX, peakY, peakZ;

void resetGesture(const GyroData &d) {
  minX = maxX = d.gyroX;
  minY = maxY = d.gyroY;
  minZ = maxZ = d.gyroZ;
  peakX = fabs(d.gyroX);
  peakY = fabs(d.gyroY);
  peakZ = fabs(d.gyroZ);
}

void trackGesture(const GyroData &d) {
  minX = min(minX, d.gyroX);
  maxX = max(maxX, d.gyroX);
  minY = min(minY, d.gyroY);
  maxY = max(maxY, d.gyroY);
  minZ = min(minZ, d.gyroZ);
  maxZ = max(maxZ, d.gyroZ);
  peakX = max(peakX, (float)fabs(d.gyroX));
  peakY = max(peakY, (float)fabs(d.gyroY));
  peakZ = max(peakZ, (float)fabs(d.gyroZ));
}

String classifyRules() {
  float rangeX = maxX - minX;
  float rangeY = maxY - minY;
  float rangeZ = maxZ - minZ;

  if (rangeX > 0.70 && rangeY > 0.40 && rangeZ > 0.50) return "Hello";
  if (rangeY > 0.65 && rangeY > rangeX * 1.15 && rangeY > rangeZ * 1.15) return "I am";
  if (rangeX < 0.30 && rangeY < 0.30 && rangeZ < 0.30) return "Reem";
  if (rangeZ > 0.70 && rangeX > 0.25 && rangeZ > rangeY) return "Thanks";
  return "Unknown";
}

void standaloneStep(const Packet &p) {
  const GyroData &d = p.d;
  unsigned long now = p.ms;
  float movement = sqrt(d.gyroX * d.gyroX + d.gyroY * d.gyroY + d.gyroZ * d.gyroZ);

  if (!gestureActive) {
    if (now >= cooldownUntil && movement > MOVEMENT_START) {
      gestureActive = true;
      gestureStart = now;
      quietSince = 0;
      resetGesture(d);
    }
    return;
  }

  trackGesture(d);

  if (movement < MOVEMENT_END) {
    if (quietSince == 0) quietSince = now;
  } else {
    quietSince = 0;
  }

  unsigned long duration = now - gestureStart;
  bool quietDone = quietSince != 0 && now - quietSince >= QUIET_TIME;

  if (quietDone || duration >= MAX_GESTURE_TIME) {
    gestureActive = false;
    cooldownUntil = now + COOLDOWN_TIME;
    if (duration >= MIN_GESTURE_TIME) {
      showResult(classifyRules());
    }
  }
}

// ---------- main ----------

void setup() {
  Serial.begin(115200);
  delay(200);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcdLines("SignSpeaker", "Starting...");

  WiFi.mode(WIFI_STA);

  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  if (esp_now_init() != ESP_OK) {
    lcdLines("ESP-NOW", "init failed");
    Serial.println("I,ESP-NOW init failed");
    delay(2000);
    ESP.restart();
  }

  esp_now_register_recv_cb(onDataRecv);

  Serial.print("I,SignSpeaker receiver ready, MAC ");
  Serial.println(WiFi.macAddress());
  lcdLines(statusLine1, statusLine2);
}

void loop() {
  readSerialCommands();

  Packet p;
  while (popPacket(p)) {
    Serial.printf("D,%lu,%.3f,%.3f,%.3f\n",
                  (unsigned long)p.ms, p.d.gyroX, p.d.gyroY, p.d.gyroZ);

    if (!hostConnected()) standaloneStep(p);
  }

  static bool wasHost = false;
  bool host = hostConnected();
  if (host != wasHost) {
    wasHost = host;
    if (!host) {
      statusLine1 = "SignSpeaker";
      statusLine2 = "Waiting...";
    }
    gestureActive = false;
    if (millis() >= resultUntil) lcdLines(statusLine1, statusLine2);
  }

  if (resultUntil != 0 && millis() >= resultUntil) {
    resultUntil = 0;
    lcdLines(statusLine1, statusLine2);
  }
}
