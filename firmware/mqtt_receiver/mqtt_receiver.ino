// SignSpeaker - Receiver ESP32 with 16x2 LCD (Wireless MQTT)
//
// Connects to the Mosquitto MQTT broker over Wi-Fi and subscribes to:
//   "signspeaker/glove/lcd"
// Shows detected words and two-line wrapped sentences on the 16x2 I2C LCD!
// NO USB CABLE TO LAPTOP REQUIRED! Can be placed anywhere in the room.
//
// LCD wiring: VCC -> 5V, GND -> GND, SDA -> GPIO 21, SCL -> GPIO 22
//
// Required Arduino Libraries:
//   - PubSubClient by Nick O'Leary
//   - LiquidCrystal_I2C

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ---------- Wi-Fi & MQTT Configuration ----------
const char* WIFI_SSID     = "YOUR_WIFI_NAME";        // Enter your Wi-Fi SSID
const char* WIFI_PASS     = "YOUR_WIFI_PASSWORD";    // Enter your Wi-Fi Password

// Mosquitto Broker: must match sender and dashboard!
const char* MQTT_BROKER   = "test.mosquitto.org";
const int   MQTT_PORT     = 1883;
const char* MQTT_LCD_TOPIC = "signspeaker/glove/lcd";

LiquidCrystal_I2C lcd(0x27, 16, 2);
WiFiClient espClient;
PubSubClient mqtt(espClient);

String statusLine1 = "SignSpeaker";
String statusLine2 = "Wireless MQTT";
unsigned long resultUntil = 0;
const unsigned long RESULT_TIME = 2500;

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

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String line = "";
  for (unsigned int i = 0; i < length; i++) {
    line += (char)payload[i];
  }
  line.trim();
  Serial.println("MQTT LCD cmd: " + line);

  if (line == "H") return; // Heartbeat

  if (line.startsWith("W,")) {
    showResult(line.substring(2));
  } else if (line.startsWith("L,")) {
    String rest = line.substring(2);
    int bar = rest.indexOf('|');
    statusLine1 = bar >= 0 ? rest.substring(0, bar) : rest;
    statusLine2 = bar >= 0 ? rest.substring(bar + 1) : "";
    if (millis() >= resultUntil) {
      lcdLines(statusLine1, statusLine2);
    }
  }
}

void setupWifi() {
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  lcdLines("Wi-Fi Connecting", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi connected! IP: " + WiFi.localIP().toString());
  lcdLines("Wi-Fi Connected!", WiFi.localIP().toString());
  delay(1000);
}

void reconnectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("Connecting to Mosquitto: ");
    Serial.println(MQTT_BROKER);
    lcdLines("MQTT Connecting", "Mosquitto...");
    String clientId = "SignSpeaker_LCD_" + String(random(0xffff), HEX);

    if (mqtt.connect(clientId.c_str())) {
      Serial.println("Connected to Mosquitto broker!");
      mqtt.subscribe(MQTT_LCD_TOPIC);
      lcdLines(statusLine1, statusLine2);
    } else {
      Serial.print("Failed (state ");
      Serial.print(mqtt.state());
      Serial.println("), retrying in 2 seconds...");
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcdLines("SignSpeaker", "Starting MQTT...");

  setupWifi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(256);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWifi();
  }
  if (!mqtt.connected()) {
    reconnectMqtt();
  }
  mqtt.loop();

  if (resultUntil != 0 && millis() >= resultUntil) {
    resultUntil = 0;
    lcdLines(statusLine1, statusLine2);
  }
}
