// Adafruit Motor shield library
// copyright Adafruit Industries LLC, 2009
// this code is public domain, enjoy!

#include <Wire.h>
#include "AFMotor.h"

#define I2C_SLAVE_ADDRESS 14

AF_DCMotor motor(4);

int min = 140;
int max = 200;
int target = 160;

const int IDLE = 0;
const int START_STARTFORWARD = 10;
const int START_SLOWFORWARD = 11;
const int START_FASTFORWARD = 12;
const int START_BACKWARD = 20;
const int STOP = 99;

int action = IDLE;

int incomingByte = 0; // for incoming serial data

void setup() {
  Serial.begin(9600);           // set up Serial library at 9600 bps
  Serial.println("Motor getting ready");

  Wire.begin(I2C_SLAVE_ADDRESS);
  Wire.onRequest(requestEvents);
  Wire.onReceive(receiveEvents);

  // turn on motor
  motor.setSpeed(0);
 
  motor.run(RELEASE);
  Serial.println("Motor ready!");
}


void requestEvents()
{
  // token response, should report motor status
  Wire.write(12);
}


void receiveEvents(int numBytes)
{
  while(1 < Wire.available()) // loop through all but the last
  {
    int c = Wire.read();
    Serial.print( "Receive too much: " );
    Serial.println(c);
  }
  action = Wire.read();
}

void loop() {

  if (action == START_STARTFORWARD) {

    motor.run(FORWARD);
    motor.setSpeed(min);
    delay(500);

    motor.run(BACKWARD);
    motor.setSpeed(max);
    delay(1000);

    motor.run(BACKWARD);
    motor.setSpeed(target);
    action = IDLE;

  } else if (action == START_SLOWFORWARD) { 

    motor.run(FORWARD);
    motor.setSpeed(min);
    delay(500);

    motor.run(BACKWARD);
    motor.setSpeed(max);
    delay(1000);

    motor.run(BACKWARD);
    motor.setSpeed(min);
    action = IDLE;

  } else if (action == START_FASTFORWARD) { 

    motor.run(FORWARD);
    motor.setSpeed(min);
    delay(500);

    motor.run(BACKWARD);
    motor.setSpeed(max);
    delay(1000);

    motor.run(BACKWARD);
    motor.setSpeed(target);
    action = IDLE;

  } else if (action == START_BACKWARD) { 

    motor.run(FORWARD);
    motor.setSpeed(min);
    action = IDLE;

  } else if (action == STOP) { 

    motor.run(RELEASE);
    motor.setSpeed(0);
    action = IDLE;

  }

  delay(100);
  Serial.println("tick alive motor");

}
