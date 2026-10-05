import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Marker, Path, Polygon } from 'react-native-svg';

import { ProcessNode } from '@/components/process-node';
import { graphNodeSize, type GraphNode, type MobileProductGraph } from '@/lib/product-graph';

const PURPLE = '#6d4aff';

export function GraphCanvas({
  graph,
  selectedId,
  onSelect,
}: {
  graph: MobileProductGraph;
  selectedId?: string;
  onSelect: (node: GraphNode) => void;
}) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const pinchOriginX = useSharedValue(0);
  const pinchOriginY = useSharedValue(0);

  const fitGraph = useCallback(() => {
    if (!viewport.width || !viewport.height) return;
    const nextScale = Math.min(1, (viewport.width - 34) / graph.width, (viewport.height - 40) / graph.height);
    scale.value = withTiming(nextScale);
    translateX.value = withTiming((viewport.width - graph.width * nextScale) / 2);
    translateY.value = withTiming((viewport.height - graph.height * nextScale) / 2);
  }, [graph, scale, translateX, translateY, viewport]);

  useEffect(() => {
    fitGraph();
  }, [fitGraph]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) => current.width === width && current.height === height ? current : { width, height });
  };

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => { startX.value = translateX.value; startY.value = translateY.value; })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    });
  const pinch = Gesture.Pinch()
    .onStart((event) => {
      startScale.value = scale.value;
      startX.value = translateX.value;
      startY.value = translateY.value;
      pinchOriginX.value = event.focalX;
      pinchOriginY.value = event.focalY;
    })
    .onUpdate((event) => {
      const nextScale = Math.min(3, Math.max(0.25, startScale.value * event.scale));
      const ratio = nextScale / startScale.value;
      scale.value = nextScale;
      translateX.value = pinchOriginX.value - (pinchOriginX.value - startX.value) * ratio;
      translateY.value = pinchOriginY.value - (pinchOriginY.value - startY.value) * ratio;
    });
  const gesture = Gesture.Simultaneous(pan, pinch);
  const animatedStyle = useAnimatedStyle(() => ({
    transformOrigin: [0, 0, 0],
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const zoomIn = () => {
    if (!viewport.width || !viewport.height) return;
    const oldScale = scale.value;
    const nextScale = Math.min(3, oldScale * 1.25);
    const ratio = nextScale / oldScale;
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    translateX.value = withTiming(centerX - (centerX - translateX.value) * ratio);
    translateY.value = withTiming(centerY - (centerY - translateY.value) * ratio);
    scale.value = withTiming(nextScale);
  };

  return (
    <View onLayout={onLayout} style={styles.viewport}>
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        {Array.from({ length: 16 }, (_, row) =>
          Array.from({ length: 11 }, (_, column) => (
            <Circle key={`${row}-${column}`} cx={18 + column * 38} cy={18 + row * 38} r="1.2" fill="#c7d7ec" />
          ))
        )}
      </Svg>
      <GestureDetector gesture={gesture}>
        <View style={styles.gestureSurface}>
        <Animated.View style={[styles.canvas, { width: graph.width, height: graph.height }, animatedStyle]}>
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={graph.width} height={graph.height}>
            <Defs>
              <Marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <Polygon points="0,0 8,4 0,8" fill={PURPLE} />
              </Marker>
            </Defs>
            {graph.edges.map((edge) => {
              const source = nodesById.get(edge.source);
              const target = nodesById.get(edge.target);
              if (!source || !target) return null;
              const x1 = source.x + graphNodeSize.width / 2;
              const y1 = source.y + graphNodeSize.height;
              const x2 = target.x + graphNodeSize.width / 2;
              const y2 = target.y;
              const middle = y1 + (y2 - y1) / 2;
              return <Path key={edge.id} d={`M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`} fill="none" stroke={PURPLE} strokeWidth="2" markerEnd="url(#arrow)" />;
            })}
          </Svg>
          {graph.nodes.map((node) => (
            <View key={node.id} style={{ position: 'absolute', left: node.x, top: node.y }}>
              <ProcessNode node={node} selected={node.id === selectedId} onPress={() => onSelect(node)} />
            </View>
          ))}
        </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.controls}>
        <Pressable accessibilityLabel="Fit graph to screen" onPress={fitGraph} style={styles.control}>
          <Ionicons name="scan-outline" size={22} color="#172039" />
        </Pressable>
        <Pressable
          accessibilityLabel="Zoom in"
          onPress={zoomIn}
          style={styles.control}>
          <Ionicons name="add" size={25} color="#172039" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, minHeight: 260, overflow: 'hidden', backgroundColor: '#f1f7fd' },
  gestureSurface: { ...StyleSheet.absoluteFillObject },
  canvas: { position: 'absolute', left: 0, top: 0 },
  controls: { position: 'absolute', right: 14, bottom: 18, gap: 10 },
  control: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d8ddea',
    shadowColor: '#26334d',
    shadowOpacity: 0.1,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});
