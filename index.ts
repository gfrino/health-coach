// Entry point: i task in background vanno definiti nello scope globale, prima dell'app.
import './src/sources/background';
import { AppRegistry } from 'react-native';

import { CarRoot } from './src/car/CarRoot';
import 'expo-router/entry';

// Coach vocale su CarPlay: superficie senza finestra avviata dalla scena dell'auto.
AppRegistry.registerComponent('AlbACar', () => CarRoot);
