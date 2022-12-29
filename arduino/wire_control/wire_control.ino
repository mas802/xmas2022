#include <Wire.h>

#define I2C_SLAVE_ADDRESS 11

#define PAYLOAD_SIZE 4

const int STATUS_OFF       = 0;
const int STATUS_ON        = 1;
const int STATUS_A         = 2;
const int STATUS_GREEN     = 2;
const int STATUS_B         = 3;
const int STATUS_RED       = 3;
const int STATUS_TRANS_OFF = 4;
const int STATUS_TRANS_ON  = 5;
const int STATUS_FLOCKER_OFF = 4;
const int STATUS_FLICKER_ON  = 5;
const int STATUS_BLINK    = 6;
const int STATUS_TOGGLE    = 7;
const int STATUS_BLINK_ON    = 10;
const int STATUS_BLINK_OFF   = 11;


int pin[]    {  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, A0, A1, A2, A3, A4, A5,  0,  0,  0,  0};
int status[] {  0,  0,  0,  1,  1,  0,  6,  6,  0,  1,  0,  1,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0};
int value[]  {  0,  0,  0,  1,  1,  0,  0,  1,  1,  0,  0,  1,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0};


const int delta = 600;
int n = 0;
int state = 0;

// These constants won't change. They're used to give names to the pins used:
const int analogInPin[] = {A0,A2,A1}; 

int   sensorValue[] = {-1,-1,-1 };        // value read from the pot
int   lowRefValue[] = {0,0,0};      
int  highRefValue[] = {600,600,600};      
int sensorCounter[] = {0,0,0};


void setup()
{
  Serial.begin(9600); 
  Serial.println("------- XMAS2022 --------");
  delay(1000);

  Wire.begin(I2C_SLAVE_ADDRESS);
  Wire.onRequest(requestEvents);
  Wire.onReceive(receiveEvents);

  for (int i = 0; i<16; i++) {
    pinMode(i, OUTPUT);
  }

  for (int i = 0; i<16; i++) {
    doAction(status[i], i, 99);
  }
}


void requestEvents()
{
    Serial.print(F("requestEvents START -- "));
    for ( int i = 0; i<16; i++ ) {
      Wire.write(status[i]);
      Serial.print(status[i]);
      Serial.print(" ");
    }
    Serial.println(F(" -- requestEvents END"));
}


void receiveEvents(int numBytes)
{
  Serial.print(F("---> recieved events \tnum= "));
  Serial.println(numBytes);

  // clear queue
  while(PAYLOAD_SIZE < Wire.available()) // loop through all but the last
  {
    int c = Wire.read();
    Serial.print( "Receive too much: " );
    Serial.println(c);
  }

    int action = Wire.read();
    int item1 = Wire.read();
    int item2 = Wire.read();
    int data = Wire.read();

    Serial.print(F("---> recieved events \titem = "));
    Serial.println(action);

    doAction(action, item1, item2);

    Serial.println(F(" receive END -- "));
}

void doAction(int action, int item1, int item2) {
    Serial.print("");
    Serial.print("doAction ");
    Serial.print(action);
    Serial.print(" - ");
    Serial.println(item1);

    switch (action) {
      case STATUS_FLICKER_ON:
        flickerToggle(item1, 50);
        flickerToggle(item2, 50);
        break;
      case STATUS_BLINK:
        toggleBlink(item1);
        toggleBlink(item2);
        break;
      case STATUS_TOGGLE:
        toggle(item1);
        toggle(item2);
        break;
      case STATUS_OFF:
        turnOff(item1);
        turnOn(item2);
        break;
      case STATUS_ON:
        turnOn(item1);
        turnOff(item2);
        break;
    }
}


void blinkUpdate(int time) {

  for(int i=0; i<16; i++) {
    if ( status[i] == STATUS_BLINK ) {
      blink(i);
    } 
  }

}


void smallUpdate( int counter ) {
  
  // READ SENSORS
  /*
  for (int s = 0; s<2; s++) {
    sensorValue[s] = analogRead(analogInPin[s]);

    if ( sensorValue[s] > highRefValue[s] ) {
      sensorCounter[s]++;
      action(s);
      highRefValue[s] = 1000;
      lowRefValue[s] = 10;
    }

    if ( sensorValue[s] < lowRefValue[s] ) {
      highRefValue[s] = 600;
      lowRefValue[s] = -1;
    }
  }
  */

  for(int i=0; i<16; i++) {

  // FLICKER ON
  if ( status[i] == STATUS_TRANS_ON) {
    value[i]--;
    digitalWrite(pin[i], random(0, 2));
    if ( value[i] < 0 ) {
       turnOn(i);
    }
  }

  // FLICKER OFF
  if ( status[i] == STATUS_TRANS_OFF) {
    value[i]--;
    digitalWrite(pin[i], random(0, 2));
    if ( value[i] < 0 ) {
       turnOff(i);
    }
  }

  }
}


int maincounter = 0;

int smalldelta = 20;
int bigdelta = 1000/smalldelta;

void loop() {

  maincounter++;

  if ( maincounter % bigdelta == 0 ) {
     blinkUpdate( maincounter );
  }

  smallUpdate( maincounter );

  delay(smalldelta);

}


void turnOn( int item ) {
  Serial.print("Turn item on: "); Serial.println(item);
  digitalWrite(pin[item], HIGH);
  status[item]=STATUS_ON;
}

void turnOff( int item ) {
  Serial.print("Turn item off: "); Serial.println(item);
  digitalWrite(pin[item], LOW);
  status[item]=STATUS_OFF;
}

void turnA( int item1, int item2 ) {
  Serial.print("Turn item A: "); Serial.println(item1);
  digitalWrite(pin[item1], HIGH);
  digitalWrite(pin[item2], LOW);
  status[item1]=STATUS_A;
  status[item2]=STATUS_B;
}

void turnB( int item1, int item2 ) {
  Serial.print("Turn item B: "); Serial.println(item1);
  digitalWrite(pin[item1], LOW);
  digitalWrite(pin[item2], HIGH);
  status[item1]=STATUS_B;
  status[item2]=STATUS_A;
}

void turnGreen( int item1, int item2 ) {
  turnA(item1, item2);
}

void turnRed( int item1, int item2 ) {
  turnB(item1, item2);
}

void flickerOn( int item, int duration ) {
  if ( status[item] != STATUS_ON ) {
      status[item] = STATUS_TRANS_ON;
      value[item] = duration;
  }
}

void flickerOff( int item, int duration ) {
  if ( status[item] != STATUS_OFF ) {
      status[item] = STATUS_TRANS_OFF;
      value[item] = duration;
  }
}

void toggleBlink( int item ) {
  if (status[item] != STATUS_BLINK) {
    blink(item);
  } else {
    turnOff(item);
  }
}

void blink( int item ) {
  status[item] = STATUS_BLINK;
  value[item] = !value[item];
  digitalWrite(pin[item], value[item]);
}

void toggle( int item ) {
  Serial.print("Toggle item: "); Serial.println(item);
  switch ( status[item] ) {
    case STATUS_ON:
    case STATUS_BLINK:
    case STATUS_TRANS_ON:
      turnOff(item);
      break;
    case STATUS_OFF:
    case STATUS_TRANS_OFF:
      turnOn(item);
      break;
  }
}



void flickerToggle( int item, int duration ) {
  Serial.print("Toggle item flicker: "); Serial.println(item);
  switch ( status[item] ) {
    case STATUS_ON:
    case STATUS_TRANS_ON:
      status[item] = STATUS_TRANS_OFF;
      value[item] = duration;
      break;
    case STATUS_OFF:
    case STATUS_TRANS_OFF:
      status[item] = STATUS_TRANS_ON;
      value[item] = duration;
      break;
  }
}
