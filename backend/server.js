const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let batteryData = {};
let gpsData = {};

function initializePort(portName, baudRate, onData) {
  try {
    const port = new SerialPort({ path: portName, baudRate: baudRate });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    
    port.on('error', (err) => {
      console.error(`Error on ${portName}:`, err.message);
    });

    parser.on('data', onData);

    console.log(`Successfully opened ${portName}`);
  } catch (err) {
    console.error(`Cannot open ${portName}:`, err.message);
  }
}

// Initialize COM ports
initializePort('COM4', 9600, (data) => {
  batteryData = { ...batteryData, ...parseBatteryData(data, 'COM4') };
});

initializePort('COM10', 9600, (data) => {
  batteryData = { ...batteryData, ...parseBatteryData(data, 'COM10') };
});

initializePort('COM7', 9600, (data) => {
  gpsData = parseGPSData(data);
});

function parseBatteryData(data, port) {
  console.log(`Received battery data from ${port}:`, data);
  // Implement your battery data parsing logic here
  // This is just a placeholder
  return {
    voltage: parseFloat(data.split(',')[0]),
    current: parseFloat(data.split(',')[1]),
    power: parseFloat(data.split(',')[2])
  };
}

function parseGPSData(data) {
  console.log('Received GPS data:', data);
  // Implement your GPS data parsing logic here
  // This is just a placeholder
  return {
    lat: parseFloat(data.split(',')[0]),
    lng: parseFloat(data.split(',')[1])
  };
}

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send data to client every second
  const interval = setInterval(() => {
    ws.send(JSON.stringify({ 
      battery: batteryData, 
      gps: gpsData,
      status: {
        COM4: batteryData.hasOwnProperty('voltage'),
        COM10: batteryData.hasOwnProperty('current'),
        COM7: gpsData.hasOwnProperty('lat')
      }
    }));
  }, 1000);

  ws.on('close', () => {
    console.log('Client disconnected');
    clearInterval(interval);
  });
});

const port = 3001;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});