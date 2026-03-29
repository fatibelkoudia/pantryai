import { StyleSheet, Text, View } from 'react-native';

export default function StockScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>PantryAI</Text>
      <Text>Your pantry stock</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
