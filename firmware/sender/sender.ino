// SignSpeaker - Glove / Sender ESP32
// MAC: 78:1C:3C:CB:31:00
//
// Reads the MPU6050 gyroscope and sends gyroX/Y/Z to the receiver over ESP-NOW
// every ~40 ms (~25 samples/s). Only gyro data is transmitted.
//
// MPU6050 wiring: VCC -> 3.3V, GND -> GND, SDA -> GPIO 23, SCL -> GPIO 22

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// Both boards must use the same channel. Must match receiver.ino.
#define ESPNOW_CHANNEL 1

#define SEND_INTERVAL_MS 40

// Receiver ESP32 MAC: D4:E9:F4:ED:B9:A4
uint8_t receiverMAC[] = {
  0xD4,
  0xE9,
  0xF4,
  0xED,
  0xB9,
  0xA4
};

typedef struct {

  float gyroX;
  float gyroY;
  float gyroZ;

} GyroData;

Adafruit_MPU6050 mpu;
GyroData data;

void setup() {
  Serial.begin(115200);
  delay(200);

  Wire.begin(23, 22);

  while (!mpu.begin()) {
    Serial.println("MPU6050 not found - check wiring (SDA 23, SCL 22)");
    delay(1000);
  }

  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  Serial.println("MPU6050 ready");

  WiFi.mode(WIFI_STA);

  // Pin the radio to a fixed channel so sender and receiver always match.
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_channel(ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);
  esp_wifi_set_promiscuous(false);

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init failed - restarting");
    delay(1000);
    ESP.restart();
  }

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, receiverMAC, 6);
  peerInfo.channel = 0;  // 0 = current channel (ESPNOW_CHANNEL)
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("Failed to add receiver peer");
  }

  Serial.print("Sender MAC: ");
  Serial.println(WiFi.macAddress());
}

void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  data.gyroX = g.gyro.x;
  data.gyroY = g.gyro.y;
  data.gyroZ = g.gyro.z;

  esp_now_send(
    receiverMAC,
    (uint8_t *)&data,
    sizeof(data)
  );

  Serial.printf("GYRO X: %.2f  Y: %.2f  Z: %.2f\n", data.gyroX, data.gyroY, data.gyroZ);

  delay(SEND_INTERVAL_MS);
}
