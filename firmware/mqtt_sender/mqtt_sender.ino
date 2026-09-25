// SignSpeaker - Smart Glove ESP32 (Wireless MQTT Sender)
//
// Reads the MPU6050 gyroscope and publishes gyro data over Wi-Fi
// to the Mosquitto MQTT broker every ~40 ms (~25 Hz).
// NO USB CABLE TO LAPTOP REQUIRED! Powered by battery or power bank.
//
// MPU6050 wiring: VCC -> 3.3V, GND -> GND, SDA -> GPIO 23, SCL -> GPIO 22
//
// Required Arduino Libraries:
//   - PubSubClient by Nick O'Leary
//   - Adafruit MPU6050
//   - Adafruit Unified Sensor

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// ---------- Wi-Fi & MQTT Configuration ----------
const char* WIFI_SSID     = "YOUR_WIFI_NAME";        // Enter your Wi-Fi SSID
const char* WIFI_PASS     = "YOUR_WIFI_PASSWORD";    // Enter your Wi-Fi Password

// Mosquitto Broker: use "test.mosquitto.org" or your laptop LAN IP (e.g. "192.168.1.100")
const char* MQTT_BROKER   = "test.mosquitto.org";
const int   MQTT_PORT     = 1883;
const char* MQTT_TOPIC    = "signspeaker/glove/data";

const unsigned long SEND_INTERVAL_MS = 40; // 25 Hz

Adafruit_MPU6050 mpu;
WiFiClient espClient;
PubSubClient mqtt(espClient);

unsigned long lastSend = 0;

void setupWifi() {
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi connected! IP: " + WiFi.localIP().toString());
}

void reconnectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("Connecting to Mosquitto MQTT: ");
    Serial.println(MQTT_BROKER);
    String clientId = "SignSpeaker_Glove_" + String(random(0xffff), HEX);
    
    if (mqtt.connect(clientId.c_str())) {
      Serial.println("Connected to Mosquitto broker!");
      mqtt.publish("signspeaker/glove/status", "Glove online (wireless MQTT)");
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
  delay(300);

  Wire.begin(23, 22);
  while (!mpu.begin()) {
    Serial.println("MPU6050 not found - check wiring (SDA 23, SCL 22)");
    delay(1000);
  }

  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  Serial.println("MPU6050 ready");

  setupWifi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
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

  unsigned long now = millis();
  if (now - lastSend >= SEND_INTERVAL_MS) {
    lastSend = now;

    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    // Protocol: D,<ms>,<gx>,<gy>,<gz>
    char payload[64];
    snprintf(payload, sizeof(payload), "D,%lu,%.3f,%.3f,%.3f",
             now, g.gyro.x, g.gyro.y, g.gyro.z);

    mqtt.publish(MQTT_TOPIC, payload);
    Serial.println(payload);
  }
}
