import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { DiceScene } from './src/three/DiceScene';

export default function App() {
  return (
    <View style={styles.container}>
      <DiceScene />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1f18',
  },
});
