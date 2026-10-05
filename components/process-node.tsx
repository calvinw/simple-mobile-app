import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GraphNode } from '@/lib/product-graph';

const PURPLE = '#6d4aff';
const BLUE = '#38bdf8';

export function ProcessNode({
  node,
  selected,
  onPress,
}: {
  node: GraphNode;
  selected: boolean;
  onPress: () => void;
}) {
  const accent = node.kind === 'Background' ? BLUE : PURPLE;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${node.name}, ${node.kind} process`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.node,
        { borderColor: selected ? accent : '#d8ddea' },
        selected && styles.selected,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.icon, { backgroundColor: `${accent}18` }]}>
        <Ionicons name="git-network-outline" size={20} color={accent} />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>{node.name}</Text>
        <Text numberOfLines={1} style={styles.output}>{node.output}</Text>
      </View>
      <View style={[styles.dot, { backgroundColor: accent }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  node: {
    width: 236,
    height: 66,
    paddingHorizontal: 13,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#26334d',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  selected: { borderWidth: 2, shadowOpacity: 0.16 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 3 },
  name: { color: '#172039', fontSize: 14, lineHeight: 18, fontWeight: '700' },
  output: { color: '#6f7890', fontSize: 11, lineHeight: 14 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
